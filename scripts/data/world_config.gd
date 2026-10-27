extends RefCounted
## Shared dimensions for terrain, zone, minimap and navigation.
## This is an intermediate-size test island, not the requested 1.5 km map.
const HALF_SIZE := 160.0
const SIZE := HALF_SIZE * 2.0
const INITIAL_ZONE_RADIUS := HALF_SIZE - 4.0
const NAV_CELL_SIZE := 2.5
const NAV_GRID_WIDTH := 128

static func map_uv(point: Vector2) -> Vector2:
	return (point + Vector2(HALF_SIZE, HALF_SIZE)) / SIZE
