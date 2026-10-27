extends RefCounted
## Versioned local-only save. Invalid files are rejected; a last-good backup is tried.

const SAVE_VERSION = 1
const HudLayout = preload("res://scripts/data/hud_layout.gd")
const WeaponData = preload("res://scripts/data/weapons.gd")
const MISSIONS = [
	{"id": "eliminations", "title": "Eliminate 5 opponents", "key": "kills", "goal": 5, "reward": 100},
	{"id": "headshots", "title": "Land 3 headshots", "key": "headshots", "goal": 3, "reward": 100},
	{"id": "walls", "title": "Deploy 5 Gloo Walls", "key": "walls", "goal": 5, "reward": 100},
	{"id": "winner", "title": "Win a match", "key": "wins", "goal": 1, "reward": 150},
	{"id": "damage", "title": "Deal 1,000 damage", "key": "damage", "goal": 1000, "reward": 100},
]

var path: String = "user://free_fire_bharat_save.json"
var data: Dictionary = defaults()

static func default_settings() -> Dictionary:
	return {"sensitivity": 100.0, "ads_sensitivity": 80.0, "aim_assist": true,
		"auto_pickup": true, "left_handed": false, "invert_y": false,
		"damage_numbers": true, "quality": "BALANCED", "fps": 30,
		"volume": 75.0, "button_size": 100.0, "button_opacity": 70.0, "bot_count": 10, "difficulty": "NORMAL",
		"hud_positions": HudLayout.default_positions()}

static func defaults() -> Dictionary:
	return {"version": SAVE_VERSION, "settings": default_settings(),
		"progress": {"xp": 0, "currency": 0, "character": 0, "training_weapon": "ar_01",
			"totals": {"matches": 0, "wins": 0, "kills": 0, "headshots": 0, "damage": 0, "walls": 0},
			"missions_claimed": [], "history": []}}

func _init(custom_path: String = "") -> void:
	if not custom_path.is_empty():
		path = custom_path

func load_data() -> Dictionary:
	var candidate = _read(path)
	if candidate.is_empty():
		candidate = _read(path + ".bak")
	data = defaults()
	if not candidate.is_empty():
		_merge_validated(data, candidate)
	_validate()
	return data

func _read(file_path: String) -> Dictionary:
	if not FileAccess.file_exists(file_path):
		return {}
	var file = FileAccess.open(file_path, FileAccess.READ)
	if file == null:
		return {}
	var json = JSON.new()
	if json.parse(file.get_as_text()) != OK:
		return {}
	var parsed = json.data
	if typeof(parsed) != TYPE_DICTIONARY:
		return {}
	var version = parsed.get("version", -1)
	if typeof(version) not in [TYPE_INT, TYPE_FLOAT] or int(version) != SAVE_VERSION:
		return {}
	return parsed

func _merge_validated(target: Dictionary, source: Dictionary) -> void:
	for key in target:
		if not source.has(key):
			continue
		var expected = target[key]
		var incoming = source[key]
		if expected is Dictionary and incoming is Dictionary:
			_merge_validated(expected, incoming)
		elif (typeof(expected) == TYPE_FLOAT or typeof(expected) == TYPE_INT) and (typeof(incoming) == TYPE_FLOAT or typeof(incoming) == TYPE_INT):
			target[key] = incoming
		elif typeof(expected) == typeof(incoming):
			target[key] = incoming

