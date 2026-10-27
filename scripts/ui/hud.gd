extends Control
## Multitouch HUD: one finger moves, one aims and can fire by dragging from FIRE.
signal pause_requested

var match_game: Node3D
var player: CharacterBody3D
var settings: Dictionary = {}
var touch_roles: Dictionary = {}
var joystick_pointer := -1
var joystick_vector := Vector2.ZERO
var redraw_time := 0.0
const Layout = preload("res://scripts/data/hud_layout.gd")
const WorldConfig = preload("res://scripts/data/world_config.gd")
const INK := Color(0.95, 0.96, 0.91)
const GOLD := Color(1.0, 0.72, 0.34)
const CYAN := Color(0.35, 0.90, 0.86)

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	player = match_game.player
	settings = match_game.settings

func _process(delta: float) -> void:
	redraw_time -= delta
	if redraw_time <= 0:
		redraw_time = 0.05
		queue_redraw()

func _scale() -> float:
	return minf(size.x / 1280.0, size.y / 720.0)

func _offset() -> Vector2:
	return (size - Vector2(1280, 720) * _scale()) / 2.0

func _screen_pos(v: Vector2) -> Vector2:
	return _offset() + v * _scale()

func _virtual_pos(v: Vector2) -> Vector2:
	return (v - _offset()) / maxf(0.001, _scale())

func _button_geometry(key: String) -> Vector3:
	return Layout.geometry(key, settings, settings.get("hud_positions", {}))

func _input(event: InputEvent) -> void:
	if not is_instance_valid(player) or player.dead or get_tree().paused:
		return
	if event is InputEventScreenTouch:
		var point = _virtual_pos(event.position)
		if event.pressed:
			_touch_down(event.index, point)
		else:
			_touch_up(event.index)
	elif event is InputEventScreenDrag and touch_roles.has(event.index):
		var role: String = touch_roles[event.index]
		if role == "joystick":
			_update_joystick(_virtual_pos(event.position))
		elif role == "look" or role == "fire":
			player.look_delta(event.relative / maxf(0.001, _scale()))

func _touch_down(index: int, point: Vector2) -> void:
	var keys: Array = ["pause"]
	if player.deployment_state == "aboard":
		keys.append("jump")
	elif player.deployment_state == "ground":
		keys.append_array(["fire", "jump", "crouch", "scope", "reload", "switch", "wall", "heal", "interact", "grenade", "ability"])
		if match_game.wall_manager.preview_active:
			keys.append("cancel_wall")
	# When enlarged circles overlap, choose the closest normalized center rather
	# than always letting the first button in the list steal the press.
	var selected := ""
	var best_ratio := 2.0
	for key in keys:
		var p = _button_geometry(key)
		var ratio = point.distance_to(Vector2(p.x, p.y)) / (p.z + 8.0)
		if ratio <= 1.0 and ratio < best_ratio:
			best_ratio = ratio
			selected = key
	if not selected.is_empty():
		touch_roles[index] = selected
		if selected == "pause":
			pause_requested.emit()
		elif selected == "fire":
			player.fire_held = true
		else:
			player.action(selected)
		return
	var joy = _button_geometry("joystick")
	if player.deployment_state != "aboard" and joystick_pointer == -1 and point.distance_to(Vector2(joy.x, joy.y)) <= joy.z + 55.0:
		joystick_pointer = index
		touch_roles[index] = "joystick"
		_update_joystick(point)
	else:
		touch_roles[index] = "look"

func _touch_up(index: int) -> void:
	if not touch_roles.has(index):
		return
	var role: String = touch_roles[index]
	if role == "joystick":
		joystick_pointer = -1
		joystick_vector = Vector2.ZERO
		player.touch_move = Vector2.ZERO
	elif role == "fire":
		player.fire_held = false
	touch_roles.erase(index)

func _update_joystick(point: Vector2) -> void:
	var joy = _button_geometry("joystick")
	joystick_vector = ((point - Vector2(joy.x, joy.y)) / joy.z).limit_length(1.0)
	if joystick_vector.length() < 0.12:
		joystick_vector = Vector2.ZERO
	player.touch_move = joystick_vector

