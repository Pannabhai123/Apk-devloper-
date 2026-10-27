extends Node3D
## Original intermediate test island: small landmarks, cover and bounded terrain.
const Factory = preload("res://scripts/actors/model_factory.gd")
const WorldConfig = preload("res://scripts/data/world_config.gd")
const MAP_HALF := WorldConfig.HALF_SIZE
var obstacles: Array[Rect2] = []
# Small original landmarks, not the fully authored locations in the final brief.
const LOCATIONS = [
	{"name": "VEER NAGAR", "center": Vector2(-42, -37)},
	{"name": "SURYA YARD", "center": Vector2(43, -51)},
	{"name": "DESERT OUTPOST", "center": Vector2(-47, 47)},
	{"name": "GREEN VALLEY", "center": Vector2(46, 45)},
	{"name": "RANG BAZAAR", "center": Vector2(0, -120)},
	{"name": "KISAN FARM", "center": Vector2(-115, -105)},
	{"name": "MONSOON DEPOT", "center": Vector2(112, -105)},
	{"name": "PIPAL GROVE", "center": Vector2(-115, 52)},
	{"name": "SAFFRON FORT", "center": Vector2(115, 45)},
	{"name": "DAKSHIN WATCH", "center": Vector2(0, 118)},
]
var sun: DirectionalLight3D
var rng := RandomNumberGenerator.new()

func _ready() -> void:
	rng.seed = 81173
	_build_environment()
	_build_island()

func _build_environment() -> void:
	var world = WorldEnvironment.new()
	var env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.47, 0.69, 0.73)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.78, 0.85, 0.79)
	env.ambient_light_energy = 0.8
	world.environment = env
	add_child(world)
	sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-53, -35, 0)
	sun.light_color = Color(1.0, 0.86, 0.68)
	sun.light_energy = 1.0
	sun.shadow_enabled = false
	add_child(sun)

func apply_quality(quality: String) -> void:
	if is_instance_valid(sun):
		sun.shadow_enabled = quality == "HIGH"

func _static_box(center: Vector3, size: Vector3, color: Color, record: bool = true) -> StaticBody3D:
	var body = StaticBody3D.new()
	body.position = center
	body.collision_layer = 1
	body.collision_mask = 0
	var shape = CollisionShape3D.new()
	var box_shape = BoxShape3D.new()
	box_shape.size = size
	shape.shape = box_shape
	body.add_child(shape)
	Factory.box(body, size, Vector3.ZERO, color)
	add_child(body)
	if record:
		obstacles.append(Rect2(center.x - size.x / 2.0, center.z - size.z / 2.0, size.x, size.z))
	return body

func _floor_patch(center: Vector3, size: Vector3, color: Color) -> void:
	Factory.box(self, size, center, color)