func _validate() -> void:
	var s: Dictionary = data.settings
	for key in ["sensitivity", "ads_sensitivity"]:
		s[key] = clampf(float(s[key]), 0.0, 200.0)
	s.volume = clampf(float(s.volume), 0.0, 100.0)
	s.button_size = clampf(float(s.button_size), 75.0, 125.0)
	s.button_opacity = clampf(float(s.button_opacity), 25.0, 100.0)
	s.bot_count = clampi(int(s.bot_count), 3, 49)
	var positions: Dictionary = s.hud_positions
	var defaults = HudLayout.default_positions()
	for key in defaults:
		var point = positions.get(key, defaults[key])
		if typeof(point) != TYPE_ARRAY or point.size() != 2 or typeof(point[0]) not in [TYPE_INT, TYPE_FLOAT] or typeof(point[1]) not in [TYPE_INT, TYPE_FLOAT]:
			positions[key] = defaults[key]
		else:
			positions[key] = [clampf(float(point[0]), 20.0, 1260.0), clampf(float(point[1]), 20.0, 700.0)]
	if not int(s.fps) in [30, 45, 60]:
		s.fps = 30
	if not s.difficulty in ["EASY", "NORMAL", "HARD", "EXPERT"]:
		s.difficulty = "NORMAL"
	if not s.quality in ["LOW", "BALANCED", "HIGH"]:
		s.quality = "BALANCED"
	var p: Dictionary = data.progress
	p.xp = maxi(0, int(p.xp))
	p.currency = maxi(0, int(p.currency))
	p.character = clampi(int(p.character), 0, 7)
	if not p.training_weapon in WeaponData.DEFINITIONS:
		p.training_weapon = "ar_01"
	for key in p.totals:
		p.totals[key] = maxi(0, int(p.totals[key]))
	# Never trust arbitrary JSON members in UI or arithmetic.
	p.missions_claimed = p.missions_claimed.filter(func(v): return typeof(v) == TYPE_STRING).slice(0, 50)
	var clean_history: Array = []
	for entry in p.history:
		if typeof(entry) != TYPE_DICTIONARY:
			continue
		var record := {"mode": "match", "victory": false, "weapons": [], "accuracy": 0.0}
		if typeof(entry.get("mode")) == TYPE_STRING:
			record.mode = str(entry.mode).left(24)
		if typeof(entry.get("victory")) == TYPE_BOOL:
			record.victory = entry.victory
		for field in ["placement", "kills", "headshots", "shots", "hits", "damage_dealt", "damage_received", "survival_time", "walls", "xp", "currency"]:
			var value = entry.get(field, 0)
			record[field] = maxi(0, int(value)) if typeof(value) in [TYPE_INT, TYPE_FLOAT] else 0
		var accuracy = entry.get("accuracy", 0.0)
		if typeof(accuracy) in [TYPE_INT, TYPE_FLOAT]:
			record.accuracy = clampf(float(accuracy), 0.0, 100.0)
		var weapons = entry.get("weapons", [])
		if typeof(weapons) == TYPE_ARRAY:
			for weapon in weapons:
				if typeof(weapon) == TYPE_STRING and record.weapons.size() < 6:
					record.weapons.append(str(weapon).left(48))
		clean_history.append(record)
		if clean_history.size() >= 20:
			break
	p.history = clean_history

func save_data() -> bool:
	_validate()
	var temp_path = path + ".tmp"
	var file = FileAccess.open(temp_path, FileAccess.WRITE)
	if file == null:
		push_warning("Could not write local save: %s" % FileAccess.get_open_error())
		return false
	file.store_string(JSON.stringify(data, "\t"))
	file.flush()
	file.close()
	var absolute = ProjectSettings.globalize_path(path)
	# Only preserve a parsed, valid old save as a backup; never replace a good backup with corruption.
	if not _read(path).is_empty():
		DirAccess.copy_absolute(absolute, ProjectSettings.globalize_path(path + ".bak"))
	var err = DirAccess.rename_absolute(ProjectSettings.globalize_path(temp_path), absolute)
	if err != OK:
		push_warning("Could not replace local save: %s" % err)
		return false
	return true

func reset_settings() -> void:
	data.settings = default_settings()
	save_data()

func reset_progress() -> void:
	data.progress = defaults().progress
	if save_data():
		# A later corruption recovery must not resurrect progress the player erased.
		DirAccess.copy_absolute(ProjectSettings.globalize_path(path), ProjectSettings.globalize_path(path + ".bak"))

func level() -> int:
	return 1 + int(data.progress.xp) / 500

func record_match(result: Dictionary) -> Array:
	var p: Dictionary = data.progress
	var t: Dictionary = p.totals
	t.matches += 1
	if result.get("victory", false):
		t.wins += 1
	t.kills += int(result.get("kills", 0))
	t.headshots += int(result.get("headshots", 0))
	t.damage += int(result.get("damage_dealt", 0))
	t.walls += int(result.get("walls", 0))
	p.xp += int(result.get("xp", 0))
	p.currency += int(result.get("currency", 0))
	p.history.push_front(result.duplicate(true))
	p.history = p.history.slice(0, 20)
	var unlocked: Array = []
	for mission in MISSIONS:
		if mission.id not in p.missions_claimed and int(t[mission.key]) >= mission.goal:
			p.missions_claimed.append(mission.id)
			p.currency += mission.reward
			unlocked.append(mission.title)
	save_data()
	return unlocked
