extends CharacterBody3D
## Shared health, collision and movement for player, bots and training targets.
signal died(actor, attacker)
signal damaged(actor, amount, attacker, headshot)

const ModelFactory = preload("res://scripts/actors/model_factory.gd")
const Inventory = preload("res://scripts/combat/inventory.gd")

var game: Node
var actor_label := "Operator"
var palette: Dictionary = {"color": Color(0.3, 0.42, 0.38), "accent": Color(0.9, 0.6, 0.3)}
var health := 100.0
var armor := 35.0
var dead := false
var is_player := false
var is_target := false
var inventory
var visual: Node3D
var head_area: Area3D
var anim_time := 0.0
var death_time := 0.0
var previous_damage_attacker: Node
var ability_cooldown := 0.0
var ability_remaining := 0.0
var deployment_state := "ground"
var deployment_goal := Vector3.ZERO
var deployment_canopy: Node3D

func _ready() -> void:
	add_to_group("actors")
	collision_layer = 2
	collision_mask = 3
	floor_snap_length = 0.3
	var body_shape = CollisionShape3D.new()
	body_shape.name = "BodyCollider"
	var capsule = CapsuleShape3D.new()
	capsule.radius = 0.32
	capsule.height = 1.38
	body_shape.shape = capsule
	body_shape.position = Vector3(0, 0.69, 0)
	add_child(body_shape)
	head_area = Area3D.new()
	head_area.name = "HeadHitbox"
	head_area.position = Vector3(0, 1.62, 0)
	head_area.collision_layer = 4
	head_area.collision_mask = 0
	head_area.monitorable = true
	head_area.add_to_group("head_hitbox")
	var head_shape = CollisionShape3D.new()
	var sphere = SphereShape3D.new()
	sphere.radius = 0.24
	head_shape.shape = sphere
	head_area.add_child(head_shape)
	add_child(head_area)
	visual = ModelFactory.make_character(palette)
	add_child(visual)
	if inventory == null:
		inventory = Inventory.new()

func excluded_rids() -> Array[RID]:
	var excluded: Array[RID] = [get_rid()]
	if is_instance_valid(head_area):
		excluded.append(head_area.get_rid())
	return excluded

func update_ability(delta: float) -> void:
	ability_cooldown = maxf(0.0, ability_cooldown - delta)
	ability_remaining = maxf(0.0, ability_remaining - delta)

func ability_active(id: String) -> bool:
	return ability_remaining > 0.0 and str(palette.get("ability", "")) == id

func ability_spread_multiplier() -> float:
	return 0.60 if ability_active("steady") else 1.0

func activate_ability() -> bool:
	if dead or ability_cooldown > 0.0 or inventory == null:
		return false
	var used := false
	match str(palette.get("ability", "")):
		"bulwark":
			if armor < 100.0:
				armor = minf(100.0, armor + 30.0)
				used = true
		"steady", "recon", "rush", "terrain":
			ability_remaining = 6.0
			used = true
		"repair":
			if health < 100.0:
				health = minf(100.0, health + 25.0)
				used = true
		"reload":
			if inventory.current() != null:
				used = inventory.current().instant_reload()
		"cover":
			if inventory.walls < 5:
				inventory.walls += 1
				used = true
	if used:
		ability_cooldown = float(palette.get("ability_cooldown", 45.0))
	return used

func take_damage(amount: float, attacker: Node = null, headshot: bool = false) -> float:
	if dead or amount <= 0.0:
		return 0.0
	if attacker == null and ability_active("terrain"):
		amount *= 0.5
	var absorbed = minf(armor, amount * (0.20 if headshot else 0.40))
	armor -= absorbed
	var health_damage = minf(health, amount - absorbed)
	health = maxf(0.0, health - health_damage)
	var applied = absorbed + health_damage
	previous_damage_attacker = attacker
	damaged.emit(self, applied, attacker, headshot)
	if health <= 0.0:
		_die(attacker)
	return applied

func _die(attacker: Node) -> void:
	if dead:
		return
	dead = true
	collision_layer = 0
	collision_mask = 0
	if is_instance_valid(head_area):
		head_area.collision_layer = 0
	velocity = Vector3.ZERO
	died.emit(self, attacker)

func move_actor(direction: Vector3, speed: float, delta: float, jump: bool = false) -> void:
	if dead:
		return
	var flat = Vector3(direction.x, 0, direction.z)
	if flat.length_squared() > 1.0:
		flat = flat.normalized()
	var actual_speed = speed * (1.25 if ability_active("rush") else 1.0)
	velocity.x = flat.x * actual_speed
	velocity.z = flat.z * actual_speed
	if is_on_floor():
		if jump:
			velocity.y = 6.0
		else:
			velocity.y = -0.1
	else:
		velocity.y -= 20.0 * delta
	move_and_slide()

func animate_actor(delta: float) -> void:
	if not is_instance_valid(visual):
		return
	if dead:
		death_time += delta
		visual.rotation.x = lerp_angle(visual.rotation.x, -1.2, minf(1.0, delta * 4.0))
		return
	var movement = Vector2(velocity.x, velocity.z).length()
	anim_time += delta * (9.0 if movement > 0.4 else 2.0)
	var swing = sin(anim_time) * minf(0.55, movement / 8.0)
	visual.get_node("LeftLeg").rotation.x = swing
	visual.get_node("RightLeg").rotation.x = -swing
	visual.position.y = sin(anim_time * 2.0) * (0.025 if movement > 0.4 else 0.007)

func pickup_loot(kind: String, item_id: String, allow_replace: bool = false) -> bool:
	match kind:
		"weapon":
			return inventory.pickup_weapon(item_id, allow_replace)
		"ammo":
			return inventory.pickup_ammo(item_id)
		"optic":
			return inventory.pickup_optic(item_id, allow_replace)
		"medkit", "wall", "grenade":
			return inventory.pickup_item(kind)
		"armor":
			if armor < 100.0:
				armor = minf(100.0, armor + 35.0)
				return true
	return false