func _build_island() -> void:
	_static_box(Vector3(0, -0.6, 0), Vector3(WorldConfig.SIZE, 1.2, WorldConfig.SIZE), Color(0.43, 0.55, 0.36), false)
	# Warm dirt and two broad intersecting roads give landmarks an original, readable layout.
	_floor_patch(Vector3(-42, 0.015, 40), Vector3(65, 0.025, 64), Color(0.65, 0.58, 0.40))
	_floor_patch(Vector3(43, 0.018, -43), Vector3(61, 0.028, 61), Color(0.57, 0.55, 0.42))
	_floor_patch(Vector3(0, 0.035, 0), Vector3(WorldConfig.SIZE, 0.04, 8), Color(0.39, 0.39, 0.33))
	_floor_patch(Vector3(0, 0.04, 0), Vector3(8, 0.045, WorldConfig.SIZE), Color(0.39, 0.39, 0.33))
	for i in range(-15, 16):
		_floor_patch(Vector3(i * 10, 0.068, 0), Vector3(4, 0.015, 0.16), Color(0.76, 0.73, 0.61))
		_floor_patch(Vector3(0, 0.069, i * 10), Vector3(0.16, 0.015, 4), Color(0.76, 0.73, 0.61))
	# Solid perimeter makes it impossible to leave the playable area.
	_static_box(Vector3(-MAP_HALF - 1, 2, 0), Vector3(2, 4, WorldConfig.SIZE + 4), Color(0.31, 0.40, 0.32), false)
	_static_box(Vector3(MAP_HALF + 1, 2, 0), Vector3(2, 4, WorldConfig.SIZE + 4), Color(0.31, 0.40, 0.32), false)
	_static_box(Vector3(0, 2, -MAP_HALF - 1), Vector3(WorldConfig.SIZE, 4, 2), Color(0.31, 0.40, 0.32), false)
	_static_box(Vector3(0, 2, MAP_HALF + 1), Vector3(WorldConfig.SIZE, 4, 2), Color(0.31, 0.40, 0.32), false)
	# VEER NAGAR: all buildings have an open front; their walls are real collision.
	_building(Vector3(-42, 0, -37), Vector2(11, 9), Color(0.78, 0.62, 0.43))
	_building(Vector3(-60, 0, -38), Vector2(9, 8), Color(0.67, 0.52, 0.40))
	_building(Vector3(-42, 0, -57), Vector2(10, 8), Color(0.78, 0.72, 0.54))
	_building(Vector3(-20, 0, -48), Vector2(9, 8), Color(0.67, 0.58, 0.43))
	# SURYA YARD: warehouses and colorful containers.
	_building(Vector3(43, 0, -51), Vector2(18, 12), Color(0.50, 0.56, 0.53), 4.2)
	_building(Vector3(64, 0, -26), Vector2(11, 10), Color(0.59, 0.56, 0.46), 3.5)
	for item in [[25,-27],[36,-25],[54,-31],[55,-14],[26,-56]]:
		_static_box(Vector3(item[0], 1.2, item[1]), Vector3(5, 2.4, 2.5), Color(0.35, 0.48, 0.46))
	# DESERT OUTPOST and a small fort-inspired courtyard.
	_building(Vector3(-47, 0, 47), Vector2(12, 10), Color(0.72, 0.54, 0.36), 3.2)
	_building(Vector3(-65, 0, 24), Vector2(9, 7), Color(0.69, 0.56, 0.39))
	_static_box(Vector3(-23, 1.3, 58), Vector3(18, 2.6, 0.7), Color(0.70, 0.51, 0.34))
	_static_box(Vector3(-32, 1.3, 52), Vector3(0.7, 2.6, 12), Color(0.70, 0.51, 0.34))
	_static_box(Vector3(-14, 1.3, 52), Vector3(0.7, 2.6, 12), Color(0.70, 0.51, 0.34))
	# GREEN VALLEY: cover, trees and an open-sided village shelter.
	_building(Vector3(46, 0, 45), Vector2(11, 9), Color(0.73, 0.69, 0.49))
	_building(Vector3(64, 0, 60), Vector2(8, 7), Color(0.64, 0.59, 0.45))
	for pos in [[17,20],[28,31],[51,22],[68,10],[24,61],[63,38],[-18,-18],[-69,-8],[-25,25],[12,-69],[-70,62]]:
		_tree(Vector3(pos[0], 0, pos[1]))
	for pos in [[-15,-20],[-29,-26],[-55,-18],[-64,-54],[18,-17],[27,-40],[48,-65],[-57,62],[-28,35],[-11,24],[17,43],[35,63],[68,27],[14,10]]:
		_static_box(Vector3(pos[0], 0.6, pos[1]), Vector3(2.0, 1.2, 1.5), Color(0.49, 0.42, 0.32))
	_build_outer_landmarks()
	_label("VEER NAGAR", Vector3(-42, 5.2, -32))
	_label("SURYA YARD", Vector3(43, 6, -44))
	_label("DESERT OUTPOST", Vector3(-47, 5.5, 53))
	_label("GREEN VALLEY", Vector3(46, 5, 51))

