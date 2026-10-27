extends Control
## Original 3D operator preview and functional offline mode/collection screens.
signal start_requested(mode)
signal settings_requested

const Style = preload("res://scripts/ui/ui_style.gd")
const Factory = preload("res://scripts/actors/model_factory.gd")
const Characters = preload("res://scripts/data/characters.gd")
const Weapons = preload("res://scripts/data/weapons.gd")
const SaveScript = preload("res://scripts/core/save_manager.gd")

var save_manager
var preview_world: SubViewport
var preview_model: Node3D
var character_name: Label
var character_role: Label
var balance_label: Label
var modal: Control

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_build()

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.055, 0.12, 0.12))
	draw_colored_polygon(PackedVector2Array([Vector2(size.x * 0.35, 0), Vector2(size.x * 0.78, 0), Vector2(size.x * 0.62, size.y), Vector2(size.x * 0.23, size.y)]), Color(0.09, 0.21, 0.20))
	draw_colored_polygon(PackedVector2Array([Vector2(size.x * 0.69, 0), Vector2(size.x, 0), Vector2(size.x, size.y), Vector2(size.x * 0.55, size.y)]), Color(0.08, 0.16, 0.15))
	for i in 9:
		var y = 100 + i * 82
		draw_line(Vector2(0, y), Vector2(size.x, y - 130), Color(0.36, 0.49, 0.42, 0.09), 1)
	draw_rect(Rect2(54, 43, 5, 56), Style.GOLD)

func _process(delta: float) -> void:
	if is_instance_valid(preview_model):
		preview_model.rotation.y += delta * 0.24

func _build() -> void:
	var logo = TextureRect.new()
	logo.texture = load("res://assets/logo.svg")
	logo.position = Vector2(330, 30)
	logo.size = Vector2(64, 64)
	logo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	logo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	logo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(logo)
	_add_label("FREE FIRE", Vector2(72, 34), 31, Style.TEXT)
	_add_label("BHARAT", Vector2(72, 68), 24, Style.GOLD)
	_add_label("OFFLINE SURVIVAL  /  PROTOTYPE 01", Vector2(55, 154), 12, Style.MUTED)
	_add_label("DROP IN.  HOLD YOUR GROUND.", Vector2(55, 182), 18, Style.TEXT)
	_add_label("Choose an offline mode", Vector2(55, 215), 13, Style.MUTED)
	_add_button("BATTLE ROYALE   →", Rect2(55, 245, 340, 55), func(): start_requested.emit("battle"), true)
	_add_button("PRACTICE MATCH", Rect2(55, 309, 340, 50), func(): start_requested.emit("practice"))
	_add_button("TRAINING GROUND", Rect2(55, 368, 340, 50), func(): start_requested.emit("training"))
	_add_label("YOUR FIELD KIT", Vector2(55, 456), 12, Style.MUTED)
	_add_button("ARMORY", Rect2(55, 480, 164, 46), _open_armory)
	_add_button("STATISTICS", Rect2(230, 480, 165, 46), _open_stats)
	_add_button("MISSIONS", Rect2(55, 535, 164, 46), _open_missions)
	_add_button("SETTINGS", Rect2(230, 535, 165, 46), func(): settings_requested.emit())
	_add_button("EXIT GAME", Rect2(55, 590, 340, 44), func(): get_tree().quit())
	_add_label("ORIGINAL OFFLINE GAME  •  NO ACCOUNT", Vector2(55, 690), 11, Style.MUTED)
	_build_preview()
	var right = Control.new()
	right.anchor_left = 1.0
	right.anchor_right = 1.0
	right.offset_left = -318
	right.offset_right = -36
	right.offset_top = 42
	right.offset_bottom = 670
	add_child(right)
	balance_label = Style.label("", 14, Style.GOLD)
	balance_label.position = Vector2(0, 4)
	right.add_child(balance_label)
	var line = ColorRect.new()
	line.color = Color(0.38, 0.51, 0.45, 0.65)
	line.position = Vector2(0, 48)
	line.size = Vector2(282, 1)
	right.add_child(line)
	var tag = Style.label("SELECTED OPERATOR", 12, Style.MUTED)
	tag.position = Vector2(0, 77)
	right.add_child(tag)
	character_name = Style.label("", 30, Style.TEXT)
	character_name.position = Vector2(0, 108)
	right.add_child(character_name)
	character_role = Style.label("", 13, Style.GOLD)
	character_role.position = Vector2(0, 151)
	right.add_child(character_role)
	var note = Style.label("8 original operators and skills\nAll available offline", 14, Style.MUTED)
	note.position = Vector2(0, 202)
	right.add_child(note)
	var previous = Style.button("←  PREV")
	previous.position = Vector2(0, 295)
	previous.size = Vector2(134, 48)
	right.add_child(previous)
	previous.pressed.connect(_change_character.bind(-1))
	var next = Style.button("NEXT  →")
	next.position = Vector2(146, 295)
	next.size = Vector2(134, 48)
	right.add_child(next)
	next.pressed.connect(_change_character.bind(1))
	var detail = Style.label("BHARAT ISLAND\nA compact original test island\nwith destructible cover and AI.", 13, Style.MUTED)
	detail.position = Vector2(0, 390)
	right.add_child(detail)
	_refresh_character()

