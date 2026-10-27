extends Node3D
const Factory = preload("res://scripts/actors/model_factory.gd")
const WeaponData = preload("res://scripts/data/weapons.gd")
const Attachments = preload("res://scripts/data/attachments.gd")
var kind := "medkit"
var item_id := ""
var claimed := false
var phase := 0.0
var visual: Node3D

func _ready() -> void:
	visual = Node3D.new()
	add_child(visual)
	var color = Color(0.93, 0.75, 0.34)
	match kind:
		"weapon": color = WeaponData.get_data(item_id).color
		"ammo": color = Color(0.94, 0.75, 0.37)
		"medkit": color = Color(0.92, 0.37, 0.33)
		"wall": color = Color(0.27, 0.81, 0.84)
		"armor": color = Color(0.48, 0.63, 0.88)
		"grenade": color = Color(0.44, 0.53, 0.27)
		"optic": color = Color(0.68, 0.51, 0.89)
	Factory.box(visual, Vector3(0.65, 0.4, 0.65), Vector3(0, 0.36, 0), color)
	Factory.box(visual, Vector3(0.32, 0.08, 0.68), Vector3(0, 0.58, 0), Color(0.88, 0.90, 0.78))

func _process(delta: float) -> void:
	phase += delta
	if is_instance_valid(visual):
		visual.rotation.y += delta * 0.8
		visual.position.y = sin(phase * 2.0) * 0.07

func display_name() -> String:
	match kind:
		"weapon": return WeaponData.get_data(item_id).name
		"ammo": return "%s ammo" % WeaponData.get_data(item_id).name
		"medkit": return "Medkit"
		"wall": return "Gloo Wall"
		"armor": return "Armor"
		"grenade": return "Frag grenade"
		"optic": return Attachments.get_optic(item_id).name
	return "Supply"
