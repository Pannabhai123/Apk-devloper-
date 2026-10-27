extends SceneTree
## Optional headless 49-bot simulation. It is not an Android performance benchmark.
const Save = preload("res://scripts/core/save_manager.gd")
const MatchController = preload("res://scripts/core/match_controller.gd")
const WorldConfig = preload("res://scripts/data/world_config.gd")
class SilentAudio extends Node:
	func play_effect(_name: String, _strength: float = 1.0) -> void:
		pass

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var audio = SilentAudio.new()
	root.add_child(audio)
	var data = Save.defaults()
	data.settings.bot_count = 49
	var game = MatchController.new()
	game.setup("battle", data, audio)
	root.add_child(game)
	var initial_bots = game.remaining_bots()
	# Keep the inactive test player alive long enough to exercise AI/zone behavior.
	game.player.health = 1000000.0
	var start_ms = Time.get_ticks_msec()
	var previous = -1
	while game.elapsed < 180.0 and not game.ended:
		await physics_frame
		var segment = int(game.elapsed / 30.0)
		if segment != previous:
			previous = segment
			print("simulation=%.1fs alive_bots=%d zone_radius=%.1f deployed=%s" % [game.elapsed, game.remaining_bots(), game.zone.radius, str(game.deployment.completed)])
	var outcome = "ended" if game.ended else "completed observation"
	var okay = initial_bots == 49 and game.deployment.completed and (game.ended or game.zone.radius < WorldConfig.INITIAL_ZONE_RADIUS)
	print("SOAK %s; simulated %.1fs in %.2fs; bots remaining %d; deployment complete %s" % [outcome, game.elapsed, (Time.get_ticks_msec() - start_ms) / 1000.0, game.remaining_bots(), str(game.deployment.completed)])
	if not okay:
		printerr("SOAK FAIL: expected 49 bots, completed deployment and either match end or a shrinking zone")
	game.queue_free()
	audio.queue_free()
	await process_frame
	quit(0 if okay else 1)
