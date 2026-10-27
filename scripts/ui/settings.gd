extends Control
signal closed
signal changed
signal edit_layout_requested
const Style = preload("res://scripts/ui/ui_style.gd")
var save_manager
var content: VBoxContainer
var confirm_reset: ConfirmationDialog

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_build()

func _build() -> void:
	for child in get_children():
		child.queue_free()
	var dim = ColorRect.new()
	dim.color = Color(0.01, 0.03, 0.03, 0.83)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(dim)
	var center = CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var panel = Style.panel()
	panel.custom_minimum_size = Vector2(700, 640)
	center.add_child(panel)
	var main = VBoxContainer.new()
	main.add_theme_constant_override("separation", 10)
	panel.add_child(main)
	main.add_child(Style.label("SETTINGS", 27, Style.GOLD))
	main.add_child(Style.label("Changes apply locally. No network or account required.", 13, Style.MUTED))
	var scroll = ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(650, 460)
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	main.add_child(scroll)
	content = VBoxContainer.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	content.add_theme_constant_override("separation", 8)
	scroll.add_child(content)
	_section("CONTROLS & AIM")
	_slider("Camera sensitivity", "sensitivity", 0, 200, 1)
	_slider("Aim-down-sights sensitivity", "ads_sensitivity", 0, 200, 1)
	_toggle("Aim assist (gentle torso correction)", "aim_assist")
	_toggle("Automatic pickup", "auto_pickup")
	_toggle("Left-handed touch layout", "left_handed")
	_toggle("Invert vertical look", "invert_y")
	_slider("Touch button size %", "button_size", 75, 125, 5)
	_slider("Touch button opacity %", "button_opacity", 25, 100, 5)
	_toggle("Show damage numbers", "damage_numbers")
	_section("PERFORMANCE & MATCH")
	_choice("Graphics preset", "quality", ["LOW", "BALANCED", "HIGH"])
	_choice("Frame cap", "fps", [30, 45, 60])
	_slider("Bots next match (practice max 15)", "bot_count", 3, 49, 1)
	_choice("Bot difficulty", "difficulty", ["EASY", "NORMAL", "HARD", "EXPERT"])
	_section("AUDIO")
	_slider("Master effects volume %", "volume", 0, 100, 1)
	main.add_child(Style.label("LOW uses 70% 3D resolution and no shadows; BALANCED 85%; HIGH 100% with shadows.", 12, Style.MUTED))
	var edit_layout = Style.button("CUSTOMIZE TOUCH LAYOUT")
	main.add_child(edit_layout)
	edit_layout.pressed.connect(func(): edit_layout_requested.emit())
	var buttons = HBoxContainer.new()
	main.add_child(buttons)
	var reset_settings = Style.button("RESET SETTINGS")
	var reset_progress = Style.button("RESET PROGRESS")
	var close_button = Style.button("SAVE & CLOSE", true)
	for button in [reset_settings, reset_progress, close_button]:
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		buttons.add_child(button)
	reset_settings.pressed.connect(_reset_settings)
	reset_progress.pressed.connect(_confirm_progress_reset)
	close_button.pressed.connect(_close)
	confirm_reset = ConfirmationDialog.new()
	confirm_reset.title = "Reset local progress?"
	confirm_reset.dialog_text = "This permanently clears local match history, currency, missions and character selection. Settings are kept."
	confirm_reset.confirmed.connect(_reset_progress)
	add_child(confirm_reset)

func _section(title: String) -> void:
	var label = Style.label(title, 15, Style.GOLD)
	label.custom_minimum_size.y = 34
	content.add_child(label)

func _row(title: String) -> HBoxContainer:
	var row = HBoxContainer.new()
	row.custom_minimum_size.y = 38
	row.add_theme_constant_override("separation", 10)
	var text = Style.label(title, 15, Style.TEXT)
	text.custom_minimum_size.x = 325
	text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(text)
	content.add_child(row)
	return row

func _slider(title: String, key: String, minimum: float, maximum: float, step: float) -> void:
	var row = _row(title)
	var slider = HSlider.new()
	slider.min_value = minimum
	slider.max_value = maximum
	slider.step = step
	slider.value = float(save_manager.data.settings[key])
	slider.custom_minimum_size.x = 190
	row.add_child(slider)
	var number = Style.label(str(int(slider.value)), 14, Style.GOLD)
	number.custom_minimum_size.x = 38
	row.add_child(number)
	slider.value_changed.connect(_on_slider.bind(key, number))

func _on_slider(value: float, key: String, label: Label) -> void:
	save_manager.data.settings[key] = int(value) if key == "bot_count" else value
	label.text = str(int(value))
	changed.emit()

func _toggle(title: String, key: String) -> void:
	var row = _row(title)
	var checkbox = CheckButton.new()
	checkbox.button_pressed = bool(save_manager.data.settings[key])
	row.add_child(checkbox)
	checkbox.toggled.connect(_on_toggle.bind(key))

func _on_toggle(value: bool, key: String) -> void:
	save_manager.data.settings[key] = value
	changed.emit()

func _choice(title: String, key: String, values: Array) -> void:
	var row = _row(title)
	var options = OptionButton.new()
	options.custom_minimum_size.x = 170
	for value in values:
		options.add_item(str(value))
	var selected = values.find(save_manager.data.settings[key])
	options.select(maxi(0, selected))
	row.add_child(options)
	options.item_selected.connect(_on_choice.bind(key, values))

func _on_choice(index: int, key: String, values: Array) -> void:
	save_manager.data.settings[key] = values[index]
	changed.emit()

func _reset_settings() -> void:
	save_manager.reset_settings()
	changed.emit()
	_build()

func _confirm_progress_reset() -> void:
	confirm_reset.popup_centered()

func _reset_progress() -> void:
	save_manager.reset_progress()

func _close() -> void:
	save_manager.save_data()
	closed.emit()
	queue_free()
