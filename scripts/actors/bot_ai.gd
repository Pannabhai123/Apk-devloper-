extends "res://scripts/actors/actor.gd"
## Throttled perception, shared grid navigation and local collision probes.
var rng := RandomNumberGenerator.new()
var target: Node3D
var target_visible := false
var last_seen := Vector3.ZERO
var memory_remaining := 0.0
var think_timer := 0.0
var react_timer := 0.0
var heal_timer := 0.0
var wall_timer := 0.0
var grenade_timer := 0.0
var loot_ignore_timer := 0.0
var hearing_cooldown := 0.0
var roam_goal := Vector3.ZERO
var move_direction := Vector3.ZERO
var navigation_path: Array[Vector3] = []
var navigation_goal := Vector3(10000, 0, 10000)
var navigation_timer := 0.0
var navigation_revision := -1
var turn_preference := 1.0
var difficulty := "NORMAL"
var difficulty_values := {"EASY": [0.9, 3.8], "NORMAL": [0.55, 2.5], "HARD": [0.32, 1.6], "EXPERT": [0.2, 1.1]}

func _ready() -> void:
	super._ready()
	rng.randomize()
	turn_preference = 1.0 if rng.randf() > 0.5 else -1.0
	navigation_timer = rng.randf_range(0.0, 0.8)
	roam_goal = game.map.random_open_position()
	damaged.connect(_on_bot_damaged)

func _physics_process(delta: float) -> void:
	inventory.update(delta)
	update_ability(delta)
	animate_actor(delta)
	if dead:
		if death_time > 3.0:
			queue_free()
		return
	if deployment_state == "aboard":
		game.deployment.follow_aircraft(self)
		return
	if deployment_state == "glide":
		game.deployment.glide(self, _flat_dir(deployment_goal - global_position), delta)
		return
	think_timer -= delta
	wall_timer = maxf(0.0, wall_timer - delta)
	grenade_timer = maxf(0.0, grenade_timer - delta)
	loot_ignore_timer = maxf(0.0, loot_ignore_timer - delta)
	hearing_cooldown = maxf(0.0, hearing_cooldown - delta)
	navigation_timer = maxf(0.0, navigation_timer - delta)
	react_timer = maxf(0.0, react_timer - delta)
	memory_remaining = maxf(0.0, memory_remaining - delta)
	if heal_timer > 0.0:
		heal_timer -= delta
		if heal_timer <= 0.0 and inventory.medkits > 0:
			inventory.medkits -= 1
			health = minf(100.0, health + 60.0)
	if think_timer <= 0.0:
		think_timer = rng.randf_range(0.30, 0.52)
		_think()
	var movement = move_direction
	move_actor(movement, 3.8 if heal_timer <= 0.0 else 1.5, delta)
	if target_visible and is_instance_valid(target) and not target.dead:
		var facing = target.global_position - global_position
		if facing.length_squared() > 0.01:
			visual.rotation.y = atan2(-facing.x, -facing.z)
		if react_timer <= 0.0 and heal_timer <= 0.0 and _line_of_sight(target):
			_fire_at(target)
	elif movement.length_squared() > 0.1:
		visual.rotation.y = atan2(-movement.x, -movement.z)

