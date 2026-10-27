extends Node3D
## Owns a complete single-player match and its deterministic end conditions.
signal finished(result)

const MapBuilder = preload("res://scripts/world/map_builder.gd")
const SafeZone = preload("res://scripts/world/safe_zone.gd")
const NavigationGrid = preload("res://scripts/world/navigation_grid.gd")
const Deployment = preload("res://scripts/world/deployment.gd")
const WallManager = preload("res://scripts/world/wall_manager.gd")
const LootSpawner = preload("res://scripts/world/loot_spawner.gd")
const Player = preload("res://scripts/actors/player_controller.gd")
const Bot = preload("res://scripts/actors/bot_ai.gd")
const Target = preload("res://scripts/actors/training_target.gd")
const Inventory = preload("res://scripts/combat/inventory.gd")
const FragGrenade = preload("res://scripts/combat/frag_grenade.gd")
const Characters = preload("res://scripts/data/characters.gd")
const WeaponData = preload("res://scripts/data/weapons.gd")

var mode := "practice"
var settings: Dictionary = {}
var progress: Dictionary = {}
var audio: Node
var map: Node3D
var navigator: Node
var deployment: Node3D
var zone: Node3D
var wall_manager: Node3D
var loot_spawner: Node3D
var player: CharacterBody3D
var bots: Array = []
var targets: Array = []
var elapsed := 0.0
var zone_damage_timer := 1.0
var ended := false
var player_placement_on_death := 0
var stats := {"shots": 0, "hits": 0, "headshots": 0, "kills": 0, "damage_dealt": 0.0, "damage_received": 0.0, "walls": 0, "weapons_used": []}
var hit_marker_time := 0.0
var last_hit_headshot := false
var last_damage := 0.0

func setup(match_mode: String, save_data: Dictionary, sound: Node) -> void:
	mode = match_mode
	settings = save_data.get("settings", {}).duplicate(true)
	progress = save_data.get("progress", {}).duplicate(true)
	audio = sound

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_PAUSABLE
	map = MapBuilder.new()
	add_child(map)
	map.apply_quality(settings.get("quality", "BALANCED"))
	navigator = NavigationGrid.new()
	navigator.map = map
	add_child(navigator)
	wall_manager = WallManager.new()
	wall_manager.map = map
	wall_manager.navigator = navigator
	add_child(wall_manager)
	loot_spawner = LootSpawner.new()
	loot_spawner.map = map
	add_child(loot_spawner)
	loot_spawner.spawn_initial(112 if mode != "training" else 20)
	if mode != "training":
		zone = SafeZone.new()
		zone.configure(mode)
		zone.phase_changed.connect(_on_zone_phase)
		add_child(zone)
	_spawn_player()
	# Starter supplies near the training/practice spawn and central battle area.
	loot_spawner.spawn("weapon", "ar_01", player.position + Vector3(3.0, 0, -2.0))
	loot_spawner.spawn("wall", "", player.position + Vector3(-3.0, 0, -2.0))
	# Rooftop supplies reward climbing; y must be preserved by the spawner.
	loot_spawner.spawn("weapon", "sr_01", Vector3(1.7, 3.66, 117))
	loot_spawner.spawn("optic", "scope_2x", Vector3(-1.7, 3.66, 117))
	if mode == "training":
		_spawn_targets()
	else:
		_spawn_bots()
		if mode == "battle":
			deployment = Deployment.new()
			deployment.game = self
			add_child(deployment)
			deployment.begin(player, bots)

func _spawn_player() -> void:
	player = Player.new()
	player.game = self
	player.settings = settings
	player.actor_label = "YOU"
	var character_index = clampi(int(progress.get("character", 0)), 0, Characters.ROSTER.size() - 1)
	player.palette = Characters.ROSTER[character_index]
	player.inventory = Inventory.new(str(progress.get("training_weapon", "ar_01")) if mode == "training" else "pistol_01", mode == "training")
	player.position = Vector3(0, 0.05, 53)
	_connect_actor(player)
	add_child(player)

