extends Node3D
## Battle-only aircraft flyover and physical, steerable gliding.
## Practice and training intentionally start on the ground.
const Factory = preload("res://scripts/actors/model_factory.gd")
const WorldConfig = preload("res://scripts/data/world_config.gd")
const FLIGHT_DURATION := 22.0
const FLIGHT_HEIGHT := 64.0
const GLIDE_SPEED := 10.0
const FALL_SPEED := 7.0

var game: Node3D
var plane: Node3D
var player: CharacterBody3D
var bots: Array = []
var elapsed := 0.0
var completed := false
var drop_times: Array[float] = []

func _ready() -> void:
	plane = Node3D.new()
	plane.name = "Aircraft"
	add_child(plane)
	# Original primitive aircraft; the long axis follows the flight path.
	Factory.box(plane, Vector3(11.0, 1.4, 1.8), Vector3.ZERO, Color(0.38, 0.45, 0.41))
	Factory.box(plane, Vector3(3.2, 0.24, 11.0), Vector3(-0.4, 0, 0), Color(0.52, 0.58, 0.49))
	Factory.box(plane, Vector3(2.7, 0.18, 4.6), Vector3(-4.0, 0.6, 0), Color(0.48, 0.54, 0.47))
	Factory.box(plane, Vector3(1.6, 1.8, 0.18), Vector3(-4.1, 1.1, 0), Color(0.64, 0.56, 0.39))
	Factory.box(plane, Vector3(1.2, 0.5, 1.84), Vector3(3.5, 0.35, 0), Color(0.20, 0.34, 0.34))
	_update_plane()

func begin(p: CharacterBody3D, match_bots: Array) -> void:
	player = p
	bots = match_bots.duplicate()
	for actor in [player] + bots:
		if not is_instance_valid(actor):
			continue
		actor.deployment_state = "aboard"
		actor.collision_layer = 0
		actor.collision_mask = 0
		actor.head_area.collision_layer = 0
		actor.visual.visible = false
		actor.velocity = Vector3.ZERO
		follow_aircraft(actor)
	for i in bots.size():
		# Evenly spaced departures cover the full flight path; bots steer toward
		# different landmark areas, not toward the player's position.
		drop_times.append(2.0 + (FLIGHT_DURATION - 4.0) * (float(i) + 0.5) / maxf(1.0, float(bots.size())))

func _update_plane() -> void:
	var progress = clampf(elapsed / FLIGHT_DURATION, 0.0, 1.0)
	plane.position = Vector3(lerpf(-WorldConfig.HALF_SIZE + 5.0, WorldConfig.HALF_SIZE - 5.0, progress), FLIGHT_HEIGHT, 0)

func follow_aircraft(actor: CharacterBody3D) -> void:
	if is_instance_valid(plane):
		actor.global_position = plane.global_position
		actor.velocity = Vector3.ZERO

func advance(delta: float) -> void:
	if completed:
		return
	elapsed = minf(FLIGHT_DURATION, elapsed + maxf(0.0, delta))
	_update_plane()
	for i in bots.size():
		var bot = bots[i]
		if is_instance_valid(bot) and not bot.dead and bot.deployment_state == "aboard":
			# Position first, so a scheduled jump leaves at this frame's aircraft location.
			follow_aircraft(bot)
			if elapsed >= drop_times[i]:
				var location: Dictionary = game.map.LOCATIONS[(i * 7) % game.map.LOCATIONS.size()]
				bot.deployment_goal = game.map.random_open_near(location.center, 24.0)
				jump(bot)
	if is_instance_valid(player) and not player.dead and player.deployment_state == "aboard":
		follow_aircraft(player)
		if elapsed >= FLIGHT_DURATION:
			jump(player)
	if elapsed >= FLIGHT_DURATION:
		plane.visible = false
		var pending := false
		for actor in [player] + bots:
			if is_instance_valid(actor) and not actor.dead and actor.deployment_state != "ground":
				pending = true
				break
		if not pending:
			completed = true
			game.call_deferred("_resolve_end")

func jump(actor: CharacterBody3D) -> bool:
	if not is_instance_valid(actor) or actor.dead or actor.deployment_state != "aboard":
		return false
	actor.deployment_state = "glide"
	actor.collision_layer = 2
	actor.collision_mask = 3
	actor.head_area.collision_layer = 4
	actor.visual.visible = true
	actor.velocity = Vector3(0, -FALL_SPEED, 0)
	_add_canopy(actor)
	if actor.is_player:
		actor.show_message("STEER TO A LANDING AREA")
	return true

func _add_canopy(actor: CharacterBody3D) -> void:
	var canopy = Node3D.new()
	canopy.name = "Parachute"
	actor.add_child(canopy)
	actor.deployment_canopy = canopy
	var color: Color = actor.palette.get("accent", Color(0.9, 0.65, 0.35))
	var cloth = Factory.sphere(canopy, 1.5, Vector3(0, 3.8, 0), color)
	cloth.scale = Vector3(1.55, 0.20, 1.05)
	for x in [-0.7, 0.7]:
		for z in [-0.35, 0.35]:
			Factory.box(canopy, Vector3(0.035, 2.15, 0.035), Vector3(x, 2.65, z), Color(0.75, 0.78, 0.73))

func glide(actor: CharacterBody3D, direction: Vector3, _delta: float) -> void:
	if actor.dead or actor.deployment_state != "glide":
		return
	var horizontal = Vector3(direction.x, 0, direction.z).limit_length(1.0)
	actor.velocity = horizontal * GLIDE_SPEED + Vector3(0, -FALL_SPEED, 0)
	actor.move_and_slide()
	if horizontal.length_squared() > 0.01:
		actor.visual.rotation.y = atan2(-horizontal.x, -horizontal.z)
	if actor.is_on_floor():
		land(actor)

func land(actor: CharacterBody3D) -> void:
	if actor.deployment_state != "glide":
		return
	actor.deployment_state = "ground"
	actor.velocity.y = -0.1
	if is_instance_valid(actor.deployment_canopy):
		actor.deployment_canopy.queue_free()
	actor.deployment_canopy = null
	if actor.is_player:
		actor.show_message("LANDED — FIND LOOT AND COVER")
