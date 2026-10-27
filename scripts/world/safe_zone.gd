extends Node3D
## Concentric, bounded safe zones with a final all-map pressure phase.
signal phase_changed(phase_name)

const WorldConfig = preload("res://scripts/data/world_config.gd")
const MAP_HALF := WorldConfig.HALF_SIZE
var center := Vector2.ZERO
var radius := WorldConfig.INITIAL_ZONE_RADIUS
var next_center := Vector2.ZERO
var next_radius := WorldConfig.INITIAL_ZONE_RADIUS
var start_center := Vector2.ZERO
var start_radius := WorldConfig.INITIAL_ZONE_RADIUS
var wait_time := 45.0
var shrink_time := 50.0
var timer := 45.0
var phase := "WAIT"
var level := 0
var final_pressure := false
var rng := RandomNumberGenerator.new()
var ring_instance: MeshInstance3D
var ring_mesh: ImmediateMesh
var ring_mat: StandardMaterial3D
var preview_mat: StandardMaterial3D
var redraw_timer := 0.0

func configure(mode: String, random_seed: int = 0) -> void:
	if random_seed != 0:
		rng.seed = random_seed
	else:
		rng.randomize()
	if mode == "practice":
		wait_time = 8.0
		shrink_time = 12.0
	else:
		wait_time = 45.0
		shrink_time = 50.0
	timer = wait_time
	_choose_next()

func _ready() -> void:
	ring_mesh = ImmediateMesh.new()
	ring_instance = MeshInstance3D.new()
	ring_instance.mesh = ring_mesh
	ring_instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(ring_instance)
	ring_mat = _line_material(Color(0.15, 0.86, 0.98, 1.0))
	preview_mat = _line_material(Color(1.0, 0.74, 0.27, 1.0))
	_redraw_ring()

func _line_material(color: Color) -> StandardMaterial3D:
	var mat = StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = color
	return mat

func _choose_next() -> void:
	next_radius = maxf(2.0, radius * 0.64)
	var max_offset = maxf(0.0, radius - next_radius - 1.0)
	var angle = rng.randf_range(0, TAU)
	var distance = rng.randf_range(0, max_offset * 0.75)
	next_center = center + Vector2(cos(angle), sin(angle)) * distance
	# The next circle is contained in the previous one, which is inside the map.
	next_center.x = clampf(next_center.x, -MAP_HALF + next_radius, MAP_HALF - next_radius)
	next_center.y = clampf(next_center.y, -MAP_HALF + next_radius, MAP_HALF - next_radius)

func advance(delta: float) -> void:
	if final_pressure:
		return
	timer -= delta
	if phase == "WAIT":
		if timer <= 0.0:
			phase = "SHRINK"
			timer = shrink_time
			start_center = center
			start_radius = radius
			phase_changed.emit("SHRINK")
	elif phase == "SHRINK":
		var t = clampf(1.0 - timer / shrink_time, 0.0, 1.0)
		center = start_center.lerp(next_center, t)
		radius = lerpf(start_radius, next_radius, t)
		if timer <= 0.0:
			center = next_center
			radius = next_radius
			level += 1
			if radius <= 2.01:
				phase = "FINAL"
				timer = 25.0
				phase_changed.emit("FINAL")
			else:
				phase = "WAIT"
				timer = wait_time
				_choose_next()
				phase_changed.emit("WAIT")
	elif phase == "FINAL" and timer <= 0.0:
		final_pressure = true
		phase_changed.emit("PRESSURE")
	redraw_timer -= delta
	if redraw_timer <= 0.0:
		redraw_timer = 0.25
		_redraw_ring()

func contains(point: Vector3) -> bool:
	return Vector2(point.x, point.z).distance_to(center) <= radius

func damage_per_second() -> float:
	return 3.0 + float(level) * 1.5 if not final_pressure else 12.0

func _redraw_ring() -> void:
	if not is_instance_valid(ring_mesh) or ring_mat == null:
		return
	ring_mesh.clear_surfaces()
	_add_ring(center, radius, ring_mat, false)
	if phase == "WAIT" and next_radius < radius:
		_add_ring(next_center, next_radius, preview_mat, true)

func _add_ring(at: Vector2, r: float, mat: Material, dashed: bool) -> void:
	ring_mesh.surface_begin(Mesh.PRIMITIVE_LINES, mat)
	var segments = 96
	for i in segments:
		if dashed and i % 2 == 1:
			continue
		var a = TAU * float(i) / segments
		var b = TAU * float(i + 1) / segments
		var p1 = Vector3(at.x + cos(a) * r, 0.13, at.y + sin(a) * r)
		var p2 = Vector3(at.x + cos(b) * r, 0.13, at.y + sin(b) * r)
		ring_mesh.surface_add_vertex(p1)
		ring_mesh.surface_add_vertex(p2)
		if not dashed and i % 4 == 0:
			ring_mesh.surface_add_vertex(p1)
			ring_mesh.surface_add_vertex(p1 + Vector3(0, 2.2, 0))
	ring_mesh.surface_end()