func release_inputs() -> void:
	touch_roles.clear()
	joystick_pointer = -1
	joystick_vector = Vector2.ZERO
	if is_instance_valid(player):
		player.touch_move = Vector2.ZERO
		player.fire_held = false

func _draw() -> void:
	if not is_instance_valid(player) or player.inventory == null:
		return
	var s = _scale()
	var origin = _offset()
	var font = ThemeDB.fallback_font
	# Top information bar.
	_draw_panel(Rect2(16, 70, 226, 70), Color(0.035, 0.08, 0.09, 0.78))
	_draw_text(font, Vector2(28, 89), "OPERATOR", 11, Color(0.63, 0.76, 0.72))
	_draw_bar(Rect2(29, 99, 184, 10), player.health / 100.0, Color(0.94, 0.42, 0.31))
	_draw_bar(Rect2(29, 117, 184, 7), player.armor / 100.0, Color(0.36, 0.74, 0.88))
	_draw_text(font, Vector2(218, 109), str(int(player.health)), 12, INK)
	var skill_text = "READY" if player.ability_cooldown <= 0.0 else "%ds" % int(ceil(player.ability_cooldown))
	_draw_text(font, Vector2(28, 155), str(player.palette.get("ability_name", "SKILL")) + "  /  " + skill_text, 11, GOLD)
	var remaining = "TRAINING" if match_game.mode == "training" else "%02d ALIVE" % (match_game.remaining_bots() + (0 if player.dead else 1))
	var top_stats = "HITS %d  /  HEADS %d" % [int(match_game.stats.hits), int(match_game.stats.headshots)] if match_game.mode == "training" else "%02d ELIMS" % int(match_game.stats.kills)
	_draw_text(font, Vector2(435, 30), remaining + "    /    " + top_stats, 17, INK, 410, HORIZONTAL_ALIGNMENT_CENTER)
	var seconds = int(match_game.elapsed)
	_draw_text(font, Vector2(550, 57), "%02d:%02d" % [seconds / 60, seconds % 60], 15, GOLD, 180, HORIZONTAL_ALIGNMENT_CENTER)
	_draw_text(font, Vector2(520, 82), _compass(), 13, Color(0.75, 0.86, 0.82), 240, HORIZONTAL_ALIGNMENT_CENTER)
	_draw_minimap()
	if player.deployment_state != "ground":
		_draw_panel(Rect2(380, 120, 520, 58), Color(0.035, 0.08, 0.09, 0.85))
		var instruction = "AIRCRAFT  /  TAP DROP TO JUMP" if player.deployment_state == "aboard" else "GLIDING  /  ALT %dm  /  STEER TO LAND" % int(maxf(0.0, player.global_position.y))
		_draw_text(font, Vector2(390, 146), instruction, 16, GOLD, 500, HORIZONTAL_ALIGNMENT_CENTER)
		if not OS.has_feature("mobile"):
			_draw_text(font, Vector2(390, 167), "SPACE TO DROP   /   WASD TO STEER", 12, INK, 500, HORIZONTAL_ALIGNMENT_CENTER)
		_draw_button("pause", "II")
		if player.deployment_state == "aboard":
			_draw_button("jump", "DROP")
		else:
			_draw_joystick()
		return
	# Optic reticles are simple HUD overlays; FOV/spread also change in the actual weapon.
	if player.scoped and player.inventory.current() != null:
		var active_optic = player.inventory.current().optic_data()
		var reticle_radius = (55.0 if int(active_optic.rank) >= 2 else 15.0) * s
		draw_arc(size / 2.0, reticle_radius, 0, TAU, 48, Color(0.75, 0.90, 0.82, 0.7), 1.5 * s)
		_draw_text(font, Vector2(670, 403), str(active_optic.name).to_upper(), 12, CYAN)
	# Crosshair and actual hit feedback.
	var center = size / 2.0
	var cross_color = GOLD if match_game.hit_marker_time > 0 and match_game.last_hit_headshot else INK
	for side in [-1, 1]:
		draw_line(center + Vector2(side * 6 * s, 0), center + Vector2(side * 16 * s, 0), cross_color, 2.0 * s)
		draw_line(center + Vector2(0, side * 6 * s), center + Vector2(0, side * 16 * s), cross_color, 2.0 * s)
	if match_game.hit_marker_time > 0:
		for x in [-1, 1]:
			for y in [-1, 1]:
				draw_line(center + Vector2(x * 17, y * 17) * s, center + Vector2(x * 23, y * 23) * s, cross_color, 2.0 * s)
		if bool(settings.get("damage_numbers", true)):
			_draw_text(font, Vector2(663, 334), str(int(match_game.last_damage)), 23, cross_color)
	if match_game.mode == "training":
		var accuracy = 100.0 * float(match_game.stats.hits) / maxi(1, int(match_game.stats.shots))
		_draw_text(font, Vector2(465, 110), "ACCURACY  %.1f%%   /   SHOTS  %d" % [accuracy, int(match_game.stats.shots)], 15, INK, 350, HORIZONTAL_ALIGNMENT_CENTER)
	if match_game.zone != null:
		var zone = match_game.zone
		var text = "FINAL STORM" if zone.final_pressure else ("ZONE %s  %02ds" % [zone.phase, int(ceil(zone.timer))])
		_draw_text(font, Vector2(465, 110), text, 15, GOLD if not zone.contains(player.global_position) else INK, 350, HORIZONTAL_ALIGNMENT_CENTER)
	if player.message_time > 0:
		_draw_text(font, Vector2(430, 158), player.message, 16, GOLD, 420, HORIZONTAL_ALIGNMENT_CENTER)
	# Weapon / state panel.
	var weapon = player.inventory.current()
	if weapon != null:
		_draw_panel(Rect2(429, 627, 422, 70), Color(0.035, 0.08, 0.09, 0.85))
		_draw_text(font, Vector2(449, 650), weapon.data.name.to_upper() + "  [" + str(weapon.optic_data().name).to_upper() + "]", 14, INK)
		var other = player.inventory.slots[1 - player.inventory.selected]
		if other != null:
			_draw_text(font, Vector2(684, 650), "2ND: " + other.data.name.to_upper(), 11, CYAN)
		var reserve_text = "INF" if weapon.unlimited_reserve else str(weapon.reserve)
		var state = "RELOADING" if weapon.reload_remaining > 0 else ("HEALING" if player.healing_remaining > 0 else "%02d / %s" % [weapon.magazine, reserve_text])
		_draw_text(font, Vector2(449, 680), state, 23, GOLD)
		_draw_text(font, Vector2(720, 676), "MED %d  /  WALL %d  /  FRAG %d" % [player.inventory.medkits, player.inventory.walls, player.inventory.grenades], 12, CYAN)
	var nearby = match_game.loot_spawner.nearest(player)
	if is_instance_valid(nearby):
		_draw_text(font, Vector2(440, 598), "NEARBY: " + nearby.display_name().to_upper() + "  [E / PICK]", 13, INK, 400, HORIZONTAL_ALIGNMENT_CENTER)
	if not OS.has_feature("mobile"):
		_draw_text(font, Vector2(15, 709), "WASD MOVE   SHIFT SPRINT   MOUSE AIM/FIRE   R RELOAD   G WALL   T FRAG   F SKILL   E PICK   H HEAL   ESC PAUSE", 11, Color(0.88, 0.90, 0.83, 0.8))
	_draw_joystick()
	var labels = {"pause": "II", "fire": "FIRE", "jump": "JUMP", "crouch": "CROUCH", "scope": "AIM", "reload": "RELOAD", "switch": "SWAP", "wall": "PLACE" if match_game.wall_manager.preview_active else "WALL", "heal": "HEAL", "interact": "PICK", "grenade": "FRAG", "ability": "SKILL" if player.ability_cooldown <= 0.0 else str(int(ceil(player.ability_cooldown))) + "s"}
	for key in labels:
		_draw_button(key, labels[key])
	if match_game.wall_manager.preview_active:
		_draw_button("cancel_wall", "X")