func _add_label(text: String, pos: Vector2, font_size: int, color: Color) -> Label:
	var item = Style.label(text, font_size, color)
	item.position = pos
	add_child(item)
	return item

func _add_button(text: String, rect: Rect2, callback: Callable, primary: bool = false) -> Button:
	var item = Style.button(text, primary)
	item.position = rect.position
	item.size = rect.size
	item.pressed.connect(callback)
	add_child(item)
	return item

func _build_preview() -> void:
	var holder = SubViewportContainer.new()
	holder.anchor_left = 0.5
	holder.anchor_right = 0.5
	holder.offset_left = -210
	holder.offset_right = 210
	holder.offset_top = 85
	holder.offset_bottom = 650
	holder.stretch = true
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(holder)
	preview_world = SubViewport.new()
	preview_world.size = Vector2i(420, 565)
	preview_world.transparent_bg = true
	preview_world.own_world_3d = true
	preview_world.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	holder.add_child(preview_world)
	var world = Node3D.new()
	preview_world.add_child(world)
	var environment = WorldEnvironment.new()
	var env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0, 0, 0, 0)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.76, 0.85, 0.75)
	env.ambient_light_energy = 1.0
	environment.environment = env
	world.add_child(environment)
	var light = DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-35, -35, 0)
	light.light_color = Color(1, 0.79, 0.52)
	light.light_energy = 1.4
	world.add_child(light)
	var camera = Camera3D.new()
	camera.position = Vector3(0, 1.55, 4.5)
	camera.fov = 34
	world.add_child(camera)
	camera.look_at(Vector3(0, 1.0, 0), Vector3.UP)
	camera.current = true
	preview_model = Factory.make_character(Characters.ROSTER[0])
	preview_model.position = Vector3(0, 0.08, 0)
	preview_model.rotation.y = -0.45
	world.add_child(preview_model)
	Factory.box(world, Vector3(2.2, 0.12, 2.2), Vector3(0, 0, 0), Color(0.14, 0.30, 0.27))

func _change_character(delta: int) -> void:
	save_manager.data.progress.character = posmod(int(save_manager.data.progress.character) + delta, Characters.ROSTER.size())
	save_manager.save_data()
	_refresh_character()

func refresh() -> void:
	_refresh_character()

func _refresh_character() -> void:
	var index = clampi(int(save_manager.data.progress.character), 0, Characters.ROSTER.size() - 1)
	var character = Characters.ROSTER[index]
	character_name.text = character.name
	character_role.text = character.role + "  /  " + character.ability_name + "\n" + character.ability_desc
	balance_label.text = "LEVEL %02d    ◆ %d" % [save_manager.level(), int(save_manager.data.progress.currency)]
	if is_instance_valid(preview_model):
		var parent = preview_model.get_parent()
		var rotation = preview_model.rotation
		parent.remove_child(preview_model)
		preview_model.queue_free()
		preview_model = Factory.make_character(character)
		preview_model.position = Vector3(0, 0.08, 0)
		preview_model.rotation = rotation
		parent.add_child(preview_model)