func _build_outer_landmarks() -> void:
	# Rang Bazaar: an open central lane, low stalls and colorful shopfronts.
	_floor_patch(Vector3(0, 0.02, -120), Vector3(52, 0.025, 40), Color(0.66, 0.56, 0.41))
	for x in [-17, 0, 17]:
		_building(Vector3(x, 0, -130), Vector2(9, 8), Color(0.73, 0.60, 0.46))
	for x in [-17, -9, 9, 17]:
		_static_box(Vector3(x, 0.55, -112), Vector3(3.8, 1.1, 1.6), Color(0.52, 0.38, 0.27))
		Factory.box(self, Vector3(4.2, 0.18, 2.0), Vector3(x, 2.3, -112), Color(0.82, 0.42, 0.25))
	_label("RANG BAZAAR", Vector3(0, 5.3, -118))

	# Kisan Farm: fields, sheds, low cover and open paths between plots.
	_floor_patch(Vector3(-115, 0.02, -105), Vector3(44, 0.025, 42), Color(0.56, 0.55, 0.32))
	_building(Vector3(-126, 0, -114), Vector2(9, 8), Color(0.72, 0.63, 0.44))
	_building(Vector3(-103, 0, -115), Vector2(10, 8), Color(0.62, 0.52, 0.36))
	for x in [-130, -121, -112, -103, -94]:
		_static_box(Vector3(x, 0.55, -95), Vector3(2.4, 1.1, 2.0), Color(0.72, 0.62, 0.34))
	_label("KISAN FARM", Vector3(-115, 5, -101))

	# Monsoon Depot: two sheds, containers and actual bullet-blocking cover.
	_floor_patch(Vector3(112, 0.02, -105), Vector3(48, 0.025, 44), Color(0.49, 0.49, 0.42))
	_building(Vector3(101, 0, -116), Vector2(14, 10), Color(0.48, 0.57, 0.55), 4.0)
	_building(Vector3(126, 0, -119), Vector2(12, 9), Color(0.56, 0.55, 0.48), 3.6)
	for pos in [[95, -97], [104, -97], [119, -99], [128, -97], [135, -105]]:
		_static_box(Vector3(pos[0], 1.2, pos[1]), Vector3(5, 2.4, 2.5), Color(0.34, 0.46, 0.47))
	_label("MONSOON DEPOT", Vector3(112, 5.7, -108))

	# Pipal Grove: small shelters and a deliberately walkable cluster of trees.
	_floor_patch(Vector3(-115, 0.02, 52), Vector3(44, 0.025, 42), Color(0.39, 0.52, 0.35))
	_building(Vector3(-123, 0, 43), Vector2(8, 7), Color(0.64, 0.60, 0.43))
	_building(Vector3(-103, 0, 39), Vector2(8, 7), Color(0.68, 0.61, 0.45))
	for pos in [[-132, 54], [-121, 60], [-111, 55], [-99, 62], [-96, 48]]:
		_tree(Vector3(pos[0], 0, pos[1]))
	_label("PIPAL GROVE", Vector3(-115, 5.2, 52))

	# Saffron Fort: a three-sided courtyard with a wide opening at the south.
	_floor_patch(Vector3(115, 0.02, 45), Vector3(42, 0.025, 40), Color(0.70, 0.58, 0.40))
	_static_box(Vector3(115, 1.3, 29), Vector3(32, 2.6, 0.7), Color(0.73, 0.48, 0.31))
	_static_box(Vector3(99, 1.3, 44), Vector3(0.7, 2.6, 30), Color(0.73, 0.48, 0.31))
	_static_box(Vector3(131, 1.3, 44), Vector3(0.7, 2.6, 30), Color(0.73, 0.48, 0.31))
	_static_box(Vector3(103, 1.3, 59), Vector3(8, 2.6, 0.7), Color(0.73, 0.48, 0.31))
	_static_box(Vector3(127, 1.3, 59), Vector3(8, 2.6, 0.7), Color(0.73, 0.48, 0.31))
	_building(Vector3(110, 0, 37), Vector2(8, 7), Color(0.79, 0.60, 0.40))
	_building(Vector3(122, 0, 38), Vector2(8, 7), Color(0.75, 0.55, 0.36))
	_label("SAFFRON FORT", Vector3(115, 5.5, 53))

	# Dakshin Watch has a collision-backed ramp to a usable elevated rooftop.
	_floor_patch(Vector3(0, 0.02, 120), Vector3(42, 0.025, 40), Color(0.55, 0.56, 0.44))
	_building(Vector3(0, 0, 118), Vector2(14, 12), Color(0.60, 0.61, 0.52), 3.4)
	_build_roof_ramp(Vector3(0, 0, 118), 3.645)
	_static_box(Vector3(-15, 0.6, 126), Vector3(3.0, 1.2, 2.0), Color(0.49, 0.42, 0.32))
	_static_box(Vector3(15, 0.6, 126), Vector3(3.0, 1.2, 2.0), Color(0.49, 0.42, 0.32))
	_label("DAKSHIN WATCH", Vector3(0, 6.0, 117))

