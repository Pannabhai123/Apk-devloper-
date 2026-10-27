extends "res://scripts/actors/actor.gd"
var home := Vector3.ZERO
var moving := false
var phase := 0.0
var respawn_timer := 0.0

func _ready() -> void:
	is_target = true
	armor = 0.0
	super._ready()
	home = global_position

func _physics_process(delta: float) -> void:
	animate_actor(delta)
	if dead:
		respawn_timer -= delta
		if respawn_timer <= 0.0:
			dead = false
			health = 100.0
			armor = 0.0
			collision_layer = 2
			collision_mask = 3
			head_area.collision_layer = 4
			visual.rotation.x = 0.0
		return
	if moving:
		phase += delta
		var goal = home + Vector3(sin(phase * 0.75) * 5.0, 0, 0)
		var direction = goal - global_position
		direction.y = 0
		move_actor(direction.normalized() if direction.length() > 0.15 else Vector3.ZERO, 2.3, delta)
	else:
		move_actor(Vector3.ZERO, 0, delta)

func _die(attacker: Node) -> void:
	super._die(attacker)
	respawn_timer = 1.5
