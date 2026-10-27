extends RefCounted
## Optics affect actual ADS field of view and shot spread; they are not cosmetic labels.
const OPTICS = {
	"iron": {"name": "Iron", "rank": 0, "fov": 55.0, "spread": 0.72},
	"red_dot": {"name": "Red Dot", "rank": 1, "fov": 52.0, "spread": 0.65},
	"scope_2x": {"name": "2x Scope", "rank": 2, "fov": 36.0, "spread": 0.48},
	"scope_4x": {"name": "4x Scope", "rank": 3, "fov": 22.0, "spread": 0.36},
}
const LOOT_ORDER = ["red_dot", "scope_2x", "scope_4x"]

static func get_optic(id: String) -> Dictionary:
	return OPTICS.get(id, OPTICS.iron).duplicate(true)
