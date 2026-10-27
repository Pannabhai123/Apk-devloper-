extends Node
## Small original synthesized effects, generated locally. No downloaded audio/assets.
var streams: Dictionary = {}
var pool: Array[AudioStreamPlayer] = []
var cursor := 0
var volume := 0.75

func _ready() -> void:
	streams["shot"] = _make_sound(0.10, 150.0, 0.85)
	streams["reload"] = _make_sound(0.12, 520.0, 0.35)
	streams["hit"] = _make_sound(0.07, 880.0, 0.08)
	streams["headshot"] = _make_sound(0.13, 1300.0, 0.06)
	streams["pickup"] = _make_sound(0.13, 690.0, 0.03)
	streams["wall"] = _make_sound(0.20, 260.0, 0.45)
	streams["explosion"] = _make_sound(0.42, 90.0, 0.9)
	streams["warning"] = _make_sound(0.25, 430.0, 0.04)
	streams["victory"] = _make_sound(0.55, 660.0, 0.02)
	for i in 8:
		var player = AudioStreamPlayer.new()
		add_child(player)
		pool.append(player)

func configure(settings: Dictionary) -> void:
	volume = clampf(float(settings.get("volume", 75.0)) / 100.0, 0.0, 1.0)

func play_effect(kind: String, strength: float = 1.0) -> void:
	if pool.is_empty() or not streams.has(kind) or volume <= 0.0:
		return
	var p = pool[cursor % pool.size()]
	cursor += 1
	p.stream = streams[kind]
	p.volume_db = linear_to_db(maxf(0.001, volume * strength * 0.65))
	p.play()

func _make_sound(duration: float, frequency: float, noise_amount: float) -> AudioStreamWAV:
	var sample_rate = 22050
	var count = int(duration * sample_rate)
	var bytes = PackedByteArray()
	bytes.resize(count * 2)
	var rng = RandomNumberGenerator.new()
	rng.seed = int(frequency * 17.0)
	for i in count:
		var t = float(i) / sample_rate
		var envelope = pow(maxf(0.0, 1.0 - t / duration), 2.1)
		var tone = sin(TAU * frequency * t * (1.0 - 0.23 * t / duration))
		var sample = (tone * (1.0 - noise_amount) + rng.randf_range(-1.0, 1.0) * noise_amount) * envelope * 0.55
		bytes.encode_s16(i * 2, int(clampf(sample, -1.0, 1.0) * 32767.0))
	var stream = AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = sample_rate
	stream.stereo = false
	stream.data = bytes
	return stream

func _exit_tree() -> void:
	for player in pool:
		if is_instance_valid(player):
			player.stop()
			player.stream = null
	streams.clear()