func _draw_panel(rect: Rect2, color: Color) -> void:
	draw_rect(Rect2(_screen_pos(rect.position), rect.size * _scale()), color)

func _draw_bar(rect: Rect2, fraction: float, color: Color) -> void:
	_draw_panel(rect, Color(0.18, 0.23, 0.22, 0.9))
	_draw_panel(Rect2(rect.position, Vector2(rect.size.x * clampf(fraction, 0.0, 1.0), rect.size.y)), color)

func _draw_text(font: Font, pos: Vector2, text: String, font_size: int, color: Color, width: float = -1.0, align: HorizontalAlignment = HORIZONTAL_ALIGNMENT_LEFT) -> void:
	var s = _scale()
	draw_string(font, _screen_pos(pos), text, align, width * s if width > 0 else -1, int(font_size * s), color)

func _draw_button(key: String, label: String) -> void:
	var info = _button_geometry(key)
	var point = _screen_pos(Vector2(info.x, info.y))
	var r = info.z * _scale()
	var opacity = float(settings.get("button_opacity", 70.0)) / 100.0
	var col = Color(0.08, 0.15, 0.15, 0.68 * opacity)
	if key == "fire":
		col = Color(0.87, 0.43, 0.21, 0.70 * opacity)
	draw_circle(point, r, col)
	draw_arc(point, r, 0, TAU, 40, Color(0.83, 0.92, 0.84, 0.7 * opacity), 2.0 * _scale())
	var font = ThemeDB.fallback_font
	var fs = int((15 if key == "fire" else 11) * _scale())
	draw_string(font, point + Vector2(-r, fs * 0.35), label, HORIZONTAL_ALIGNMENT_CENTER, r * 2, fs, INK)

