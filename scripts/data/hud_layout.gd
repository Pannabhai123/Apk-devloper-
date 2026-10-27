extends RefCounted
## Right-handed coordinates in the 1280×720 reference canvas.
const DEFAULTS = {
	"pause": Vector3(35, 35, 23),
	"fire": Vector3(1134, 478, 61),
	"jump": Vector3(1210, 575, 33),
	"crouch": Vector3(1202, 378, 32),
	"scope": Vector3(1050, 571, 33),
	"reload": Vector3(1136, 641, 31),
	"switch": Vector3(1036, 649, 31),
	"wall": Vector3(956, 564, 38),
	"heal": Vector3(876, 650, 31),
	"interact": Vector3(865, 556, 35),
	"grenade": Vector3(775, 552, 32),
	"ability": Vector3(680, 552, 32),
	"cancel_wall": Vector3(957, 485, 24),
	"joystick": Vector3(134, 569, 73),
}
const LABELS = {
	"pause": "PAUSE", "fire": "FIRE", "jump": "JUMP", "crouch": "CROUCH", "scope": "AIM",
	"reload": "RELOAD", "switch": "SWAP", "wall": "WALL", "heal": "HEAL", "interact": "PICK",
	"grenade": "FRAG", "ability": "SKILL", "cancel_wall": "CANCEL", "joystick": "MOVE",
}

static func default_positions() -> Dictionary:
	var result := {}
	for key in DEFAULTS:
		var point: Vector3 = DEFAULTS[key]
		result[key] = [point.x, point.y]
	return result

static func compact_positions() -> Dictionary:
	var result = default_positions()
	for key in result:
		if key == "joystick":
			result[key][0] += 28.0
		elif key != "pause":
			result[key][0] -= 28.0
	return result

static func geometry(key: String, settings: Dictionary, positions: Dictionary = {}) -> Vector3:
	var p: Vector3 = DEFAULTS[key]
	var point = positions.get(key, [])
	if typeof(point) == TYPE_ARRAY and point.size() == 2 and typeof(point[0]) in [TYPE_INT, TYPE_FLOAT] and typeof(point[1]) in [TYPE_INT, TYPE_FLOAT]:
		p.x = float(point[0])
		p.y = float(point[1])
	if bool(settings.get("left_handed", false)) and key != "pause":
		p.x = 1280.0 - p.x
	p.z *= float(settings.get("button_size", 100.0)) / 100.0
	return p
