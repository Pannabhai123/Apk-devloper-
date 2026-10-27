extends "res://scripts/actors/actor.gd"
## Third-person controller; input can come from touch HUD or desktop controls.
var camera: Camera3D
var yaw := 0.0
var pitch := -0.12
var touch_move := Vector2.ZERO
var fire_held := false
var scoped := false
var crouched := false
var jump_queued := false
var healing_remaining := 0.0
var pickup_timer := 0.0
var last_vertical_speed := 0.0
var footstep_timer := 0.0
var empty_feedback_timer := 0.0
var grenade_cooldown := 0.0
var message := ""
var message_time := 0.0
var settings: Dictionary = {}

func _ready() -> void:
	is_player = true
	super._ready()
	damaged.connect(_on_damaged)
	camera = Camera3D.new()
	camera.name = "PlayerCamera"
	camera.top_level = true
	camera.fov = 68.0
	camera.near = 0.08
	camera.far = 220.0
	add_child(camera)
	camera.current = true
	_update_camera()

func _input(event: InputEvent) -> void:
	if dead or get_tree().paused or OS.has_feature("mobile"):
		return
	if event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		look_delta(event.relative)
	elif event is InputEventMouseButton and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		if deployment_state != "ground":
			return
		if event.button_index == MOUSE_BUTTON_LEFT:
			fire_held = event.pressed
		elif event.button_index == MOUSE_BUTTON_RIGHT:
			scoped = event.pressed
	elif event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_R: action("reload")
			KEY_H: action("heal")
			KEY_Q: action("switch")
			KEY_E: action("interact")
			KEY_G: action("wall")
			KEY_T: action("grenade")
			KEY_F: action("ability")
			KEY_X: action("cancel_wall")
			KEY_C: action("crouch")
			KEY_SPACE: action("jump")

func look_delta(relative: Vector2) -> void:
	var sensitivity = float(settings.get("ads_sensitivity", 80.0) if scoped else settings.get("sensitivity", 100.0)) / 100.0
	var multiplier = 0.0025 * sensitivity
	yaw -= relative.x * multiplier
	var vertical = relative.y * multiplier
	pitch += vertical if bool(settings.get("invert_y", false)) else -vertical
	pitch = clampf(pitch, -0.83, 0.65)

func _physics_process(delta: float) -> void:
	inventory.update(delta)
	update_ability(delta)
	animate_actor(delta)
	if message_time > 0:
		message_time -= delta
	empty_feedback_timer = maxf(0.0, empty_feedback_timer - delta)
	grenade_cooldown = maxf(0.0, grenade_cooldown - delta)
	if dead:
		_update_camera()
		return
	if deployment_state == "aboard":
		game.deployment.follow_aircraft(self)
		_update_camera()
		return
	if deployment_state == "glide":
		var input_vector = _movement_input()
		var forward = forward_flat()
		var right = Vector3(cos(yaw), 0, -sin(yaw))
		game.deployment.glide(self, right * input_vector.x - forward * input_vector.y, delta)
		_update_camera()
		return
	if healing_remaining > 0.0:
		healing_remaining -= delta
		if healing_remaining <= 0.0:
			healing_remaining = 0.0
			if inventory.medkits > 0:
				inventory.medkits -= 1
				health = minf(100.0, health + 60.0)
				show_message("MEDKIT APPLIED")
	var input_vector = _movement_input()
	var forward = forward_flat()
	var right = Vector3(cos(yaw), 0, -sin(yaw))
	var direction = right * input_vector.x - forward * input_vector.y
	var sprint = (not OS.has_feature("mobile") and Input.is_key_pressed(KEY_SHIFT)) or touch_move.length() > 0.94
	var speed = 2.7 if crouched else (7.1 if sprint else 4.7)
	if healing_remaining > 0.0:
		speed *= 0.55
	var was_airborne = not is_on_floor()
	last_vertical_speed = velocity.y
	move_actor(direction, speed, delta, jump_queued and not crouched and healing_remaining <= 0.0)
	jump_queued = false
	if was_airborne and is_on_floor() and last_vertical_speed < -12.0:
		take_damage((-last_vertical_speed - 12.0) * 4.0, null, false)
	visual.rotation.y = yaw
	_update_camera()
	if game.wall_manager.preview_active:
		game.wall_manager.update_preview(self, yaw)
	if fire_held and healing_remaining <= 0.0:
		_try_fire()
	pickup_timer -= delta
	if pickup_timer <= 0.0:
		pickup_timer = 0.35
		if bool(settings.get("auto_pickup", true)) and healing_remaining <= 0.0:
			var picked = game.loot_spawner.pickup(self, false)
			if not picked.is_empty():
				show_message("PICKED UP " + picked.to_upper())
				game.audio.play_effect("pickup", 0.45)

func _movement_input() -> Vector2:
	var input_vector = touch_move
	if not OS.has_feature("mobile"):
		var keyboard = Vector2(float(Input.is_key_pressed(KEY_D)) - float(Input.is_key_pressed(KEY_A)), float(Input.is_key_pressed(KEY_S)) - float(Input.is_key_pressed(KEY_W)))
		if keyboard.length_squared() > 0.0:
			input_vector = keyboard.normalized()
	return input_vector

func forward_flat() -> Vector3:
	return Vector3(-sin(yaw), 0, -cos(yaw)).normalized()

func aim_direction() -> Vector3:
	return Vector3(-sin(yaw) * cos(pitch), sin(pitch), -cos(yaw) * cos(pitch)).normalized()

