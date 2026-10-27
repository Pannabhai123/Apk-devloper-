extends RigidBody3D
## Offline physics projectile: timed fuse, cover-aware radial damage and a short flash.
const Factory = preload("res://scripts/actors/model_factory.gd")
const RADIUS := 6.0
const MAX_ACTOR_DAMAGE := 130.0
const MAX_WALL_DAMAGE := 180.0

var game: Node3D
var thrower: Node3D
var fuse := 2.0
var exploded := false

func _ready() -> void:
	add_to_group("frag_grenades")
	collision_layer = 8
	collision_mask = 3
	continuous_cd = true
	gravity_scale = 1.0
	var material = PhysicsMaterial.new()
	material.bounce = 0.25
	material.friction = 0.8
	physics_material_override = material
	var shape = SphereShape3D.new()
	shape.radius = 0.16
	var collider = CollisionShape3D.new()
	collider.shape = shape
	add_child(collider)
	Factory.sphere(self, 0.16, Vector3.ZERO, Color(0.28, 0.34, 0.22))
	Factory.box(self, Vector3(0.12, 0.07, 0.12), Vector3(0, 0.17, 0), Color(0.8, 0.64, 0.30))
	if is_instance_valid(thrower) and thrower is PhysicsBody3D:
		add_collision_exception_with(thrower)

func _physics_process(delta: float) -> void:
	if exploded:
		return
	fuse -= delta
	if fuse <= 0.0:
		detonate()

func _clear_line(from: Vector3, to: Vector3, allowed: Node = null) -> bool:
	var query = PhysicsRayQueryParameters3D.create(from, to, 1, [get_rid()])
	query.hit_from_inside = true
	var hit = get_world_3d().direct_space_state.intersect_ray(query)
	return hit.is_empty() or hit.collider == allowed

func detonate() -> void:
	if exploded or not is_instance_valid(game):
		return
	exploded = true
	# Lift the ray origin clear of the floor. Static geometry and intact walls shield actors.
	var center = global_position + Vector3(0, 0.30, 0)
	for actor in get_tree().get_nodes_in_group("actors"):
		if actor.game != game or actor.dead:
			continue
		var point = actor.global_position + Vector3(0, 0.9, 0)
		var distance = center.distance_to(point)
		if distance < RADIUS and _clear_line(center, point):
			actor.take_damage(MAX_ACTOR_DAMAGE * (1.0 - distance / RADIUS), thrower, false)
	# Damage walls after checking actor cover so a wall protects from the same blast that breaks it.
	for wall in get_tree().get_nodes_in_group("gloo_walls"):
		if wall.get_parent() != game.wall_manager or wall.broken:
			continue
		var point = wall.global_position + Vector3(0, 0.95, 0)
		var distance = center.distance_to(point)
		if distance < RADIUS and _clear_line(center, point, wall):
			wall.take_damage(MAX_WALL_DAMAGE * (1.0 - distance / RADIUS), thrower)
	game.audio.play_effect("explosion", 0.8)
	var flash = Factory.sphere(game, 1.0, center, Color(1.0, 0.55, 0.20, 0.42))
	flash.scale = Vector3.ONE * 0.25
	var tween = flash.create_tween()
	tween.tween_property(flash, "scale", Vector3.ONE * 2.5, 0.23)
	tween.tween_callback(flash.queue_free)
	queue_free()
