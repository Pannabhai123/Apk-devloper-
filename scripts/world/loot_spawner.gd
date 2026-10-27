extends Node3D
const Loot = preload("res://scripts/world/loot.gd")
const WeaponData = preload("res://scripts/data/weapons.gd")
const Attachments = preload("res://scripts/data/attachments.gd")
var map: Node3D
var loot_items: Array = []
var rng := RandomNumberGenerator.new()

func spawn_initial(count: int = 56) -> void:
	rng.seed = 66211
	var kinds = ["weapon", "weapon", "weapon", "ammo", "medkit", "wall", "armor", "grenade", "optic"]
	for i in count:
		var kind = kinds[i % kinds.size()]
		var id = WeaponData.ORDER[1 + i % (WeaponData.ORDER.size() - 1)] if kind == "weapon" else WeaponData.ORDER[i % WeaponData.ORDER.size()]
		if kind == "optic":
			id = Attachments.LOOT_ORDER[(i / kinds.size()) % Attachments.LOOT_ORDER.size()]
		var point: Vector3
		if i % 2 == 0:
			var location: Dictionary = map.LOCATIONS[(i / 2) % map.LOCATIONS.size()]
			point = map.random_open_near(location.center)
		else:
			point = map.random_open_position()
		spawn(kind, id, point)

func spawn(kind: String, id: String, point: Vector3):
	var item = Loot.new()
	item.kind = kind
	item.item_id = id
	add_child(item)
	item.global_position = Vector3(point.x, maxf(0.05, point.y), point.z)
	loot_items.append(item)
	return item

func nearest(actor: Node3D, radius: float = 2.6):
	var best = null
	var best_distance = radius
	for item in loot_items:
		if not is_instance_valid(item) or item.claimed or absf(item.global_position.y - actor.global_position.y) > 1.5:
			continue
		var distance = Vector2(item.global_position.x - actor.global_position.x, item.global_position.z - actor.global_position.z).length()
		if distance < best_distance:
			best_distance = distance
			best = item
	return best

func pickup(actor: Node3D, allow_replace: bool = false) -> String:
	# Try every nearby item in distance order: a full medkit stack must not
	# prevent the player from picking up usable ammunition next to it.
	var nearby: Array = []
	for item in loot_items:
		if not is_instance_valid(item) or item.claimed or absf(item.global_position.y - actor.global_position.y) > 1.5:
			continue
		var distance = Vector2(item.global_position.x - actor.global_position.x, item.global_position.z - actor.global_position.z).length()
		if distance < 2.6:
			nearby.append({"item": item, "distance": distance})
	nearby.sort_custom(func(a, b): return a.distance < b.distance)
	for entry in nearby:
		var item = entry.item
		if not actor.pickup_loot(item.kind, item.item_id, allow_replace):
			continue
		var label = item.display_name()
		item.claimed = true
		loot_items.erase(item)
		item.queue_free()
		return label
	return ""