func _update_camera() -> void:
	if not is_instance_valid(camera) or not is_inside_tree():
		return
	var origin = global_position + Vector3(0, 1.35 if not crouched else 1.05, 0)
	var look = aim_direction()
	if deployment_state == "aboard":
		var focus = global_position + Vector3(0, 1.0, 0)
		camera.global_position = focus - look * 12.0 + Vector3(0, 3.0, 0)
		camera.look_at(focus, Vector3.UP)
		camera.fov = lerpf(camera.fov, 68.0, 0.2)
		return
	var right = Vector3(cos(yaw), 0, -sin(yaw))
	var desired = origin - look * 4.4 + right * 0.65
	var query = PhysicsRayQueryParameters3D.create(origin, desired, 1, excluded_rids())
	var collision = get_world_3d().direct_space_state.intersect_ray(query)
	camera.global_position = collision.position + collision.normal * 0.15 if not collision.is_empty() else desired
	camera.look_at(camera.global_position + look, Vector3.UP)
	var current_weapon = inventory.current()
	var scoped_fov = float(current_weapon.optic_data().fov) if current_weapon != null else 55.0
	camera.fov = lerpf(camera.fov, scoped_fov if scoped else 68.0, 0.2)

func _try_fire() -> void:
	if deployment_state != "ground":
		return
	var weapon = inventory.current()
	if weapon == null:
		return
	if not weapon.can_fire():
		if weapon.magazine <= 0 and weapon.reload_remaining <= 0.0 and empty_feedback_timer <= 0.0:
			show_message("MAGAZINE EMPTY — RELOAD")
			empty_feedback_timer = 1.0
		return
	var space = get_world_3d().direct_space_state
	var direction = aim_direction()
	if bool(settings.get("aim_assist", true)):
		direction = game.assist_direction(self, camera.global_position, direction)
	var end = camera.global_position + direction * float(weapon.data.range)
	var camera_ray = PhysicsRayQueryParameters3D.create(camera.global_position, end, 7, excluded_rids())
	camera_ray.collide_with_areas = true
	var camera_hit = space.intersect_ray(camera_ray)
	if not camera_hit.is_empty():
		end = camera_hit.position
	# A second ray from the player's muzzle prevents firing through nearby cover.
	var muzzle = global_position + Vector3(0, 1.15 if not crouched else 0.85, 0) + forward_flat() * 0.40
	var fire_direction = (end - muzzle).normalized()
	var aim_spread = float(weapon.optic_data().spread) if scoped else 1.0
	var result = weapon.fire(space, muzzle, fire_direction, excluded_rids(), self, aim_spread * ability_spread_multiplier())
	if result.fired:
		game.report_gunshot(self)
		game.record_player_shot(weapon.id, result)
		game.audio.play_effect("shot", 0.7)
		pitch = minf(0.65, pitch + float(weapon.data.recoil))
		if result.headshots > 0:
			game.audio.play_effect("headshot", 0.8)
		elif result.hit_actor:
			game.audio.play_effect("hit", 0.65)

func action(which: String) -> void:
	if dead:
		return
	if deployment_state != "ground":
		if deployment_state == "aboard" and which == "jump" and is_instance_valid(game.deployment):
			game.deployment.jump(self)
		return
	var weapon = inventory.current()
	match which:
		"reload":
			if healing_remaining <= 0.0 and weapon != null and weapon.start_reload():
				show_message("RELOADING")
				game.audio.play_effect("reload", 0.6)
		"heal":
			if health < 100.0 and inventory.medkits > 0 and healing_remaining <= 0.0 and weapon.reload_remaining <= 0.0:
				healing_remaining = 2.4
				show_message("USING MEDKIT")
		"switch":
			if healing_remaining <= 0.0 and inventory.switch_weapon():
				show_message("WEAPON SWITCHED")
		"jump":
			jump_queued = true
		"crouch":
			crouched = not crouched
			visual.scale.y = 0.74 if crouched else 1.0
			var collider = get_node("BodyCollider")
			collider.shape.height = 1.02 if crouched else 1.38
			collider.position.y = 0.51 if crouched else 0.69
			head_area.position.y = 1.20 if crouched else 1.62
		"scope":
			scoped = not scoped
		"interact":
			if healing_remaining > 0.0:
				return
			var picked = game.loot_spawner.pickup(self, true)
			if picked.is_empty():
				show_message("NO USABLE LOOT NEARBY")
			else:
				show_message("PICKED UP " + picked.to_upper())
				game.audio.play_effect("pickup", 0.5)
		"ability":
			if healing_remaining > 0.0:
				return
			if activate_ability():
				show_message(str(palette.get("ability_name", "ABILITY")) + " ACTIVATED")
			elif ability_cooldown > 0.0:
				show_message("ABILITY READY IN %ds" % int(ceil(ability_cooldown)))
			else:
				show_message("ABILITY NOT NEEDED YET")
		"grenade":
			if healing_remaining > 0.0 or grenade_cooldown > 0.0:
				return
			if game.throw_grenade(self, forward_flat()) != null:
				grenade_cooldown = 1.0
				show_message("FRAG GRENADE THROWN")
			else:
				show_message("NO FRAG GRENADES")
		"wall":
			if game.wall_manager.preview_active:
				if game.wall_manager.confirm(self):
					game.record_wall(self)
					game.audio.play_effect("wall", 0.7)
					show_message("GLOO WALL DEPLOYED")
				else:
					show_message("INVALID PLACEMENT")
			else:
				if inventory.walls > 0:
					game.wall_manager.start_preview(self, yaw)
					show_message("AIM, THEN TAP WALL TO PLACE")
				else:
					show_message("NO GLOO WALLS")
		"cancel_wall":
			game.wall_manager.cancel_preview()

func _on_damaged(_actor: Node, _amount: float, _attacker: Node, _headshot: bool) -> void:
	if healing_remaining > 0.0:
		healing_remaining = 0.0
		show_message("HEALING INTERRUPTED")

func show_message(text: String) -> void:
	message = text
	message_time = 2.5