func _draw_joystick() -> void:
	var info = _button_geometry("joystick")
	var center = _screen_pos(Vector2(info.x, info.y))
	var r = info.z * _scale()
	draw_circle(center, r, Color(0.07, 0.14, 0.14, 0.42))
	draw_arc(center, r, 0, TAU, 40, Color(0.75, 0.86, 0.80, 0.50), 2 * _scale())
	draw_circle(center + joystick_vector * r * 0.55, r * 0.33, Color(0.78, 0.88, 0.80, 0.43))

func _draw_minimap() -> void:
	var rect = Rect2(1098, 20, 158, 158)
	_draw_panel(rect, Color(0.035, 0.09, 0.09, 0.88))
	var s = _scale()
	for obstacle in match_game.map.obstacles:
		var p = WorldConfig.map_uv(obstacle.position) * rect.size + rect.position
		var extent = obstacle.size / WorldConfig.SIZE * rect.size
		draw_rect(Rect2(_screen_pos(p), extent * s), Color(0.42, 0.50, 0.43, 0.7))
	if match_game.zone != null:
		var zone = match_game.zone
		var zcenter = rect.position + WorldConfig.map_uv(zone.center) * rect.size
		draw_arc(_screen_pos(zcenter), zone.radius / WorldConfig.SIZE * rect.size.x * s, 0, TAU, 64, CYAN, 1.5 * s)
		if zone.phase == "WAIT":
			var next = rect.position + WorldConfig.map_uv(zone.next_center) * rect.size
			draw_arc(_screen_pos(next), zone.next_radius / WorldConfig.SIZE * rect.size.x * s, 0, TAU, 64, GOLD, 1.0 * s)
	for bot in match_game.recon_targets(player):
		var marker = rect.position + WorldConfig.map_uv(Vector2(bot.global_position.x, bot.global_position.z)) * rect.size
		draw_circle(_screen_pos(marker), 3.0 * s, Color(1.0, 0.34, 0.26))
	var player_point = rect.position + WorldConfig.map_uv(Vector2(player.global_position.x, player.global_position.z)) * rect.size
	draw_circle(_screen_pos(player_point), 4.0 * s, Color.WHITE)
	draw_arc(_screen_pos(rect.position + rect.size / 2), rect.size.x / 2.0 * s, 0, TAU, 4, Color.TRANSPARENT, s)

func _compass() -> String:
	var degrees = fposmod(rad_to_deg(-player.yaw), 360.0)
	var directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
	return "%s   %03d°" % [directions[int(round(degrees / 45.0)) % 8], int(degrees)]
