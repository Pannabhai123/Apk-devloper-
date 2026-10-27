extends RefCounted
## Fixed two-weapon slots and bounded consumables.
const Weapon = preload("res://scripts/combat/weapon.gd")

var slots: Array = [null, null]
var selected := 0
var medkits := 2
var walls := 2
var grenades := 1
var unlimited := false

func _init(start_weapon: String = "pistol_01", training: bool = false) -> void:
	unlimited = training
	slots[0] = Weapon.new(start_weapon, training)
	if training:
		medkits = 5
		walls = 5
		grenades = 3

func current():
	return slots[selected]

func update(delta: float) -> void:
	for weapon in slots:
		if weapon != null:
			weapon.update(delta)

func switch_weapon() -> bool:
	var other = 1 - selected
	if slots[other] == null:
		return false
	if current() != null:
		current().cancel_reload()
	selected = other
	return true

func pickup_weapon(id: String, allow_replace: bool) -> bool:
	for weapon in slots:
		if weapon != null and weapon.id == id:
			return weapon.add_ammo(int(weapon.data.magazine))
	for i in 2:
		if slots[i] == null:
			if current() != null:
				current().cancel_reload()
			slots[i] = Weapon.new(id, unlimited)
			selected = i
			return true
	if not allow_replace:
		return false
	current().cancel_reload()
	slots[selected] = Weapon.new(id, unlimited)
	return true

func pickup_ammo(id: String, amount: int = 30) -> bool:
	for weapon in slots:
		if weapon != null and weapon.id == id:
			return weapon.add_ammo(amount)
	return false

func pickup_optic(id: String, allow_replace: bool = false) -> bool:
	return current() != null and current().attach_optic(id, allow_replace)

func pickup_item(kind: String) -> bool:
	if kind == "medkit" and medkits < 5:
		medkits += 1
		return true
	if kind == "wall" and walls < 5:
		walls += 1
		return true
	if kind == "grenade" and grenades < 3:
		grenades += 1
		return true
	return false
