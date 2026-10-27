extends StaticBody3D
## A real, destructible collision body, not a cosmetic effect.
const Factory = preload("res://scripts/actors/model_factory.gd")
const WIDTH := 3.2
const HEIGHT := 1.9
const DEPTH := 0.42
signal destroyed(wall)
var health := 150.0
var broken := false

func _ready() -> void:
	add_to_group("gloo_walls")
	collision_layer = 1
	collision_mask = 0
	var collider = CollisionShape3D.new()
	var shape = BoxShape3D.new()
	shape.size = Vector3(WIDTH, HEIGHT, DEPTH)
	collider.shape = shape
	collider.position.y = HEIGHT / 2.0
	add_child(collider)
	Factory.box(self, Vector3(WIDTH, HEIGHT, DEPTH), Vector3(0, HEIGHT / 2.0, 0), Color(0.18, 0.67, 0.72))
	Factory.box(self, Vector3(WIDTH - 0.14, 0.20, DEPTH + 0.025), Vector3(0, 1.51, 0), Color(0.61, 0.94, 0.91))
	Factory.box(self, Vector3(WIDTH - 0.14, 0.10, DEPTH + 0.03), Vector3(0, 0.42, 0), Color(0.07, 0.38, 0.45))
	for x in [-1.08, 0.0, 1.08]:
		Factory.box(self, Vector3(0.12, HEIGHT - 0.1, DEPTH + 0.04), Vector3(x, HEIGHT / 2.0, 0), Color(0.48, 0.84, 0.83))

func take_damage(amount: float, _attacker: Node = null, _headshot: bool = false) -> float:
	if broken or amount <= 0.0:
		return 0.0
	var applied = minf(health, amount)
	health -= applied
	if health <= 0.0:
		broken = true
		collision_layer = 0
		destroyed.emit(self)
		queue_free()
	return applied
