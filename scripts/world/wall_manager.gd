extends Node3D
## Preview, placement validation and the shared player/bot deployment path.
const Wall = preload("res://scripts/world/gloo_wall.gd")
const WorldConfig = preload("res://scripts/data/world_config.gd")
const Factory = preload("res://scripts/actors/model_factory.gd")
var map: Node3D
var navigator: Node
var preview: MeshInstance3D
var valid_mat: StandardMaterial3D
var invalid_mat: StandardMaterial3D
var preview_position := Vector3.ZERO
var preview_yaw := 0.0
var preview_valid := false
var preview_active := false
var cooldown := 0.0

func _ready() -> void:
	preview = MeshInstance3D.new()
	var box = BoxMesh.new()
	box.size = Vector3(Wall.WIDTH, Wall.HEIGHT, Wall.DEPTH)
	preview.mesh = box
	valid_mat = Factory.material(Color(0.25, 0.93, 0.72, 0.45), true)
	invalid_mat = Factory.material(Color(1.0, 0.22, 0.19, 0.5), true)
	preview.visible = false
	add_child(preview)

func update(delta: float) -> void:
	cooldown = maxf(0.0, cooldown - delta)

func start_preview(actor: Node3D, yaw: float) -> void:
	preview_active = true
	update_preview(actor, yaw)

func cancel_preview() -> void:
	preview_active = false
	if is_instance_valid(preview):
		preview.visible = false

func update_preview(actor: Node3D, yaw: float) -> void:
	if not preview_active or not is_instance_valid(actor):
		return
	var forward = Vector3(-sin(yaw), 0, -cos(yaw))
	var candidate = actor.global_position + forward * 2.5
	var ground = _ground_at(actor, candidate)
	preview_position = ground.position + Vector3(0, 0.02, 0) if not ground.is_empty() else candidate
	preview_yaw = yaw
	preview_valid = not ground.is_empty() and can_place(actor, preview_position, yaw)
	preview.visible = true
	preview.global_position = preview_position + Vector3(0, Wall.HEIGHT / 2.0, 0)
	preview.global_rotation = Vector3(0, yaw, 0)
	preview.material_override = valid_mat if preview_valid else invalid_mat

func _ground_at(actor: Node3D, candidate: Vector3) -> Dictionary:
	# Sample the surface close to the actor's own elevation, never a roof above
	# an indoor player or a distant floor underneath a roof edge.
	var foot_y = actor.global_position.y
	var from = Vector3(candidate.x, foot_y + 1.5, candidate.z)
	var to = Vector3(candidate.x, foot_y - 1.2, candidate.z)
	var ray = PhysicsRayQueryParameters3D.create(from, to, 1, actor.excluded_rids())
	var hit = get_world_3d().direct_space_state.intersect_ray(ray)
	if hit.is_empty() or hit.normal.y < 0.97 or absf(hit.position.y - foot_y) > 0.65:
		return {}
	return hit

func can_place(actor: Node3D, ground: Vector3, yaw: float) -> bool:
	if not is_instance_valid(actor) or cooldown > 0.0 or actor.inventory.walls <= 0:
		return false
	if absf(ground.x) > WorldConfig.HALF_SIZE - 2.0 or absf(ground.z) > WorldConfig.HALF_SIZE - 2.0:
		return false
	# Require flat support under the center and both ends; no floating cover at
	# ledges or sloped ramps. The wall remains vertical on supported surfaces.
	var lateral = Vector3(cos(yaw), 0, -sin(yaw))
	for side in [-1.0, 0.0, 1.0]:
		var supported = _ground_at(actor, ground + lateral * side * Wall.WIDTH * 0.45)
		if supported.is_empty() or absf(supported.position.y - ground.y) > 0.25:
			return false
	var space = get_world_3d().direct_space_state
	var shape = BoxShape3D.new()
	shape.size = Vector3(Wall.WIDTH + 0.08, Wall.HEIGHT, Wall.DEPTH + 0.08)
	var query = PhysicsShapeQueryParameters3D.new()
	query.shape = shape
	query.transform = Transform3D(Basis(Vector3.UP, yaw), ground + Vector3(0, Wall.HEIGHT / 2.0 + 0.04, 0))
	query.collision_mask = 3
	query.collide_with_bodies = true
	query.collide_with_areas = false
	if not space.intersect_shape(query, 1).is_empty():
		return false
	# Do not project cover through an existing solid wall.
	var ray = PhysicsRayQueryParameters3D.create(actor.global_position + Vector3(0, 1.0, 0), ground + Vector3(0, 1.0, 0), 1, actor.excluded_rids())
	if not space.intersect_ray(ray).is_empty():
		return false
	return true

func confirm(actor: Node3D) -> bool:
	if not preview_active:
		return false
	if not can_place(actor, preview_position, preview_yaw):
		preview_valid = false
		return false
	_deploy(actor, preview_position, preview_yaw)
	cancel_preview()
	return true

func deploy_for_bot(actor: Node3D, yaw: float) -> bool:
	var forward = Vector3(-sin(yaw), 0, -cos(yaw))
	var candidate = actor.global_position + forward * 2.5
	var surface = _ground_at(actor, candidate)
	if surface.is_empty():
		return false
	var ground: Vector3 = surface.position + Vector3(0, 0.02, 0)
	if not can_place(actor, ground, yaw):
		return false
	_deploy(actor, ground, yaw)
	return true

func _deploy(actor: Node3D, ground: Vector3, yaw: float) -> void:
	var wall = Wall.new()
	add_child(wall)
	wall.global_position = ground
	wall.global_rotation = Vector3(0, yaw, 0)
	if is_instance_valid(navigator):
		navigator.add_wall(wall)
	if not actor.inventory.unlimited:
		actor.inventory.walls -= 1
	cooldown = 0.65
