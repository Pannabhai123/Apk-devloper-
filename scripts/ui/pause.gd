extends Control
signal resume_requested
signal restart_requested
signal settings_requested
signal lobby_requested
const Style = preload("res://scripts/ui/ui_style.gd")

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var dim = ColorRect.new()
	dim.color = Color(0.01, 0.03, 0.03, 0.82)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(dim)
	var center = CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var panel = Style.panel()
	panel.custom_minimum_size = Vector2(440, 410)
	center.add_child(panel)
	var column = VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	panel.add_child(column)
	column.add_child(Style.label("MATCH PAUSED", 27, Style.GOLD))
	column.add_child(Style.label("Offline. Your match is frozen until you resume.", 13, Style.MUTED))
	var resume = Style.button("RESUME", true)
	var restart = Style.button("RESTART MATCH")
	var settings = Style.button("SETTINGS")
	var lobby = Style.button("RETURN TO LOBBY")
	for item in [resume, restart, settings, lobby]:
		column.add_child(item)
	resume.pressed.connect(func(): resume_requested.emit())
	restart.pressed.connect(func(): restart_requested.emit())
	settings.pressed.connect(func(): settings_requested.emit())
	lobby.pressed.connect(func(): lobby_requested.emit())