func _think() -> void:
	var nearest: Node3D = null
	var sensed: Node3D = null
	var sensed_distance := 35.0
	var best_distance = 45.0
	for candidate in get_tree().get_nodes_in_group("actors"):
		if candidate == self or candidate.dead or candidate.is_target:
			continue
		var distance = global_position.distance_to(candidate.global_position)
		if ability_active("recon") and distance < sensed_distance:
			sensed_distance = distance
			sensed = candidate
		if distance < best_distance and _line_of_sight(candidate):
			best_distance = distance
			nearest = candidate
	if is_instance_valid(nearest):
		if nearest != target or not target_visible:
			react_timer = float(difficulty_values.get(difficulty, difficulty_values.NORMAL)[0])
		target = nearest
		target_visible = true
		last_seen = target.global_position
		memory_remaining = 3.0
	else:
		target_visible = false
		if is_instance_valid(sensed):
			last_seen = sensed.global_position
			memory_remaining = 1.5
		elif memory_remaining <= 0.0:
			target = null
	# Zone knowledge is shared from the visible safe-zone HUD, not player positions.
	if game.zone != null and not game.zone.contains(global_position):
		var goal = Vector3(game.zone.center.x, 0, game.zone.center.y)
		move_direction = _navigate_to(goal)
	elif target_visible:
		var toward = _flat_dir(target.global_position - global_position)
		var distance = global_position.distance_to(target.global_position)
		if distance > 22.0:
			move_direction = _navigate_to(target.global_position)
		elif distance < 9.0:
			move_direction = -toward
		else:
			move_direction = Vector3(-toward.z, 0, toward.x) * turn_preference * 0.65
		if distance >= 10.0 and distance <= 22.0 and grenade_timer <= 0.0 and rng.randf() < 0.06:
			_try_throw_grenade(target)
		if health < 45.0 and wall_timer <= 0.0 and inventory.walls > 0 and rng.randf() < 0.3:
			var facing_yaw = atan2(-toward.x, -toward.z)
			if game.wall_manager.deploy_for_bot(self, facing_yaw):
				wall_timer = 12.0
	elif memory_remaining > 0.0:
		move_direction = _navigate_to(last_seen)
	else:
		if health < 65.0 and inventory.medkits > 0 and heal_timer <= 0.0:
			heal_timer = 2.4
		var nearby_loot = game.loot_spawner.nearest(self, 18.0) if loot_ignore_timer <= 0.0 else null
		if is_instance_valid(nearby_loot):
			if global_position.distance_to(nearby_loot.global_position) < 2.6:
				if game.loot_spawner.pickup(self, false).is_empty():
					loot_ignore_timer = 4.0
					roam_goal = game.map.random_open_position()
			else:
				roam_goal = nearby_loot.global_position
		if global_position.distance_to(roam_goal) < 3.0:
			roam_goal = game.map.random_open_position()
		move_direction = _navigate_to(roam_goal)
	_consider_ability()
	var weapon = inventory.current()
	if weapon != null and weapon.magazine <= 0 and weapon.reload_remaining <= 0.0:
		weapon.start_reload()
	# Collision probes are performed at the throttled think rate, not every physics frame.
	move_direction = _avoid_obstacles(move_direction)

func _consider_ability() -> void:
	if ability_cooldown > 0.0 or heal_timer > 0.0:
		return
	var outside_zone = game.zone != null and not game.zone.contains(global_position)
	var should_use := false
	match str(palette.get("ability", "")):
		"bulwark": should_use = armor < 70.0
		"steady": should_use = target_visible
		"recon": should_use = target_visible or memory_remaining > 0.0
		"rush": should_use = outside_zone or (target_visible and global_position.distance_to(target.global_position) > 18.0)
		"terrain": should_use = outside_zone
		"repair": should_use = health < 75.0
		"reload":
			var gun = inventory.current()
			should_use = gun != null and gun.magazine < int(gun.data.magazine) / 2
		"cover": should_use = inventory.walls < 3
	if should_use:
		activate_ability()

func _navigate_to(goal: Vector3) -> Vector3:
	if navigation_revision != game.navigator.revision:
		navigation_revision = game.navigator.revision
		navigation_path.clear()
		navigation_timer = 0.0
	var flat_goal = Vector3(goal.x, 0.05, goal.z)
	var changed = Vector2(navigation_goal.x - flat_goal.x, navigation_goal.z - flat_goal.z).length() > 6.0
	if navigation_timer <= 0.0 and (changed or navigation_path.is_empty() or global_position.distance_to(navigation_path.back()) > 3.0):
		var next_path = game.navigator.request_path(global_position, flat_goal)
		if next_path == null:
			# Other bots used this frame's budget; stagger the retry.
			navigation_timer = rng.randf_range(0.1, 0.3)
		else:
			navigation_path.assign(next_path)
			navigation_goal = flat_goal
			navigation_timer = rng.randf_range(1.2, 2.2)
	while navigation_path.size() > 1 and Vector2(navigation_path[0].x - global_position.x, navigation_path[0].z - global_position.z).length() < 1.3:
		navigation_path.pop_front()
	if not navigation_path.is_empty():
		return _flat_dir(navigation_path[0] - global_position)
	return _flat_dir(flat_goal - global_position)