func _build_roof_ramp(building: Vector3, roof_height: float) -> void:
	# Continue the ramp slightly over the roof edge. This avoids a vertical lip
	# catching the actor capsule before its center reaches the roof surface.
	var run := 10.6
	var thickness := 0.20
	var angle = atan2(roof_height, 10.0)
	var rise = tan(angle) * run
	var slope_length = sqrt(run * run + rise * rise)
	var ramp = StaticBody3D.new()
	ramp.name = "WatchRamp"
	ramp.position = building + Vector3(0, rise * 0.5 - cos(angle) * thickness * 0.5, 11.3)
	ramp.rotation.x = angle
	ramp.collision_layer = 1
	ramp.collision_mask = 0
	var shape = CollisionShape3D.new()
	var box = BoxShape3D.new()
	box.size = Vector3(3.6, thickness, slope_length)
	shape.shape = box
	ramp.add_child(shape)
	Factory.box(ramp, box.size, Vector3.ZERO, Color(0.49, 0.45, 0.37))
	add_child(ramp)

func _building(center: Vector3, size: Vector2, color: Color, height: float = 3.0) -> void:
	var wall = 0.45
	_static_box(center + Vector3(0, height / 2.0, -size.y / 2.0), Vector3(size.x, height, wall), color)
	_static_box(center + Vector3(-size.x / 2.0, height / 2.0, 0), Vector3(wall, height, size.y), color.darkened(0.07))
	_static_box(center + Vector3(size.x / 2.0, height / 2.0, 0), Vector3(wall, height, size.y), color.darkened(0.04))
	# Solid roof; the open front is the intended entrance.
	_static_box(center + Vector3(0, height + 0.12, 0), Vector3(size.x + 0.5, 0.25, size.y + 0.5), Color(0.42, 0.35, 0.29), false)
	Factory.box(self, Vector3(size.x + 0.5, 0.35, 0.18), center + Vector3(0, height - 0.15, size.y / 2.0), Color(0.80, 0.58, 0.34))

func _tree(center: Vector3) -> void:
	_static_box(center + Vector3(0, 1.1, 0), Vector3(0.8, 2.2, 0.8), Color(0.39, 0.31, 0.22))
	Factory.sphere(self, 1.9, center + Vector3(0, 3.5, 0), Color(0.31, 0.49, 0.32))
	Factory.sphere(self, 1.2, center + Vector3(1.0, 3.3, 0.1), Color(0.36, 0.55, 0.35))

func _label(text: String, pos: Vector3) -> void:
	var label = Label3D.new()
	label.text = text
	label.position = pos
	label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	label.font_size = 40
	label.pixel_size = 0.012
	label.modulate = Color(1, 0.91, 0.72, 0.9)
	label.outline_size = 8
	add_child(label)

func is_open(point: Vector3, margin: float = 1.2) -> bool:
	if absf(point.x) > MAP_HALF - margin or absf(point.z) > MAP_HALF - margin:
		return false
	var flat = Vector2(point.x, point.z)
	for rect in obstacles:
		if rect.grow(margin).has_point(flat):
			return false
	return true

func random_open_near(center: Vector2, radius: float = 17.0) -> Vector3:
	for attempt in 80:
		var angle = rng.randf_range(0.0, TAU)
		var distance = sqrt(rng.randf()) * radius
		var candidate = Vector3(center.x + cos(angle) * distance, 0.05, center.y + sin(angle) * distance)
		if is_open(candidate, 1.8):
			return candidate
	return random_open_position()

func random_open_position(min_distance_from: Vector3 = Vector3(10000, 0, 10000), min_distance: float = 0.0) -> Vector3:
	for attempt in 200:
		var candidate = Vector3(rng.randf_range(-MAP_HALF + 7, MAP_HALF - 7), 0.05, rng.randf_range(-MAP_HALF + 7, MAP_HALF - 7))
		if is_open(candidate, 1.8) and candidate.distance_to(min_distance_from) >= min_distance:
			return candidate
	return Vector3(10, 0.05, 10)