func _spawn_bots() -> void:
	var count = clampi(int(settings.get("bot_count", 10)), 3, 49)
	if mode == "practice":
		count = mini(count, 15)
	var spawn_positions: Array[Vector3] = [player.position]
	for i in count:
		var bot = Bot.new()
		bot.game = self
		bot.actor_label = "RANGER %02d" % (i + 1)
		bot.difficulty = str(settings.get("difficulty", "NORMAL"))
		bot.palette = Characters.ROSTER[(i + 1) % Characters.ROSTER.size()]
		bot.inventory = Inventory.new("pistol_01")
		var pos = map.random_open_position(player.position, 25.0)
		for attempt in 20:
			var spaced = true
			for other in spawn_positions:
				if pos.distance_to(other) < 5.0:
					spaced = false
					break
			if spaced:
				break
			pos = map.random_open_position(player.position, 25.0)
		bot.position = pos
		spawn_positions.append(pos)
		_connect_actor(bot)
		bots.append(bot)
		add_child(bot)

func _spawn_targets() -> void:
	var positions = [Vector3(-7, 0.05, 30), Vector3(0, 0.05, 29), Vector3(7, 0.05, 30), Vector3(15, 0.05, 22)]
	for i in positions.size():
		var target = Target.new()
		target.game = self
		target.actor_label = "TARGET %d" % (i + 1)
		target.palette = {"color": Color(0.80, 0.43, 0.29), "accent": Color(1, 0.85, 0.55)}
		target.position = positions[i]
		target.moving = i >= 2
		_connect_actor(target)
		targets.append(target)
		add_child(target)

func _connect_actor(actor: Node) -> void:
	actor.damaged.connect(_on_actor_damaged)
	actor.died.connect(_on_actor_died)

func _physics_process(delta: float) -> void:
	if ended:
		return
	elapsed += delta
	hit_marker_time = maxf(0.0, hit_marker_time - delta)
	wall_manager.update(delta)
	if is_instance_valid(deployment):
		deployment.advance(delta)
	if zone != null and (not is_instance_valid(deployment) or deployment.completed):
		zone.advance(delta)
		zone_damage_timer -= delta
		if zone_damage_timer <= 0.0:
			zone_damage_timer += 1.0
			for actor in get_tree().get_nodes_in_group("actors"):
				if actor.game == self and not actor.dead and (zone.final_pressure or not zone.contains(actor.global_position)):
					actor.take_damage(zone.damage_per_second(), null, false)

func throw_grenade(actor: Node3D, direction: Vector3):
	if ended or not is_instance_valid(actor) or actor.dead or actor.deployment_state != "ground" or actor.inventory.grenades <= 0:
		return null
	var horizontal = Vector3(direction.x, 0, direction.z).normalized()
	if horizontal.length_squared() < 0.5:
		return null
	var grenade = FragGrenade.new()
	grenade.game = self
	grenade.thrower = actor
	grenade.position = actor.position + Vector3(0, 1.35, 0) + horizontal * 0.75
	add_child(grenade)
	grenade.linear_velocity = horizontal * 12.0 + Vector3(0, 5.0, 0)
	if not actor.inventory.unlimited:
		actor.inventory.grenades -= 1
	return grenade

func record_player_shot(weapon_id: String, result: Dictionary) -> void:
	stats.shots += 1
	if weapon_id not in stats.weapons_used:
		stats.weapons_used.append(weapon_id)
	if result.hit_actor:
		stats.hits += 1
		stats.headshots += int(result.headshots)
		hit_marker_time = 0.24
		last_hit_headshot = result.headshots > 0
		last_damage = float(result.damage)

func record_wall(actor: Node) -> void:
	if actor == player:
		stats.walls += 1

func _on_actor_damaged(actor: Node, amount: float, attacker: Node, _headshot: bool) -> void:
	if actor == player:
		stats.damage_received += amount
	if attacker == player and actor != player:
		stats.damage_dealt += amount

func _on_actor_died(actor: Node, attacker: Node) -> void:
	if actor.is_target:
		return
	if actor == player:
		player_placement_on_death = maxi(2, remaining_bots() + 1)
	else:
		if attacker == player:
			stats.kills += 1
		var drop_point = _loot_drop_position(actor)
		var weapon = actor.inventory.current()
		if weapon != null:
			loot_spawner.spawn("weapon", weapon.id, drop_point)
		if actor.inventory.medkits > 0:
			loot_spawner.spawn("medkit", "", drop_point + Vector3(1, 0, 0))
		if actor.inventory.walls > 0:
			loot_spawner.spawn("wall", "", drop_point + Vector3(-1, 0, 0))
		if actor.inventory.grenades > 0:
			loot_spawner.spawn("grenade", "", drop_point + Vector3(0, 0, 1))
	# Resolve after all deaths in this physics tick. A dead player can never win a tie.
	call_deferred("_resolve_end")