func _flat_dir(v: Vector3) -> Vector3:
	v.y = 0
	return v.normalized() if v.length_squared() > 0.01 else Vector3.ZERO

func hear_gunshot(origin: Vector3) -> void:
	# Hearing gives an approximate investigation point, never a firing lock.
	if dead or deployment_state != "ground" or target_visible or hearing_cooldown > 0.0:
		return
	last_seen = origin + Vector3(rng.randf_range(-2.0, 2.0), 0.0, rng.randf_range(-2.0, 2.0))
	memory_remaining = maxf(memory_remaining, 3.0)
	hearing_cooldown = 0.75

func _line_of_sight(other: Node3D) -> bool:
	if not is_instance_valid(other) or other.dead:
		return false
	var origin = global_position + Vector3(0, 1.15, 0)
	var end = other.global_position + Vector3(0, 1.0, 0)
	var query = PhysicsRayQueryParameters3D.create(origin, end, 3, excluded_rids())
	var hit = get_world_3d().direct_space_state.intersect_ray(query)
	return not hit.is_empty() and hit.collider == other

func _avoid_obstacles(desired: Vector3) -> Vector3:
	if desired.length_squared() < 0.01:
		return Vector3.ZERO
	var origin = global_position + Vector3(0, 0.65, 0)
	for degrees in [0.0, 45.0 * turn_preference, -45.0 * turn_preference, 90.0 * turn_preference, -90.0 * turn_preference, 150.0 * turn_preference]:
		var option = desired.rotated(Vector3.UP, deg_to_rad(degrees)).normalized()
		var query = PhysicsRayQueryParameters3D.create(origin, origin + option * 2.1, 1, excluded_rids())
		if get_world_3d().direct_space_state.intersect_ray(query).is_empty():
			return option * minf(1.0, desired.length())
	turn_preference *= -1.0
	return -desired * 0.3

func _try_throw_grenade(other: Node3D) -> bool:
	if not is_instance_valid(other) or other.dead or grenade_timer > 0.0 or heal_timer > 0.0 or inventory.grenades <= 0:
		return false
	var distance = global_position.distance_to(other.global_position)
	if distance < 10.0 or distance > 22.0 or not _line_of_sight(other):
		return false
	if game.throw_grenade(self, _flat_dir(other.global_position - global_position)) == null:
		return false
	grenade_timer = 14.0
	return true

func _fire_at(other: Node3D) -> void:
	var weapon = inventory.current()
	if weapon == null:
		return
	if weapon.magazine <= 0:
		weapon.start_reload()
		return
	if not weapon.can_fire():
		return
	var origin = global_position + Vector3(0, 1.18, 0)
	var aim_point = other.global_position + Vector3(rng.randf_range(-0.18, 0.18), rng.randf_range(0.82, 1.48), 0)
	var direction = (aim_point - origin).normalized()
	var spread_scale = float(difficulty_values.get(difficulty, difficulty_values.NORMAL)[1]) * ability_spread_multiplier()
	if global_position.distance_to(other.global_position) > 18.0 and weapon.optic != "iron":
		spread_scale *= minf(1.0, float(weapon.optic_data().spread) + 0.25)
	var result = weapon.fire(get_world_3d().direct_space_state, origin, direction, excluded_rids(), self, spread_scale)
	if result.fired:
		game.report_gunshot(self)
		if global_position.distance_to(game.player.global_position) < 40.0:
			game.audio.play_effect("shot", 0.20)

func _on_bot_damaged(_actor: Node, _amount: float, _attacker: Node, _headshot: bool) -> void:
	heal_timer = 0.0
