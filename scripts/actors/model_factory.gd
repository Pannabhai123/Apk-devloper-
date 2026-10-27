extends RefCounted
## All geometry is built from original primitive shapes at runtime.

static func material(color: Color, emission: bool = false) -> StandardMaterial3D:
	var mat = StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = 0.88
	if color.a < 1.0:
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if emission:
		mat.emission_enabled = true
		mat.emission = Color(color.r, color.g, color.b)
		mat.emission_energy_multiplier = 0.55
	return mat

static func box(parent: Node3D, size: Vector3, at: Vector3, color: Color, part_name: String = "") -> MeshInstance3D:
	var instance = MeshInstance3D.new()
	if not part_name.is_empty():
		instance.name = part_name
	var mesh = BoxMesh.new()
	mesh.size = size
	instance.mesh = mesh
	instance.material_override = material(color)
	instance.position = at
	parent.add_child(instance)
	return instance

static func sphere(parent: Node3D, radius: float, at: Vector3, color: Color, part_name: String = "") -> MeshInstance3D:
	var instance = MeshInstance3D.new()
	if not part_name.is_empty():
		instance.name = part_name
	var mesh = SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	mesh.radial_segments = 12
	mesh.rings = 6
	instance.mesh = mesh
	instance.material_override = material(color)
	instance.position = at
	parent.add_child(instance)
	return instance

static func make_character(palette: Dictionary) -> Node3D:
	var root = Node3D.new()
	root.name = "Visual"
	var primary: Color = palette.get("color", Color(0.25, 0.42, 0.40))
	var accent: Color = palette.get("accent", Color(0.95, 0.60, 0.27))
	var dark = Color(0.11, 0.16, 0.16)
	var skin = Color(0.63, 0.43, 0.33)
	# Feet and limb pivots create a small procedural walk animation without external assets.
	var left_leg = Node3D.new()
	left_leg.name = "LeftLeg"
	left_leg.position = Vector3(-0.16, 0.82, 0.0)
	root.add_child(left_leg)
	box(left_leg, Vector3(0.25, 0.65, 0.27), Vector3(0, -0.35, 0), dark)
	box(left_leg, Vector3(0.27, 0.16, 0.39), Vector3(0, -0.70, -0.05), Color(0.08, 0.11, 0.11))
	var right_leg = Node3D.new()
	right_leg.name = "RightLeg"
	right_leg.position = Vector3(0.16, 0.82, 0.0)
	root.add_child(right_leg)
	box(right_leg, Vector3(0.25, 0.65, 0.27), Vector3(0, -0.35, 0), dark)
	box(right_leg, Vector3(0.27, 0.16, 0.39), Vector3(0, -0.70, -0.05), Color(0.08, 0.11, 0.11))
	box(root, Vector3(0.58, 0.70, 0.35), Vector3(0, 1.08, 0), primary, "Torso")
	box(root, Vector3(0.52, 0.36, 0.40), Vector3(0, 1.13, -0.04), dark)
	box(root, Vector3(0.12, 0.34, 0.42), Vector3(-0.12, 1.14, -0.05), accent)
	box(root, Vector3(0.41, 0.48, 0.20), Vector3(0, 1.12, 0.25), Color(0.20, 0.27, 0.25))
	box(root, Vector3(0.18, 0.55, 0.20), Vector3(-0.37, 1.02, 0), primary, "LeftArm")
	box(root, Vector3(0.18, 0.55, 0.20), Vector3(0.37, 1.02, 0), primary, "RightArm")
	sphere(root, 0.24, Vector3(0, 1.62, 0), skin, "Head")
	box(root, Vector3(0.46, 0.14, 0.44), Vector3(0, 1.77, 0), dark, "Headwear")
	box(root, Vector3(0.40, 0.08, 0.08), Vector3(0, 1.63, -0.21), Color(0.12, 0.17, 0.17))
	# Compact original weapon silhouette, visible in third person.
	box(root, Vector3(0.15, 0.15, 0.57), Vector3(0.34, 1.08, -0.31), Color(0.13, 0.16, 0.15), "Weapon")
	box(root, Vector3(0.055, 0.06, 0.36), Vector3(0.34, 1.11, -0.67), Color(0.09, 0.11, 0.10))
	return root