func _make_modal(title: String) -> VBoxContainer:
	if is_instance_valid(modal):
		modal.queue_free()
	modal = Control.new()
	modal.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	modal.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(modal)
	var dim = ColorRect.new()
	dim.color = Color(0.01, 0.03, 0.03, 0.83)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	modal.add_child(dim)
	var center = CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	modal.add_child(center)
	var panel = Style.panel()
	panel.custom_minimum_size = Vector2(680, 540)
	center.add_child(panel)
	var column = VBoxContainer.new()
	column.add_theme_constant_override("separation", 9)
	panel.add_child(column)
	column.add_child(Style.label(title, 26, Style.GOLD))
	return column

func _close_modal() -> void:
	if is_instance_valid(modal):
		modal.queue_free()
		modal = null
	_refresh_character()

func _close_button(column: VBoxContainer) -> void:
	var back = Style.button("BACK TO LOBBY")
	back.pressed.connect(_close_modal)
	column.add_child(back)

func _open_armory() -> void:
	var column = _make_modal("ARMORY  /  TRAINING LOADOUT")
	column.add_child(Style.label("Select the weapon you spawn with in Training. Battle modes start with a sidearm.", 13, Style.MUTED))
	var scroll = ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(620, 350)
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(scroll)
	var choices = VBoxContainer.new()
	choices.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	choices.add_theme_constant_override("separation", 6)
	scroll.add_child(choices)
	for id in Weapons.ORDER:
		var weapon = Weapons.get_data(id)
		var equipped = "  • SELECTED" if save_manager.data.progress.training_weapon == id else ""
		var option = Style.button("%s   |   DMG %d   |   MAG %d%s" % [weapon.name.to_upper(), int(weapon.damage), int(weapon.magazine), equipped])
		option.custom_minimum_size.y = 48
		option.pressed.connect(_select_training_weapon.bind(id))
		choices.add_child(option)
	_close_button(column)

func _select_training_weapon(id: String) -> void:
	save_manager.data.progress.training_weapon = id
	save_manager.save_data()
	_close_modal()

func _open_stats() -> void:
	var column = _make_modal("LIFETIME STATISTICS")
	var totals: Dictionary = save_manager.data.progress.totals
	column.add_child(Style.label("MATCHES  %d       WINS  %d       ELIMINATIONS  %d" % [totals.matches, totals.wins, totals.kills], 19, Style.TEXT))
	column.add_child(Style.label("HEADSHOTS  %d       DAMAGE  %d       WALLS  %d" % [totals.headshots, totals.damage, totals.walls], 16, Style.MUTED))
	column.add_child(Style.label("RECENT MATCHES", 14, Style.GOLD))
	var history: Array = save_manager.data.progress.history
	if history.is_empty():
		column.add_child(Style.label("No completed matches yet.", 15, Style.MUTED))
	else:
		for record in history.slice(0, 6):
			column.add_child(Style.label("%s  /  #%d  /  %d ELIMS  /  %d DAMAGE" % [str(record.get("mode", "match")).to_upper(), int(record.get("placement", 0)), int(record.get("kills", 0)), int(record.get("damage_dealt", 0))], 14, Style.TEXT))
	var spacer = Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(spacer)
	_close_button(column)

func _open_missions() -> void:
	var column = _make_modal("OFFLINE MISSIONS & ACHIEVEMENTS")
	column.add_child(Style.label("One-time local milestones. Rewards are granted automatically after a match.", 13, Style.MUTED))
	var progress: Dictionary = save_manager.data.progress
	for mission in SaveScript.MISSIONS:
		var value = mini(int(progress.totals[mission.key]), int(mission.goal))
		var status = "COMPLETED" if mission.id in progress.missions_claimed else "%d / %d" % [value, mission.goal]
		column.add_child(Style.label("%s   —   %s   |   +%d coins" % [mission.title, status, mission.reward], 16, Style.TEXT))
	var spacer = Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(spacer)
	_close_button(column)
