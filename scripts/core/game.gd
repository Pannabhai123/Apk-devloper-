extends Node
## Top-level lifecycle, local save, scene transitions and pause handling.
const SaveManager = preload("res://scripts/core/save_manager.gd")
const AudioManager = preload("res://scripts/core/audio_manager.gd")
const MatchController = preload("res://scripts/core/match_controller.gd")
const Lobby = preload("res://scripts/ui/lobby.gd")
const HUD = preload("res://scripts/ui/hud.gd")
const Pause = preload("res://scripts/ui/pause.gd")
const Results = preload("res://scripts/ui/results.gd")
const Settings = preload("res://scripts/ui/settings.gd")
const HudEditor = preload("res://scripts/ui/hud_editor.gd")

var save_manager = SaveManager.new()
var audio: Node
var current: Node
var match_game: Node3D
var hud_layer: CanvasLayer
var hud: Control
var overlay: Control
var settings_overlay: Control
var hud_editor: Control
var current_mode := "practice"

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	save_manager.load_data()
	audio = AudioManager.new()
	add_child(audio)
	_apply_settings()
	_show_lobby()

func _apply_settings() -> void:
	var s: Dictionary = save_manager.data.settings
	Engine.max_fps = int(s.fps)
	get_viewport().scaling_3d_scale = {"LOW": 0.7, "BALANCED": 0.85, "HIGH": 1.0}.get(s.quality, 0.85)
	if is_instance_valid(audio):
		audio.configure(s)
	if is_instance_valid(match_game):
		match_game.settings = s.duplicate(true)
		match_game.player.settings = match_game.settings
		match_game.map.apply_quality(s.quality)
		for bot in match_game.bots:
			if is_instance_valid(bot):
				bot.difficulty = str(s.difficulty)
		if is_instance_valid(hud):
			hud.settings = match_game.settings

func _remove(node: Node) -> void:
	if is_instance_valid(node):
		if node.get_parent() != null:
			node.get_parent().remove_child(node)
		node.queue_free()

func _clear_screens() -> void:
	get_tree().paused = false
	_remove(hud_editor)
	_remove(settings_overlay)
	_remove(overlay)
	_remove(hud_layer)
	_remove(current)
	hud_editor = null
	settings_overlay = null
	overlay = null
	hud_layer = null
	hud = null
	current = null
	match_game = null
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE

func _show_lobby() -> void:
	_clear_screens()
	var lobby = Lobby.new()
	lobby.save_manager = save_manager
	lobby.start_requested.connect(_start_match)
	lobby.settings_requested.connect(_open_settings)
	current = lobby
	add_child(lobby)

func _start_match(mode: String) -> void:
	_clear_screens()
	current_mode = mode
	match_game = MatchController.new()
	match_game.setup(mode, save_manager.data, audio)
	match_game.finished.connect(_on_match_finished)
	current = match_game
	add_child(match_game)
	hud_layer = CanvasLayer.new()
	hud_layer.process_mode = Node.PROCESS_MODE_PAUSABLE
	add_child(hud_layer)
	hud = HUD.new()
	hud.match_game = match_game
	hud.pause_requested.connect(_pause_match)
	hud_layer.add_child(hud)
	if not OS.has_feature("mobile") and DisplayServer.get_name() != "headless":
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _pause_match() -> void:
	if not is_instance_valid(match_game) or match_game.ended or get_tree().paused:
		return
	if is_instance_valid(hud):
		hud.release_inputs()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	save_manager.save_data()
	get_tree().paused = true
	var pause = Pause.new()
	pause.resume_requested.connect(_resume_match)
	pause.restart_requested.connect(func(): _start_match(current_mode))
	pause.settings_requested.connect(_open_settings)
	pause.lobby_requested.connect(_show_lobby)
	overlay = pause
	add_child(pause)

func _resume_match() -> void:
	_remove(overlay)
	overlay = null
	get_tree().paused = false
	if not OS.has_feature("mobile") and DisplayServer.get_name() != "headless":
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _open_settings() -> void:
	if is_instance_valid(settings_overlay):
		return
	var page = Settings.new()
	page.save_manager = save_manager
	page.changed.connect(_apply_settings)
	page.edit_layout_requested.connect(_open_hud_editor)
	page.closed.connect(_on_settings_closed)
	settings_overlay = page
	add_child(page)

func _open_hud_editor() -> void:
	if is_instance_valid(hud_editor):
		return
	var editor = HudEditor.new()
	editor.save_manager = save_manager
	editor.closed.connect(_on_hud_editor_closed)
	hud_editor = editor
	add_child(editor)

func _on_hud_editor_closed(_saved: bool) -> void:
	hud_editor = null
	_apply_settings()

func _on_settings_closed() -> void:
	settings_overlay = null
	_apply_settings()
	if is_instance_valid(current) and current.has_method("refresh"):
		current.refresh()

func _on_match_finished(result: Dictionary) -> void:
	var missions = save_manager.record_match(result)
	if result.victory:
		audio.play_effect("victory", 0.8)
	if is_instance_valid(hud):
		hud.release_inputs()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	get_tree().paused = true
	var page = Results.new()
	page.result = result
	page.missions = missions
	page.again_requested.connect(func(): _start_match(current_mode))
	page.lobby_requested.connect(_show_lobby)
	page.training_requested.connect(func(): _start_match("training"))
	overlay = page
	add_child(page)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode in [KEY_ESCAPE, KEY_BACK]:
		if is_instance_valid(hud_editor):
			hud_editor._cancel()
		elif is_instance_valid(settings_overlay):
			settings_overlay._close()
		elif is_instance_valid(match_game) and not match_game.ended:
			if get_tree().paused:
				_resume_match()
			else:
				_pause_match()
		get_viewport().set_input_as_handled()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		if is_instance_valid(match_game) and not get_tree().paused:
			_pause_match()
	elif what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		if is_instance_valid(match_game) and not get_tree().paused and not match_game.ended:
			_pause_match()
		if save_manager != null:
			save_manager.save_data()
