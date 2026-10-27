extends Control
signal again_requested
signal lobby_requested
signal training_requested
const Style = preload("res://scripts/ui/ui_style.gd")
var result: Dictionary = {}
var missions: Array = []

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var dim = ColorRect.new()
	dim.color = Color(0.02, 0.05, 0.05, 0.9)
	dim.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(dim)
	var center = CenterContainer.new()
	center.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(center)
	var panel = Style.panel()
	panel.custom_minimum_size = Vector2(720, 600)
	center.add_child(panel)
	var column = VBoxContainer.new()
	column.add_theme_constant_override("separation", 10)
	panel.add_child(column)
	var won = bool(result.get("victory", false))
	column.add_child(Style.label("VICTORY" if won else "MATCH COMPLETE", 35, Style.GOLD if won else Style.TEXT))
	column.add_child(Style.label("PLACEMENT  #%d   /   %s" % [int(result.get("placement", 0)), str(result.get("mode", "")).to_upper()], 17, Style.MUTED))
	var grid = GridContainer.new()
	grid.columns = 2
	grid.add_theme_constant_override("h_separation", 55)
	grid.add_theme_constant_override("v_separation", 14)
	column.add_child(grid)
	var survival = int(result.get("survival_time", 0))
	var fields = [
		["ELIMINATIONS", str(result.get("kills", 0))], ["HEADSHOTS", str(result.get("headshots", 0))],
		["ACCURACY", "%s%%" % str(result.get("accuracy", 0))], ["SURVIVAL", "%02d:%02d" % [survival / 60, survival % 60]],
		["DAMAGE DEALT", str(result.get("damage_dealt", 0))], ["DAMAGE RECEIVED", str(result.get("damage_received", 0))],
		["WALLS PLACED", str(result.get("walls", 0))], ["XP / COINS", "+%d / +%d" % [int(result.get("xp", 0)), int(result.get("currency", 0))]],
	]
	for field in fields:
		var item = VBoxContainer.new()
		item.custom_minimum_size.x = 290
		item.add_child(Style.label(field[0], 12, Style.MUTED))
		item.add_child(Style.label(field[1], 19, Style.TEXT))
		grid.add_child(item)
	var weapons: Array = result.get("weapons", [])
	column.add_child(Style.label("WEAPONS: " + (", ".join(weapons) if not weapons.is_empty() else "NONE"), 13, Style.MUTED))
	if not missions.is_empty():
		column.add_child(Style.label("MISSION COMPLETE: " + ", ".join(missions), 13, Style.GOLD))
	var spacer = Control.new()
	spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(spacer)
	var buttons = HBoxContainer.new()
	column.add_child(buttons)
	var again = Style.button("PLAY AGAIN", true)
	var lobby = Style.button("LOBBY")
	var training = Style.button("TRAINING")
	for button in [again, lobby, training]:
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		buttons.add_child(button)
	again.pressed.connect(func(): again_requested.emit())
	lobby.pressed.connect(func(): lobby_requested.emit())
	training.pressed.connect(func(): training_requested.emit())
