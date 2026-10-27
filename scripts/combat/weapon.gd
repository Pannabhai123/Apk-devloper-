extends RefCounted
## One weapon instance, including its magazine, reserve, fire timer and reload state.
const WeaponData = preload("res://scripts/data/weapons.gd")
const Attachments = preload("res://scripts/data/attachments.gd")

var id: String
var optic := "iron"
var data: Dictionary
var magazine: int
var reserve: int
var cooldown := 0.0
var reload_remaining := 0.0
var unlimited_reserve := false
var rng := RandomNumberGenerator.new()

func _init(weapon_id: String = "pistol_01", unlimited: bool = false) -> void:
	id = weapon_id if WeaponData.DEFINITIONS.has(weapon_id) else "pistol_01"
	data = WeaponData.get_data(id)
	magazine = int(data.magazine)
	reserve = int(data.reserve)
	unlimited_reserve = unlimited
	rng.randomize()

func update(delta: float) -> void:
	cooldown = maxf(0.0, cooldown - delta)
	if reload_remaining > 0.0:
		reload_remaining -= delta
		if reload_remaining <= 0.0:
			var missing = int(data.magazine) - magazine
			var loaded = missing if unlimited_reserve else mini(missing, reserve)
			magazine += loaded
			if not unlimited_reserve:
				reserve -= loaded
			reload_remaining = 0.0

func start_reload() -> bool:
	if reload_remaining > 0.0 or magazine >= int(data.magazine) or (reserve <= 0 and not unlimited_reserve):
		return false
	reload_remaining = float(data.reload)
	return true

func instant_reload() -> bool:
	if magazine >= int(data.magazine) or (reserve <= 0 and not unlimited_reserve):
		return false
	var missing = int(data.magazine) - magazine
	var loaded = missing if unlimited_reserve else mini(missing, reserve)
	magazine += loaded
	if not unlimited_reserve:
		reserve -= loaded
	reload_remaining = 0.0
	return true

func cancel_reload() -> void:
	reload_remaining = 0.0

func add_ammo(amount: int) -> bool:
	if reserve >= int(data.max_reserve):
		return false
	reserve = mini(int(data.max_reserve), reserve + amount)
	return true

func optic_data() -> Dictionary:
	return Attachments.get_optic(optic)

func attach_optic(id: String, allow_downgrade: bool = false) -> bool:
	if id not in Attachments.LOOT_ORDER or id == optic:
		return false
	if not allow_downgrade and int(Attachments.OPTICS[id].rank) <= int(Attachments.OPTICS[optic].rank):
		return false
	optic = id
	return true

func can_fire() -> bool:
	return cooldown <= 0.0 and reload_remaining <= 0.0 and magazine > 0

func fire(space: PhysicsDirectSpaceState3D, origin: Vector3, direction: Vector3, excluded: Array[RID], owner: Node, spread_scale: float = 1.0) -> Dictionary:
	var result = {"fired": false, "hit_actor": false, "headshots": 0, "damage": 0.0, "wall_hit": false}
	if not can_fire():
		return result
	magazine -= 1
	cooldown = float(data.interval)
	result.fired = true
	var forward = direction.normalized()
	var right = forward.cross(Vector3.UP).normalized()
	if right.length_squared() < 0.001:
		right = Vector3.RIGHT
	var up = right.cross(forward).normalized()
	for pellet in int(data.pellets):
		var spread = float(data.spread) * spread_scale
		var ray_direction = (forward + right * rng.randf_range(-spread, spread) + up * rng.randf_range(-spread, spread)).normalized()
		var query = PhysicsRayQueryParameters3D.create(origin, origin + ray_direction * float(data.range), 7, excluded)
		query.collide_with_areas = true
		query.collide_with_bodies = true
		var hit = space.intersect_ray(query)
		if hit.is_empty():
			continue
		var victim = hit.collider
		var headshot = false
		if victim is Area3D and victim.is_in_group("head_hitbox"):
			headshot = true
			victim = victim.get_parent()
		if not is_instance_valid(victim) or victim == owner or not victim.has_method("take_damage"):
			continue
		var amount = float(data.damage) * (float(data.head) if headshot else 1.0)
		var applied = victim.take_damage(amount, owner, headshot)
		if victim.is_in_group("actors") and applied > 0.0:
			result.hit_actor = true
			result.damage += applied
			if headshot:
				result.headshots += 1
		elif victim.is_in_group("gloo_walls"):
			result.wall_hit = true
	return result
