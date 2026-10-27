extends Node
## Shared, bounded-cost grid navigation for the procedural island.
## Static geometry is rasterized once; ground-level Gloo Walls update cells dynamically.
const WorldConfig = preload("res://scripts/data/world_config.gd")
const Wall = preload("res://scripts/world/gloo_wall.gd")
const CELL_SIZE := WorldConfig.NAV_CELL_SIZE
const MAP_HALF := WorldConfig.HALF_SIZE
const GRID_WIDTH := WorldConfig.NAV_GRID_WIDTH
const PATHS_PER_PHYSICS_FRAME := 4
const CLEARANCE := 1.30

var map: Node3D
var grid := AStarGrid2D.new()
var remaining_requests := PATHS_PER_PHYSICS_FRAME
var static_cells := PackedByteArray()
var dynamic_counts: Dictionary = {}
var wall_cells: Dictionary = {}
var revision := 0

func _ready() -> void:
	grid.region = Rect2i(0, 0, GRID_WIDTH, GRID_WIDTH)
	grid.cell_size = Vector2(CELL_SIZE, CELL_SIZE)
	grid.offset = Vector2(-MAP_HALF + CELL_SIZE * 0.5, -MAP_HALF + CELL_SIZE * 0.5)
	grid.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	grid.update()
	# Rasterize each obstacle's bounded rectangle instead of testing every cell
	# against every building. Cell centers match MapBuilder.is_open exactly.
	for obstacle in map.obstacles:
		var bounds: Rect2 = obstacle.grow(CLEARANCE)
		var first = _id_for(Vector3(bounds.position.x, 0, bounds.position.y))
		var last = _id_for(Vector3(bounds.end.x, 0, bounds.end.y))
		for x in range(first.x, last.x + 1):
			for z in range(first.y, last.y + 1):
				var id = Vector2i(x, z)
				if bounds.has_point(grid.get_point_position(id)):
					grid.set_point_solid(id, true)
	# Honor the same map-edge clearance as MapBuilder.is_open.
	for i in GRID_WIDTH:
		for id in [Vector2i(0, i), Vector2i(GRID_WIDTH - 1, i), Vector2i(i, 0), Vector2i(i, GRID_WIDTH - 1)]:
			var point = grid.get_point_position(id)
			if absf(point.x) > MAP_HALF - CLEARANCE or absf(point.y) > MAP_HALF - CLEARANCE:
				grid.set_point_solid(id, true)
	static_cells.resize(GRID_WIDTH * GRID_WIDTH)
	for x in GRID_WIDTH:
		for z in GRID_WIDTH:
			static_cells[x * GRID_WIDTH + z] = 1 if grid.is_point_solid(Vector2i(x, z)) else 0

func add_wall(wall: Node3D) -> void:
	# The grid models ground paths only. A rooftop wall must not block the floor
	# below it; local probes still see cover on upper surfaces.
	if not is_instance_valid(wall) or wall.global_position.y > 0.75:
		return
	var key = wall.get_instance_id()
	if wall_cells.has(key):
		return
	var center = wall.global_position
	var yaw = wall.global_rotation.y
	var half_width = Wall.WIDTH * 0.5 + CLEARANCE
	var half_depth = Wall.DEPTH * 0.5 + CLEARANCE
	var extent = sqrt(half_width * half_width + half_depth * half_depth)
	var first = _id_for(center - Vector3(extent, 0, extent))
	var last = _id_for(center + Vector3(extent, 0, extent))
	var cells: Array[Vector2i] = []
	for x in range(first.x, last.x + 1):
		for z in range(first.y, last.y + 1):
			var id = Vector2i(x, z)
			var point = grid.get_point_position(id)
			var local = Vector3(point.x - center.x, 0, point.y - center.z).rotated(Vector3.UP, -yaw)
			if absf(local.x) <= half_width and absf(local.z) <= half_depth:
				cells.append(id)
				dynamic_counts[id] = int(dynamic_counts.get(id, 0)) + 1
				grid.set_point_solid(id, true)
	wall_cells[key] = cells
	wall.destroyed.connect(_on_wall_destroyed)
	wall.tree_exiting.connect(_remove_wall.bind(key))
	if not cells.is_empty():
		revision += 1

func _on_wall_destroyed(wall: Node3D) -> void:
	_remove_wall(wall.get_instance_id())

func _remove_wall(key: int) -> void:
	if not wall_cells.has(key):
		return
	var cells: Array = wall_cells[key]
	wall_cells.erase(key)
	for id in cells:
		var count = int(dynamic_counts[id]) - 1
		if count > 0:
			dynamic_counts[id] = count
		else:
			dynamic_counts.erase(id)
			grid.set_point_solid(id, static_cells[id.x * GRID_WIDTH + id.y] != 0)
	if not cells.is_empty():
		revision += 1

func _physics_process(_delta: float) -> void:
	remaining_requests = PATHS_PER_PHYSICS_FRAME

func _id_for(point: Vector3) -> Vector2i:
	return Vector2i(clampi(int(floor((point.x + MAP_HALF) / CELL_SIZE)), 0, GRID_WIDTH - 1),
		clampi(int(floor((point.z + MAP_HALF) / CELL_SIZE)), 0, GRID_WIDTH - 1))

func _nearest_open(id: Vector2i) -> Vector2i:
	if not grid.is_point_solid(id):
		return id
	# A destination can be inside cover. Search bounded neighboring rings.
	for radius in range(1, 9):
		var best = Vector2i(-1, -1)
		var best_distance = 100000
		for dx in range(-radius, radius + 1):
			for dz in range(-radius, radius + 1):
				if maxi(absi(dx), absi(dz)) != radius:
					continue
				var candidate = id + Vector2i(dx, dz)
				if grid.is_in_boundsv(candidate) and not grid.is_point_solid(candidate):
					var dist = dx * dx + dz * dz
					if dist < best_distance:
						best = candidate
						best_distance = dist
		if best.x >= 0:
			return best
	return Vector2i(-1, -1)

func find_path(from: Vector3, to: Vector3) -> Array[Vector3]:
	var result: Array[Vector3] = []
	var start = _nearest_open(_id_for(from))
	var goal = _nearest_open(_id_for(to))
	if start.x < 0 or goal.x < 0:
		return result
	var points = grid.get_point_path(start, goal, true)
	for point in points:
		result.append(Vector3(point.x, 0.05, point.y))
	return result

func request_path(from: Vector3, to: Vector3):
	# null means "try again later"; an empty Array means no route was found.
	if remaining_requests <= 0:
		return null
	remaining_requests -= 1
	return find_path(from, to)
