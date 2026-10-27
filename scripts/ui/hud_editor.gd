extends Control
## Drag touch controls on the same virtual canvas used by the in-match HUD.
signal closed(saved)
const Layout = preload("res://scripts/data/hud_layout.gd")
const Style = preload("res://scripts/ui/ui_style.gd")
var save_manager
var working_positions: Dictionary = {}
var selected := ""
var pointer := -99
var drag_offset := Vector2.ZERO
var toolbar: HBoxContainer

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	working_positions = save_manager.data.settings.hud_positions.duplicate(true)
	toolbar = HBoxContainer.new()
	toolbar.add_theme_constant_override("separation", 6)
	add_child(toolbar)
	for item in [["DEFAULT", _default], ["COMPACT", _compact], ["CANCEL", _cancel], ["SAVE LAYOUT", _save]]:
		var button = Style.button(item[0], item[0] == "SAVE LAYOUT")
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.pressed.connect(item[1])
		toolbar.add_child(button)
	_place_toolbar()

func _notification(what: int) -> void:
	if what == NOTIFICATION_RESIZED and is_instance_valid(toolbar):
		_place_toolbar()

func _scale_factor() -> float:
	return maxf(0.001, minf(size.x / 1280.0, size.y / 720.0))

func _offset() -> Vector2:
	return (size - Vector2(1280, 720) * _scale_factor()) / 2.0

func _screen_pos(v: Vector2) -> Vector2:
	return _offset() + v * _scale_factor()

func _virtual_pos(v: Vector2) -> Vector2:
	return (v - _offset()) / _scale_factor()

func _place_toolbar() -> void:
	toolbar.position = _screen_pos(Vector2(470, 12))
	toolbar.size = Vector2(790, 50) * _scale_factor()

func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			_begin_drag(event.index, _virtual_pos(event.position))
		else:
			_end_drag(event.index)
	elif event is InputEventScreenDrag and event.index == pointer:
		_drag_to(_virtual_pos(event.position))
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			_begin_drag(-2, _virtual_pos(event.position))
		else:
			_end_drag(-2)
	elif event is InputEventMouseMotion and pointer == -2:
		_drag_to(_virtual_pos(event.position))

func _begin_drag(index: int, point: Vector2) -> void:
	if pointer != -99 or point.y < 80:
		return
	var nearest := ""
	var best := 2.0
	for key in Layout.DEFAULTS:
		if key == "pause":
			continue # fixed so the toolbar and pause remain reachable
		var p = Layout.geometry(key, save_manager.data.settings, working_positions)
		var ratio = point.distance_to(Vector2(p.x, p.y)) / (p.z + 8.0)
		if ratio <= 1.0 and ratio < best:
			best = ratio
			nearest = key
	if not nearest.is_empty():
		selected = nearest
		pointer = index
		var p = Layout.geometry(selected, save_manager.data.settings, working_positions)
		drag_offset = point - Vector2(p.x, p.y)
		queue_redraw()

func _drag_to(point: Vector2) -> void:
	if selected.is_empty():
		return
	var current = Layout.geometry(selected, save_manager.data.settings, working_positions)
	var candidate = point - drag_offset
	candidate.x = clampf(candidate.x, current.z + 3.0, 1277.0 - current.z)
	candidate.y = clampf(candidate.y, 82.0 + current.z, 717.0 - current.z)
	# Prevent two centers from occupying the same place, which would make a button unusable.
	for key in Layout.DEFAULTS:
		if key == selected:
			continue
		var other = Layout.geometry(key, save_manager.data.settings, working_positions)
		if candidate.distance_to(Vector2(other.x, other.y)) < maxf(current.z, other.z) * 0.80:
			return
	var stored_x = 1280.0 - candidate.x if bool(save_manager.data.settings.left_handed) else candidate.x
	working_positions[selected] = [stored_x, candidate.y]
	queue_redraw()

func _end_drag(index: int) -> void:
	if pointer == index:
		selected = ""
		pointer = -99
		queue_redraw()

func _default() -> void:
	working_positions = Layout.default_positions()
	selected = ""
	pointer = -99
	queue_redraw()

func _compact() -> void:
	working_positions = Layout.compact_positions()
	selected = ""
	pointer = -99
	queue_redraw()

func _cancel() -> void:
	closed.emit(false)
	queue_free()

func _save() -> void:
	save_manager.data.settings.hud_positions = working_positions.duplicate(true)
	save_manager.save_data()
	closed.emit(true)
	queue_free()

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.02, 0.06, 0.06, 0.96))
	var font = ThemeDB.fallback_font
	var factor = _scale_factor()
	draw_string(font, _screen_pos(Vector2(25, 31)), "TOUCH LAYOUT", HORIZONTAL_ALIGNMENT_LEFT, -1, int(21 * factor), Style.GOLD)
	draw_string(font, _screen_pos(Vector2(25, 56)), "Drag controls; SAVE applies, CANCEL discards.", HORIZONTAL_ALIGNMENT_LEFT, -1, int(12 * factor), Style.TEXT)
	for key in Layout.DEFAULTS:
		var p = Layout.geometry(key, save_manager.data.settings, working_positions)
		var center = _screen_pos(Vector2(p.x, p.y))
		var radius = p.z * factor
		var color = Color(0.89, 0.48, 0.22, 0.72) if key == "fire" else Color(0.15, 0.44, 0.40, 0.78)
		if key == "pause":
			color = Color(0.24, 0.27, 0.25, 0.65)
		draw_circle(center, radius, color)
		draw_arc(center, radius, 0, TAU, 36, Style.GOLD if key == selected else Style.TEXT, 2.0 * factor)
		var font_size = int((13 if key == "fire" or key == "joystick" else 10) * factor)
		draw_string(font, center + Vector2(-radius, font_size * 0.35), Layout.LABELS[key], HORIZONTAL_ALIGNMENT_CENTER, radius * 2, font_size, Style.TEXT)