func _loot_drop_position(actor: Node3D) -> Vector3:
	# A bot can die while gliding or on an upper floor. Drop supplies on the
	# nearest actual surface below rather than leaving them floating in midair.
	var start = actor.global_position + Vector3(0, 0.25, 0)
	var end = Vector3(start.x, -1.0, start.z)
	var query = PhysicsRayQueryParameters3D.create(start, end, 1, actor.excluded_rids())
	var hit = get_world_3d().direct_space_state.intersect_ray(query)
	return hit.position + Vector3(0, 0.05, 0) if not hit.is_empty() else Vector3(start.x, 0.05, start.z)

func _resolve_end() -> void:
	if ended or mode == "training":
		return
	if player.dead:
		_finish(false)
	elif remaining_bots() == 0 and (not is_instance_valid(deployment) or deployment.completed):
		_finish(true)

func report_gunshot(source: Node3D) -> void:
	# A nearby shot is audible through cover, but grants no exact target or sight.
	for bot in bots:
		if is_instance_valid(bot) and bot != source and not bot.dead and bot.global_position.distance_squared_to(source.global_position) <= 32.0 * 32.0:
			bot.hear_gunshot(source.global_position)

func recon_targets(observer: Node3D) -> Array:
	var visible: Array = []
	if not is_instance_valid(observer) or not observer.ability_active("recon"):
		return visible
	for bot in bots:
		if is_instance_valid(bot) and not bot.dead and bot.global_position.distance_to(observer.global_position) <= 35.0:
			visible.append(bot)
	return visible

func remaining_bots() -> int:
	var count = 0
	for bot in bots:
		if is_instance_valid(bot) and not bot.dead:
			count += 1
	return count

func _finish(victory: bool) -> void:
	if ended:
		return
	ended = true
	var placement = 1 if victory and not player.dead else maxi(2, player_placement_on_death)
	var accuracy = 100.0 * float(stats.hits) / maxi(1, int(stats.shots))
	var xp = 35 + int(stats.kills) * 35 + int(elapsed / 8.0) + (150 if victory else 0)
	var currency = 20 + int(stats.kills) * 15 + (80 if victory else 0)
	var names: Array = []
	for id in stats.weapons_used:
		names.append(WeaponData.get_data(id).name)
	var result = {"mode": mode, "victory": victory and not player.dead, "placement": placement,
		"kills": int(stats.kills), "headshots": int(stats.headshots), "shots": int(stats.shots), "hits": int(stats.hits),
		"accuracy": snappedf(accuracy, 0.1), "damage_dealt": int(stats.damage_dealt), "damage_received": int(stats.damage_received),
		"survival_time": int(elapsed), "weapons": names, "walls": int(stats.walls), "xp": xp, "currency": currency}
	finished.emit(result)

func _on_zone_phase(phase_name: String) -> void:
	if is_instance_valid(player):
		match phase_name:
			"SHRINK": player.show_message("SAFE ZONE IS SHRINKING")
			"FINAL": player.show_message("FINAL SAFE ZONE")
			"PRESSURE": player.show_message("FINAL STORM: NO SAFE AREA")
		if phase_name != "WAIT":
			audio.play_effect("warning", 0.6)

func assist_direction(shooter: Node3D, origin: Vector3, direction: Vector3) -> Vector3:
	# Very small correction toward the torso of an already-visible target; never snaps to heads.
	var best = 0.993
	var corrected = direction
	var space = get_world_3d().direct_space_state
	for candidate in get_tree().get_nodes_in_group("actors"):
		if candidate == shooter or candidate.dead or candidate.game != self:
			continue
		var point = candidate.global_position + Vector3(0, 1.05, 0)
		if origin.distance_to(point) > 45.0:
			continue
		var toward = (point - origin).normalized()
		var dot = direction.dot(toward)
		if dot < best:
			continue
		var query = PhysicsRayQueryParameters3D.create(origin, point, 3, shooter.excluded_rids())
		var hit = space.intersect_ray(query)
		if not hit.is_empty() and hit.collider == candidate:
			best = dot
			corrected = direction.lerp(toward, 0.13).normalized()
	return corrected
