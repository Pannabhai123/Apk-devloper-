extends SceneTree
## Execute with: godot --headless --path . --script res://tests/run_tests.gd --fixed-fps 60
const WorldConfig = preload("res://scripts/data/world_config.gd")
const Weapon = preload("res://scripts/combat/weapon.gd")
const WeaponData = preload("res://scripts/data/weapons.gd")
const Characters = preload("res://scripts/data/characters.gd")
const FragGrenade = preload("res://scripts/combat/frag_grenade.gd")
const Inventory = preload("res://scripts/combat/inventory.gd")
const Actor = preload("res://scripts/actors/actor.gd")
const Wall = preload("res://scripts/world/gloo_wall.gd")
const WallManager = preload("res://scripts/world/wall_manager.gd")
const LootSpawner = preload("res://scripts/world/loot_spawner.gd")
const Zone = preload("res://scripts/world/safe_zone.gd")
const Save = preload("res://scripts/core/save_manager.gd")
const MatchController = preload("res://scripts/core/match_controller.gd")
const Game = preload("res://scripts/core/game.gd")

class SilentAudio extends Node:
	func play_effect(_name: String, _strength: float = 1.0) -> void:
		pass

var passed := 0
var failures: Array[String] = []

func _initialize() -> void:
	call_deferred("_run")

func check(condition: bool, description: String) -> void:
	if condition:
		passed += 1
		print("PASS ", description)
	else:
		failures.append(description)
		printerr("FAIL ", description)

func frames(count: int) -> void:
	for i in count:
		await physics_frame

func _run() -> void:
	await test_weapon_and_physics()
	await test_grenade()
	await test_abilities()
	await test_zone()
	await test_navigation()
	await test_dynamic_navigation()
	await test_expanded_island()
	await test_deployment()
	test_save()
	await test_app_and_touch()
	await test_match_results_and_bot_visibility()
	print("\nRESULT: %d passed, %d failed" % [passed, failures.size()])
	if not failures.is_empty():
		for failure in failures:
			printerr(" - ", failure)
	quit(0 if failures.is_empty() else 1)

func test_weapon_and_physics() -> void:
	print("\n-- WEAPONS / PHYSICS / WALL / LOOT --")
	var valid_weapons = WeaponData.ORDER.size() == 12
	for id in WeaponData.ORDER:
		var definition = WeaponData.get_data(id)
		valid_weapons = valid_weapons and definition.magazine > 0 and definition.damage > 0 and definition.interval > 0 and definition.reload > 0
	check(valid_weapons, "twelve original firearm configurations have usable combat values")
	var gun = Weapon.new("ar_01")
	check(gun.magazine == 30 and gun.reserve == 90, "weapon loads configured magazine and reserve")
	gun.magazine = 0
	gun.reserve = 10
	check(gun.start_reload(), "empty weapon starts reload")
	check(not gun.can_fire(), "reloading blocks firing")
	gun.update(float(gun.data.reload) / 2.0)
	check(gun.magazine == 0, "reload is not instantaneous")
	gun.update(float(gun.data.reload))
	check(gun.magazine == 10 and gun.reserve == 0 and gun.reload_remaining == 0, "reload respects available ammunition")
	var inv = Inventory.new("pistol_01")
	check(inv.pickup_weapon("ar_01", false) and inv.slots[1].id == "ar_01", "weapon pickup fills second slot")
	check(not inv.pickup_weapon("smg_01", false), "automatic pickup cannot silently replace a full slot")
	check(inv.pickup_weapon("smg_01", true) and inv.current().id == "smg_01", "manual pickup can replace selected weapon")
	check(inv.switch_weapon() and inv.current().id == "pistol_01", "weapon switch selects the other occupied slot")
	check(inv.pickup_optic("scope_2x") and inv.current().optic == "scope_2x", "optic loot attaches to the selected firearm")
	check(not inv.pickup_optic("red_dot") and inv.pickup_optic("red_dot", true), "automatic optics only upgrade while manual pickup can replace")
	check(float(inv.current().optic_data().fov) < 68 and float(inv.current().optic_data().spread) < 1.0, "optic changes real aim zoom and spread configuration")

	var arena = Node3D.new()
	root.add_child(arena)
	# A physical floor is necessary: floating Gloo Wall previews are invalid.
	var floor_body = StaticBody3D.new()
	floor_body.collision_layer = 1
	floor_body.position = Vector3(0, -0.5, 0)
	var floor_shape = CollisionShape3D.new()
	var floor_box = BoxShape3D.new()
	floor_box.size = Vector3(200, 1, 200)
	floor_shape.shape = floor_box
	floor_body.add_child(floor_shape)
	arena.add_child(floor_body)
	var shooter = Actor.new()
	shooter.position = Vector3.ZERO
	arena.add_child(shooter)
	var target = Actor.new()
	target.position = Vector3(0, 0, -8)
	target.armor = 0
	arena.add_child(target)
	await frames(3)
	var space = shooter.get_world_3d().direct_space_state
	var pistol = Weapon.new("pistol_01")
	pistol.data.spread = 0.0
	var head_result = pistol.fire(space, Vector3(0, 1.62, 0), Vector3.FORWARD, shooter.excluded_rids(), shooter)
	check(head_result.fired and head_result.hit_actor and head_result.headshots == 1, "real physics ray detects head hitbox")
	check(is_equal_approx(target.health, 100.0 - 23.0 * 1.8) and pistol.magazine == 11, "headshot multiplier and ammunition are applied")
	target.health = 100
	pistol.cooldown = 0
	var body_result = pistol.fire(space, Vector3(0, 0.90, 0), Vector3.FORWARD, shooter.excluded_rids(), shooter)
	check(body_result.hit_actor and body_result.headshots == 0 and is_equal_approx(target.health, 77.0), "body ray applies body damage, not a headshot")
	var wall = Wall.new()
	wall.position = Vector3(0, 0, -4)
	arena.add_child(wall)
	await frames(3)
	target.health = 100
	pistol.cooldown = 0
	var wall_result = pistol.fire(space, Vector3(0, 1.62, 0), Vector3.FORWARD, shooter.excluded_rids(), shooter)
	check(wall_result.wall_hit and wall.health < 150 and target.health == 100, "Gloo Wall blocks a real bullet and takes damage")
	wall.take_damage(999, shooter)
	await frames(3)
	pistol.cooldown = 0
	var after_wall = pistol.fire(space, Vector3(0, 1.62, 0), Vector3.FORWARD, shooter.excluded_rids(), shooter)
	check(after_wall.hit_actor and target.health < 100, "destroyed wall no longer blocks bullets")

	var wall_manager = WallManager.new()
	arena.add_child(wall_manager)
	await frames(2)
	var original_count = shooter.inventory.walls
	wall_manager.start_preview(shooter, 0.0)
	check(wall_manager.preview_active and wall_manager.preview_valid, "valid Gloo placement has a green preview")
	check(wall_manager.confirm(shooter) and shooter.inventory.walls == original_count - 1, "placement consumes inventory and creates cover")
	await frames(2)
	wall_manager.cooldown = 0
	check(not wall_manager.can_place(shooter, Vector3(0, 0.02, -2.5), 0), "overlapping wall placement is rejected")
	check(not wall_manager.can_place(shooter, Vector3(0, 0.02, 0), 0), "placement inside the player is rejected")
	check(not wall_manager.can_place(shooter, Vector3(WorldConfig.HALF_SIZE - 1, 0.02, 0), 0), "out-of-map wall placement is rejected")
	var spawner = LootSpawner.new()
	arena.add_child(spawner)
	var loot = spawner.spawn("medkit", "", shooter.position + Vector3(1, 0, 0))
	var kits = shooter.inventory.medkits
	check(spawner.pickup(shooter) == "Medkit" and shooter.inventory.medkits == kits + 1 and loot.claimed, "nearby loot is collected exactly once")
	shooter.inventory.medkits = 5
	var full_loot = spawner.spawn("medkit", "", shooter.position + Vector3(1, 0, 0))
	check(spawner.pickup(shooter).is_empty() and not full_loot.claimed, "consumable capacity prevents unlimited pickups")
	var wall_loot = spawner.spawn("wall", "", shooter.position + Vector3(1.2, 0, 0))
	check(spawner.pickup(shooter) == "Gloo Wall" and wall_loot.claimed, "unusable nearby loot does not block other pickups")
	var optic_loot = spawner.spawn("optic", "scope_4x", shooter.position + Vector3(1.3, 0, 0))
	check(spawner.pickup(shooter) == "4x Scope" and optic_loot.claimed and shooter.inventory.current().optic == "scope_4x", "optic world loot is picked up and attached")
	arena.queue_free()
	await frames(2)

func test_grenade() -> void:
	print("\n-- FRAG GRENADE --")
	var audio = SilentAudio.new()
	root.add_child(audio)
	var data = Save.defaults()
	data.settings.bot_count = 3
	var game = MatchController.new()
	game.setup("practice", data, audio)
	root.add_child(game)
	for b in game.bots:
		b.set_physics_process(false)
	game.player.set_physics_process(false)
	var player = game.player
	var thrown = game.throw_grenade(player, Vector3.FORWARD)
	check(is_instance_valid(thrown) and player.inventory.grenades == 0, "throwing a grenade consumes bounded inventory")
	var start = thrown.global_position
	await frames(12)
	check(is_instance_valid(thrown) and thrown.global_position.distance_to(start) > 1.0, "grenade is a real moving physics projectile")
	check(game.throw_grenade(player, Vector3.FORWARD) == null, "player cannot throw without a grenade")
	thrown.queue_free()
	player.global_position = Vector3(40, 0.05, 45)
	var shielded = game.bots[0]
	var exposed = game.bots[1]
	shielded.global_position = Vector3(0, 0.05, -6)
	exposed.global_position = Vector3(4, 0.05, -5)
	shielded.armor = 0
	exposed.armor = 0
	var wall = Wall.new()
	wall.position = Vector3(0, 0, -4)
	game.wall_manager.add_child(wall)
	var grenade = FragGrenade.new()
	grenade.game = game
	grenade.thrower = player
	grenade.position = Vector3(0, 0.3, -2)
	grenade.freeze = true
	game.add_child(grenade)
	await frames(4)
	grenade.detonate()
	check(shielded.health == 100 and exposed.health < 100, "blast damages exposed actors but solid Gloo cover shields others")
	check(wall.health < 150 and game.stats.damage_dealt > 0, "blast damages cover and credits player damage")
	# Open road: compare actual damage at near/far distances and beyond the radius.
	shielded.global_position = Vector3(1.5, 0.05, 25)
	exposed.global_position = Vector3(4.5, 0.05, 25)
	shielded.health = 100
	exposed.health = 100
	game.bots[2].global_position = Vector3(10, 0.05, 25)
	game.bots[2].armor = 0
	var falloff = FragGrenade.new()
	falloff.game = game
	falloff.thrower = player
	falloff.position = Vector3(0, 0.3, 25)
	falloff.freeze = true
	game.add_child(falloff)
	await frames(3)
	falloff.detonate()
	var near_expected = 130.0 * (1.0 - Vector2(1.5, 0.35).length() / 6.0)
	var far_expected = 130.0 * (1.0 - Vector2(4.5, 0.35).length() / 6.0)
	check(absf((100.0 - shielded.health) - near_expected) < 0.1 and absf((100.0 - exposed.health) - far_expected) < 0.1 and game.bots[2].health == 100, "grenade damage follows tested radial falloff and stops outside its radius")
	var bot = game.bots[2]
	bot.global_position = Vector3(0, 0.05, 20)
	player.global_position = Vector3(0, 0.05, 5)
	await frames(3)
	check(bot._try_throw_grenade(player) and bot.inventory.grenades == 0 and not bot._try_throw_grenade(player), "visible distant opponent can prompt a bot grenade with cooldown")
	var timed = FragGrenade.new()
	timed.game = game
	timed.thrower = player
	timed.position = Vector3(40, 0.3, 40)
	timed.freeze = true
	timed.fuse = 0.2
	game.add_child(timed)
	await frames(20)
	check(not is_instance_valid(timed), "grenade fuse automatically detonates and cleans up")
	var inv = Inventory.new()
	inv.grenades = 2
	check(inv.pickup_item("grenade") and not inv.pickup_item("grenade") and inv.grenades == 3, "grenade loot respects its inventory cap")
	game.queue_free()
	audio.queue_free()
	await frames(4)

func test_abilities() -> void:
	print("\n-- OPERATOR ABILITIES --")
	var unit = Actor.new()
	root.add_child(unit)
	unit.palette = Characters.ROSTER[0]
	unit.armor = 35.0
	check(unit.activate_ability() and is_equal_approx(unit.armor, 65.0) and not unit.activate_ability(), "bulwark restores armor and cannot bypass cooldown")
	unit.update_ability(36.0)
	check(unit.ability_cooldown == 0.0, "ability cooldown advances with simulation time")
	unit.palette = Characters.ROSTER[1]
	check(unit.activate_ability() and is_equal_approx(unit.ability_spread_multiplier(), 0.6), "steady hands reduces actual weapon spread")
	unit.ability_cooldown = 0.0
	unit.palette = Characters.ROSTER[2]
	check(unit.activate_ability() and unit.ability_active("recon"), "recon scan has an active time window")
	unit.ability_cooldown = 0.0
	unit.palette = Characters.ROSTER[3]
	unit.activate_ability()
	unit.move_actor(Vector3.RIGHT, 4.0, 1.0 / 60.0)
	check(is_equal_approx(unit.velocity.x, 5.0), "adrenaline increases actual movement speed")
	unit.ability_cooldown = 0.0
	unit.palette = Characters.ROSTER[4]
	unit.armor = 0.0
	unit.health = 100.0
	unit.activate_ability()
	unit.take_damage(20.0, null)
	check(is_equal_approx(unit.health, 90.0), "terrain guard halves real environmental damage")
	unit.ability_cooldown = 0.0
	unit.palette = Characters.ROSTER[5]
	unit.health = 50.0
	check(unit.activate_ability() and is_equal_approx(unit.health, 75.0), "field repair restores bounded health")
	unit.ability_cooldown = 0.0
	unit.palette = Characters.ROSTER[6]
	var gun = unit.inventory.current()
	gun.magazine = 5
	gun.reserve = 4
	gun.start_reload()
	check(unit.activate_ability() and gun.magazine == 9 and gun.reserve == 0 and gun.reload_remaining == 0, "reload drill uses available reserve and completes the reload")
	unit.ability_cooldown = 0.0
	unit.palette = Characters.ROSTER[7]
	unit.inventory.walls = 2
	check(unit.activate_ability() and unit.inventory.walls == 3, "cover reserve supplies one Gloo Wall")
	unit.ability_cooldown = 0.0
	unit.inventory.walls = 5
	check(not unit.activate_ability() and unit.ability_cooldown == 0.0, "unneeded ability is not consumed at inventory capacity")
	unit.queue_free()
	var audio = SilentAudio.new()
	root.add_child(audio)
	var data = Save.defaults()
	data.settings.bot_count = 3
	data.progress.character = 2
	var game = MatchController.new()
	game.setup("practice", data, audio)
	root.add_child(game)
	game.player.set_physics_process(false)
	for bot in game.bots:
		bot.set_physics_process(false)
	game.player.global_position = Vector3.ZERO
	game.bots[0].global_position = Vector3(10, 0, 0)
	game.bots[1].global_position = Vector3(60, 0, 0)
	game.bots[2].global_position = Vector3(65, 0, 0)
	game.player.activate_ability()
	check(game.recon_targets(game.player) == [game.bots[0]], "recon reveals only opponents inside its bounded scan range")
	game.player.update_ability(6.1)
	check(game.recon_targets(game.player).is_empty(), "recon reveal ends when its active window expires")
	var bot = game.bots[0]
	bot.palette = Characters.ROSTER[1]
	bot.target = game.player
	bot.target_visible = true
	bot._consider_ability()
	check(bot.ability_active("steady") and bot.ability_cooldown > 0, "bots can use their assigned tactical abilities")
	game.queue_free()
	audio.queue_free()
	await frames(3)

func test_zone() -> void:
	print("\n-- SAFE ZONE --")
	var zone = Zone.new()
	zone.configure("practice", 42)
	zone.wait_time = 0.05
	zone.shrink_time = 0.10
	zone.timer = 0.05
	root.add_child(zone)
	var all_bounded = true
	var previous_radius = zone.radius
	var non_increasing = true
	for i in 300:
		zone.advance(0.1)
		all_bounded = all_bounded and absf(zone.center.x) + zone.radius <= WorldConfig.HALF_SIZE + 0.01 and absf(zone.center.y) + zone.radius <= WorldConfig.HALF_SIZE + 0.01
		non_increasing = non_increasing and zone.radius <= previous_radius + 0.001
		previous_radius = zone.radius
	check(all_bounded and non_increasing, "shrinking safe circle remains inside map and never grows")
	check(zone.level >= 1 and zone.radius < WorldConfig.INITIAL_ZONE_RADIUS, "safe zone actually shrinks")
	check(zone.final_pressure and zone.damage_per_second() > 0, "final all-map storm guarantees continued match pressure")
	check(not zone.contains(Vector3(79, 0, 79)), "outside-zone detection works")
	zone.queue_free()
	await frames(1)

func test_navigation() -> void:
	print("\n-- AI NAVIGATION --")
	var audio = SilentAudio.new()
	root.add_child(audio)
	var data = Save.defaults()
	data.settings.bot_count = 3
	var game = MatchController.new()
	game.setup("practice", data, audio)
	root.add_child(game)
	for b in game.bots:
		b.set_physics_process(false)
	game.player.set_physics_process(false)
	var start = Vector3(30, 0.05, -51)
	var goal = Vector3(56, 0.05, -51)
	var bot = game.bots[0]
	bot.global_position = start
	bot.navigation_timer = 0.0
	await frames(2)
	var straight = PhysicsRayQueryParameters3D.create(start + Vector3(0, 1, 0), goal + Vector3(0, 1, 0), 1)
	var blocked = not game.get_world_3d().direct_space_state.intersect_ray(straight).is_empty()
	var path = game.navigator.find_path(start, goal)
	var all_open = true
	for point in path:
		all_open = all_open and game.map.is_open(point, game.navigator.CLEARANCE)
	check(blocked and path.size() > 5 and all_open, "grid finds an unobstructed route around a solid warehouse")
	game.navigator.remaining_requests = 1
	var first = game.navigator.request_path(start, goal)
	var deferred = game.navigator.request_path(start, goal)
	check(first != null and deferred == null, "path requests are limited per physics frame")
	await frames(2)
	var direction = Vector3.ZERO
	for i in 1200:
		if i % 12 == 0:
			direction = bot._avoid_obstacles(bot._navigate_to(goal))
		bot.navigation_timer = maxf(0.0, bot.navigation_timer - 1.0 / 60.0)
		bot.move_actor(direction, 3.8, 1.0 / 60.0)
		await physics_frame
		if Vector2(bot.global_position.x - goal.x, bot.global_position.z - goal.z).length() < 2.0:
			break
	check(Vector2(bot.global_position.x - goal.x, bot.global_position.z - goal.z).length() < 2.0, "bot follows the route around a real collision obstacle")
	game.queue_free()
	audio.queue_free()
	await frames(3)

func test_dynamic_navigation() -> void:
	print("\n-- DYNAMIC COVER NAVIGATION --")
	var audio = SilentAudio.new()
	root.add_child(audio)
	var data = Save.defaults()
	data.settings.bot_count = 3
	var game = MatchController.new()
	game.setup("practice", data, audio)
	root.add_child(game)
	game.player.set_physics_process(false)
	for i in game.bots.size():
		game.bots[i].set_physics_process(false)
		game.bots[i].global_position = Vector3(-140 + i * 5, 0.05, -140)
	var player = game.player
	var bot = game.bots[0]
	var start = Vector3(0, 0.05, 64)
	var goal = Vector3(0, 0.05, 52)
	player.global_position = Vector3(0, 0.05, 60)
	bot.global_position = start
	await frames(3)
	game.navigator.remaining_requests = 4
	bot._navigate_to(goal)
	var old_revision = game.navigator.revision
	game.wall_manager.start_preview(player, 0.0)
	var deployed = game.wall_manager.preview_valid and game.wall_manager.confirm(player)
	var cover: Node3D
	for child in game.wall_manager.get_children():
		if child is StaticBody3D:
			cover = child
			break
	var blocked_id = game.navigator._id_for(cover.global_position) if is_instance_valid(cover) else Vector2i(-1, -1)
	check(deployed and game.navigator.revision > old_revision and game.navigator.dynamic_counts.has(blocked_id) and game.navigator.grid.is_point_solid(blocked_id), "deploying ground-level Gloo cover updates shared navigation occupancy")
	game.navigator.remaining_requests = 4
	bot._navigate_to(goal)
	var route_avoids_cover = not bot.navigation_path.is_empty()
	for point in bot.navigation_path:
		route_avoids_cover = route_avoids_cover and not game.navigator.dynamic_counts.has(game.navigator._id_for(point))
	check(bot.navigation_revision == game.navigator.revision and route_avoids_cover, "bot invalidates its old path and replans around new cover")
	player.global_position = Vector3(20, 0.05, 60)
	await frames(2)
	var direction = Vector3.ZERO
	for i in 1200:
		if i % 12 == 0:
			direction = bot._avoid_obstacles(bot._navigate_to(goal))
		bot.navigation_timer = maxf(0.0, bot.navigation_timer - 1.0 / 60.0)
		bot.move_actor(direction, 3.8, 1.0 / 60.0)
		await physics_frame
		if Vector2(bot.global_position.x - goal.x, bot.global_position.z - goal.z).length() < 2.0:
			break
	check(Vector2(bot.global_position.x - goal.x, bot.global_position.z - goal.z).length() < 2.0, "bot physically travels around a newly placed Gloo Wall")
	var revision_before_break = game.navigator.revision
	cover.take_damage(999, player)
	check(game.navigator.revision > revision_before_break and not game.navigator.dynamic_counts.has(blocked_id) and not game.navigator.grid.is_point_solid(blocked_id), "destroying cover promptly restores its previously open navigation cells")
	# Artificial overlap tests reference counting independently of placement checks.
	var w1 = Wall.new()
	var w2 = Wall.new()
	game.wall_manager.add_child(w1)
	game.wall_manager.add_child(w2)
	w1.global_position = Vector3(0, 0.02, 42)
	w2.global_position = w1.global_position
	game.navigator.add_wall(w1)
	game.navigator.add_wall(w2)
	var shared = game.navigator._id_for(w1.global_position)
	w1.take_damage(999, player)
	check(int(game.navigator.dynamic_counts.get(shared, 0)) == 1 and game.navigator.grid.is_point_solid(shared), "overlapping dynamic obstacles remain blocked until all are removed")
	w2.take_damage(999, player)
	check(not game.navigator.dynamic_counts.has(shared) and not game.navigator.grid.is_point_solid(shared), "the last overlapping obstacle restores the open cell")
	var static_wall = Wall.new()
	game.wall_manager.add_child(static_wall)
	static_wall.global_position = Vector3(43, 0.02, -57)
	var static_id = game.navigator._id_for(static_wall.global_position)
	var was_static = game.navigator.grid.is_point_solid(static_id)
	game.navigator.add_wall(static_wall)
	static_wall.take_damage(999, player)
	check(was_static and game.navigator.grid.is_point_solid(static_id), "removing dynamic cover never erases static building occupancy")
	game.queue_free()
	audio.queue_free()
	await frames(3)

func test_expanded_island() -> void:
	print("\n-- EXPANDED ISLAND / ELEVATION --")
	var audio = SilentAudio.new()
	root.add_child(audio)
	var data = Save.defaults()
	data.settings.bot_count = 3
	var game = MatchController.new()
	game.setup("practice", data, audio)
	root.add_child(game)
	game.player.set_physics_process(false)
	for i in game.bots.size():
		game.bots[i].set_physics_process(false)
		game.bots[i].global_position = Vector3(-140 + i * 5, 0.05, -140)
	await frames(3)
	check(WorldConfig.SIZE == 320.0 and game.map.MAP_HALF == 160.0 and game.navigator.GRID_WIDTH == 128 and game.zone.radius == WorldConfig.INITIAL_ZONE_RADIUS, "terrain, navigation and initial safe zone share the 320 m map dimensions")
	check(WorldConfig.map_uv(Vector2(-160, -160)).is_equal_approx(Vector2.ZERO) and WorldConfig.map_uv(Vector2.ZERO).is_equal_approx(Vector2(0.5, 0.5)) and WorldConfig.map_uv(Vector2(160, 160)).is_equal_approx(Vector2.ONE), "minimap projection maps both island edges and center correctly")
	var names: Array = []
	var populated = true
	for location in game.map.LOCATIONS:
		names.append(location.name)
		var nearby_obstacles := 0
		for obstacle in game.map.obstacles:
			if obstacle.get_center().distance_to(location.center) < 25.0:
				nearby_obstacles += 1
		populated = populated and nearby_obstacles >= 3
	check(names.size() == 10 and names.duplicate().reduce(func(a, name):
		if name not in a: a.append(name)
		return a, []).size() == 10 and populated, "ten distinct named prototype landmarks contain real collision geometry")
	var targeted_loot = true
	for location in game.map.LOCATIONS:
		var count := 0
		for item in game.loot_spawner.loot_items:
			if Vector2(item.global_position.x, item.global_position.z).distance_to(location.center) <= 18.0:
				count += 1
		targeted_loot = targeted_loot and count >= 2
	check(targeted_loot, "each landmark receives usable world loot near its actual location")
	var space = game.get_world_3d().direct_space_state
	var ground_ray = PhysicsRayQueryParameters3D.create(Vector3(-50, 5, 140), Vector3(-50, -1, 140), 1)
	var edge_ray = PhysicsRayQueryParameters3D.create(Vector3(155, 1, 0), Vector3(163, 1, 0), 1)
	check(not space.intersect_ray(ground_ray).is_empty() and not space.intersect_ray(edge_ray).is_empty(), "expanded outer terrain has a physical floor and boundary")
	var raster_matches = true
	for x in range(0, game.navigator.GRID_WIDTH, 7):
		for z in range(0, game.navigator.GRID_WIDTH, 7):
			var id = Vector2i(x, z)
			var p: Vector2 = game.navigator.grid.get_point_position(id)
			var solid: bool = not game.map.is_open(Vector3(p.x, 0, p.y), game.navigator.CLEARANCE)
			raster_matches = raster_matches and game.navigator.grid.is_point_solid(id) == solid
	check(raster_matches, "optimized obstacle rasterization matches actual map clearance across the expanded grid")
	var far_goal = Vector3(145, 0.05, -75)
	var long_path = game.navigator.find_path(Vector3(-145, 0.05, -75), far_goal)
	var path_open = not long_path.is_empty() and long_path.back().distance_to(far_goal) < 3.0
	for point in long_path:
		path_open = path_open and game.map.is_open(point, game.navigator.CLEARANCE)
	check(path_open and long_path.size() > 100, "long-distance AI path spans the enlarged terrain around actual obstacles")
	var open_near_locations = true
	for location in game.map.LOCATIONS:
		var p: Vector3 = game.map.random_open_near(location.center)
		open_near_locations = open_near_locations and game.map.is_open(p, 1.8) and Vector2(p.x, p.z).distance_to(location.center) <= 17.01
	check(open_near_locations, "landmark-area spawn points avoid static geometry")

	var player = game.player
	player.global_position = Vector3(0, 0.05, 135.2)
	await frames(3)
	for i in 240:
		player.move_actor(Vector3.FORWARD, 4.7, 1.0 / 60.0)
		await physics_frame
		if player.global_position.z < 122.5:
			break
	check(player.global_position.z < 122.5 and player.global_position.y > 3.5 and player.is_on_floor(), "real character movement climbs the collision-backed ramp onto the rooftop")
	game.wall_manager.start_preview(player, 0.0)
	var preview_y: float = game.wall_manager.preview_position.y
	var before_walls = player.inventory.walls
	var placed = game.wall_manager.preview_valid and game.wall_manager.confirm(player)
	check(placed and absf(preview_y - 3.665) < 0.1 and player.inventory.walls == before_walls - 1, "Gloo Wall preview and placement use the rooftop surface height")
	check(game.navigator.dynamic_counts.is_empty(), "rooftop cover does not incorrectly block ground-level AI navigation")
	game.wall_manager.cooldown = 0
	player.global_position = Vector3(6.5, 3.645, 117)
	await frames(2)
	game.wall_manager.start_preview(player, -PI / 2.0)
	check(not game.wall_manager.preview_valid, "cover preview rejects unsupported placements beyond a roof edge")
	game.wall_manager.cancel_preview()
	player.global_position = Vector3(0, 3.645, 119)
	var below = game.loot_spawner.spawn("medkit", "", Vector3(0, 0.05, 119))
	var above = game.loot_spawner.spawn("grenade", "", Vector3(0, 3.645, 119))
	check(is_equal_approx(above.global_position.y, 3.645) and game.loot_spawner.nearest(player) == above and game.loot_spawner.pickup(player) == "Frag grenade" and not below.claimed, "rooftop loot keeps its elevation and cannot be picked through a floor")
	player.global_position = Vector3(0, 0.05, 119)
	check(game.loot_spawner.pickup(player) == "Medkit" and below.claimed, "ground-level loot remains collectible from inside the same building")
	var rooftop_bot = game.bots[0]
	rooftop_bot.global_position = Vector3(0, 3.645, 115)
	await frames(2)
	var rooftop_count = game.loot_spawner.loot_items.size()
	rooftop_bot.take_damage(9999, player)
	var rooftop_drop = game.loot_spawner.loot_items[rooftop_count]
	check(absf(rooftop_drop.global_position.y - 3.695) < 0.1, "an eliminated rooftop bot drops supplies on the roof, not through it")
	game.queue_free()
	audio.queue_free()
	await frames(3)

func test_deployment() -> void:
	print("\n-- AIRCRAFT / PARACHUTE DEPLOYMENT --")
	var audio = SilentAudio.new()
	root.add_child(audio)
	var data = Save.defaults()
	data.settings.bot_count = 3
	var game = MatchController.new()
	game.setup("battle", data, audio)
	root.add_child(game)
	game.set_physics_process(false)
	game.player.set_physics_process(false)
	for bot in game.bots:
		bot.set_physics_process(false)
	var player = game.player
	var flight = game.deployment
	var bots_aboard = true
	for bot in game.bots:
		bots_aboard = bots_aboard and bot.deployment_state == "aboard" and bot.collision_layer == 0
	check(is_instance_valid(flight) and player.deployment_state == "aboard" and player.collision_layer == 0 and player.head_area.collision_layer == 0 and bots_aboard, "battle begins with player and bots aboard a non-colliding aircraft")
	var initial_x = flight.plane.global_position.x
	var initial_zone_time = game.zone.timer
	game._physics_process(5.0)
	check(flight.plane.global_position.x > initial_x and player.global_position.is_equal_approx(flight.plane.global_position) and game.zone.timer == initial_zone_time, "aircraft moves across the map while the safe-zone timer waits")
	check(game.bots[0].deployment_state == "glide" and game.bots[1].deployment_state == "aboard", "bots depart on staggered schedules instead of teleporting to the ground")
	var rounds = player.inventory.current().magazine
	var grenades = player.inventory.grenades
	player._try_fire()
	player.action("grenade")
	player.action("ability")
	check(player.inventory.current().magazine == rounds and player.inventory.grenades == grenades and player.ability_cooldown == 0.0, "weapons and abilities cannot be used from the aircraft")
	player.action("jump")
	check(player.deployment_state == "glide" and player.collision_layer == 2 and player.head_area.collision_layer == 4 and is_instance_valid(player.deployment_canopy) and not flight.jump(player), "manual jump opens a parachute and restores real collision exactly once")
	var start = player.global_position
	player.touch_move = Vector2(1, 0)
	for i in 60:
		player._physics_process(1.0 / 60.0)
		await physics_frame
	check(player.global_position.x > start.x + 8.0 and player.global_position.y < start.y - 5.0, "parachute steering changes real horizontal motion while descending")
	player.touch_move = Vector2.ZERO
	for i in 700:
		if player.deployment_state == "ground":
			break
		player._physics_process(1.0 / 60.0)
		await physics_frame
	check(player.deployment_state == "ground" and player.is_on_floor() and player.deployment_canopy == null and player.health == 100.0, "player lands on real terrain, removes the canopy and takes no fall damage")
	for step in 3:
		game._physics_process(6.0)
	check(game.zone.timer == initial_zone_time, "safe zone remains paused while surviving bots are still gliding")
	for i in 750:
		for bot in game.bots:
			if bot.deployment_state == "glide":
				bot._physics_process(1.0 / 60.0)
		game._physics_process(1.0 / 60.0)
		await physics_frame
		if flight.completed:
			break
	var bots_landed = true
	for bot in game.bots:
		bots_landed = bots_landed and bot.deployment_state == "ground" and bot.is_on_floor()
	check(flight.completed and bots_landed and not flight.plane.visible and game.zone.timer < initial_zone_time, "bots land physically and the safe-zone countdown starts after deployment")
	game.queue_free()
	await frames(3)
	var automatic = MatchController.new()
	automatic.setup("battle", data, audio)
	root.add_child(automatic)
	automatic.set_physics_process(false)
	automatic.player.set_physics_process(false)
	for bot in automatic.bots:
		bot.set_physics_process(false)
	automatic.deployment.advance(automatic.deployment.FLIGHT_DURATION - 1.0)
	var waited_aboard = automatic.player.deployment_state == "aboard"
	automatic.deployment.advance(2.0)
	check(waited_aboard and automatic.player.deployment_state == "glide" and not automatic.deployment.plane.visible, "player is automatically dropped at the end of the flight if they do not jump")
	var airborne_bot = automatic.bots[0]
	airborne_bot.global_position = Vector3(0, 35, 0)
	await frames(2)
	var before_drop = automatic.loot_spawner.loot_items.size()
	airborne_bot.take_damage(9999, automatic.player)
	var airborne_drop = automatic.loot_spawner.loot_items[before_drop]
	check(airborne_drop.global_position.y < 0.2, "a bot eliminated while gliding drops loot onto the surface below")
	automatic.queue_free()
	audio.queue_free()
	await frames(3)

func remove_test_files(path: String) -> void:
	for suffix in ["", ".bak", ".tmp"]:
		var absolute = ProjectSettings.globalize_path(path + suffix)
		if FileAccess.file_exists(path + suffix):
			DirAccess.remove_absolute(absolute)

func test_save() -> void:
	print("\n-- SAVE / PROGRESSION --")
	var path = "user://ffb_automated_test.json"
	remove_test_files(path)
	var save = Save.new(path)
	check(save.load_data().progress.xp == 0, "missing save starts with safe defaults")
	save.data.settings.sensitivity = 164
	save.data.settings.auto_pickup = false
	save.data.progress.character = 3
	check(save.save_data(), "local save written")
	var loaded = Save.new(path)
	loaded.load_data()
	check(int(loaded.data.settings.sensitivity) == 164 and not loaded.data.settings.auto_pickup and loaded.data.progress.character == 3, "settings and character persist across reload")
	loaded.data.progress.training_weapon = "sr_02"
	loaded.save_data()
	var expanded = Save.new(path)
	expanded.load_data()
	check(expanded.data.progress.training_weapon == "sr_02", "new weapon selections survive local save validation")
	var result = {"victory": true, "kills": 5, "headshots": 3, "damage_dealt": 1000, "walls": 5, "xp": 500, "currency": 25, "mode": "practice", "placement": 1}
	var unlocked = loaded.record_match(result)
	check(unlocked.size() == 5 and loaded.data.progress.currency == 575, "offline missions grant each local reward once")
	check(loaded.data.progress.totals.wins == 1 and loaded.level() == 2 and loaded.data.progress.history.size() == 1, "match updates wins, experience, level and history")
	loaded.save_data() # Make a last-good backup containing the recorded match.
	var bad = FileAccess.open(path, FileAccess.WRITE)
	bad.store_string("{ broken json")
	bad.close()
	var recovered = Save.new(path)
	recovered.load_data()
	check(recovered.data.progress.totals.wins == 1 and int(recovered.data.settings.sensitivity) == 164, "corrupt primary save recovers last-good backup")
	recovered.reset_progress()
	bad = FileAccess.open(path, FileAccess.WRITE)
	bad.store_string("broken")
	bad.close()
	var after_reset = Save.new(path)
	after_reset.load_data()
	check(after_reset.data.progress.totals.wins == 0, "reset progress cannot be resurrected from the backup")
	remove_test_files(path)
	bad = FileAccess.open(path, FileAccess.WRITE)
	bad.store_string('{"version":[],"settings":{}}')
	bad.close()
	var malformed = Save.new(path)
	malformed.load_data()
	check(malformed.data.progress.xp == 0, "invalid save schema falls back without crashing")
	bad = FileAccess.open(path, FileAccess.WRITE)
	bad.store_string('{"version":1,"progress":{"history":[{"mode":{},"placement":[],"kills":{},"damage_dealt":null,"weapons":[{},"Pistol-01"]}]}}')
	bad.close()
	malformed.load_data()
	var entry = malformed.data.progress.history[0]
	check(entry.mode == "match" and entry.placement == 0 and entry.kills == 0 and entry.weapons == ["Pistol-01"], "malformed history fields are sanitized before reaching UI")
	remove_test_files(path)

func settings_row(page: Control, title: String) -> HBoxContainer:
	for node in page.content.get_children():
		if node is HBoxContainer and node.get_child_count() > 1 and node.get_child(0) is Label and node.get_child(0).text == title:
			return node
	return null

func test_app_and_touch() -> void:
	print("\n-- LOBBY / TOUCH / TRAINING / PAUSE --")
	var app = Game.new()
	app.save_manager.path = "user://ffb_app_test.json"
	remove_test_files(app.save_manager.path)
	root.add_child(app)
	await process_frame
	check(is_instance_valid(app.current) and app.current.has_method("_open_armory"), "application starts in a working lobby")
	app.current._open_armory()
	check(app.current.modal.find_children("*", "Button", true, false).size() >= 13, "scrollable armory exposes all twelve weapons and back action")
	app.current._select_training_weapon("smg_01")
	check(app.save_manager.data.progress.training_weapon == "smg_01", "armory selects a real training loadout")
	app.current._open_stats()
	app.current._close_modal()
	app.current._open_missions()
	app.current._close_modal()
	app._open_settings()
	check(is_instance_valid(app.settings_overlay), "settings screen opens from lobby")
	var sensitivity = settings_row(app.settings_overlay, "Camera sensitivity").get_child(1) as HSlider
	sensitivity.value = 120
	var automatic = settings_row(app.settings_overlay, "Automatic pickup").get_child(1) as CheckButton
	automatic.button_pressed = false
	check(int(app.save_manager.data.settings.sensitivity) == 120 and not app.save_manager.data.settings.auto_pickup, "settings sliders and switches update live configuration")
	app.settings_overlay.edit_layout_requested.emit()
	await process_frame
	var editor = app.hud_editor
	check(is_instance_valid(editor), "touch layout editor opens from the settings screen")
	var edit_touch = InputEventScreenTouch.new()
	edit_touch.index = 17
	edit_touch.pressed = true
	edit_touch.position = editor._screen_pos(Vector2(1134, 478))
	editor._input(edit_touch)
	var edit_drag = InputEventScreenDrag.new()
	edit_drag.index = 17
	edit_drag.position = editor._screen_pos(Vector2(960, 320))
	editor._input(edit_drag)
	edit_touch.pressed = false
	editor._input(edit_touch)
	editor._save()
	await process_frame
	check(app.save_manager.data.settings.hud_positions.fire == [960.0, 320.0], "touch drag saves the new fire-button position")
	app._open_hud_editor()
	await process_frame
	app.hud_editor._compact()
	check(app.hud_editor.working_positions.joystick[0] > 134.0, "compact HUD preset moves controls inward")
	app.hud_editor._cancel()
	await process_frame
	check(app.save_manager.data.settings.hud_positions.fire == [960.0, 320.0], "cancel discards unsaved layout edits")
	app.save_manager.data.settings.left_handed = true
	app._open_hud_editor()
	await process_frame
	editor = app.hud_editor
	var mirrored = editor._screen_pos(Vector2(320, 320))
	editor._begin_drag(22, editor._virtual_pos(mirrored))
	editor._drag_to(Vector2(360, 300))
	editor._end_drag(22)
	editor._save()
	await process_frame
	check(app.save_manager.data.settings.hud_positions.fire == [920.0, 300.0], "left-handed drag is stored in reusable unmirrored coordinates")
	app.save_manager.data.settings.left_handed = false
	var quality = settings_row(app.settings_overlay, "Graphics preset").get_child(1) as OptionButton
	quality.select(0)
	quality.item_selected.emit(0)
	check(app.save_manager.data.settings.quality == "LOW" and is_equal_approx(root.scaling_3d_scale, 0.7), "graphics setting changes 3D resolution scale")
	var volume = settings_row(app.settings_overlay, "Master effects volume %").get_child(1) as HSlider
	volume.value = 0 # Dummy audio driver has no real mixer time in fixed-FPS tests.
	app.settings_overlay._close()
	var reloaded_settings = Save.new(app.save_manager.path)
	reloaded_settings.load_data()
	check(int(reloaded_settings.data.settings.sensitivity) == 120 and not reloaded_settings.data.settings.auto_pickup and reloaded_settings.data.settings.hud_positions.fire == [920.0, 300.0], "settings and custom HUD positions persist when closed")
	app._start_match("training")
	await frames(3)
	var match_game = app.match_game
	var player = match_game.player
	var hud = app.hud
	check(match_game.targets.size() == 4 and player.inventory.current().id == "smg_01" and player.inventory.unlimited, "training spawns moving/stationary targets and selected unlimited-reserve weapon")
	var touch = InputEventScreenTouch.new()
	touch.index = 0
	touch.pressed = true
	touch.position = hud._screen_pos(Vector2(134, 569))
	hud._input(touch)
	var drag = InputEventScreenDrag.new()
	drag.index = 0
	drag.position = hud._screen_pos(Vector2(134, 496))
	drag.relative = Vector2(0, -73)
	hud._input(drag)
	var previous = player.global_position
	await frames(45)
	check(player.global_position.distance_to(previous) > 2.0, "virtual joystick drives real 3D player movement")
	var simultaneous_fire = InputEventScreenTouch.new()
	simultaneous_fire.index = 33
	simultaneous_fire.pressed = true
	var simultaneous_pos = hud._button_geometry("fire")
	simultaneous_fire.position = hud._screen_pos(Vector2(simultaneous_pos.x, simultaneous_pos.y))
	var rounds_before_multi = player.inventory.current().magazine
	hud._input(simultaneous_fire)
	var simultaneous_look = InputEventScreenTouch.new()
	simultaneous_look.index = 34
	simultaneous_look.pressed = true
	simultaneous_look.position = hud._screen_pos(Vector2(745, 300))
	hud._input(simultaneous_look)
	var simultaneous_drag = InputEventScreenDrag.new()
	simultaneous_drag.index = 34
	simultaneous_drag.position = hud._screen_pos(Vector2(775, 290))
	simultaneous_drag.relative = Vector2(30, -10)
	var multi_yaw = player.yaw
	hud._input(simultaneous_drag)
	await frames(18)
	check(player.touch_move.length() > 0.9 and player.fire_held and player.inventory.current().magazine < rounds_before_multi and not is_equal_approx(player.yaw, multi_yaw), "three simultaneous touch pointers move, fire and rotate the camera independently")
	simultaneous_fire.pressed = false
	hud._input(simultaneous_fire)
	simultaneous_look.pressed = false
	hud._input(simultaneous_look)
	touch.pressed = false
	hud._input(touch)
	check(player.touch_move == Vector2.ZERO, "releasing the joystick stops touch movement")
	var original_hud_size = hud.size
	hud.size = Vector2(2340, 1080)
	var test_virtual = Vector2(1134, 478)
	check(hud._virtual_pos(hud._screen_pos(test_virtual)).distance_to(test_virtual) < 0.01, "widescreen HUD coordinates round-trip through scale and letterbox offset")
	hud.size = original_hud_size
	var look_touch = InputEventScreenTouch.new()
	look_touch.index = 1
	look_touch.pressed = true
	look_touch.position = hud._screen_pos(Vector2(745, 300))
	hud._input(look_touch)
	var look_drag = InputEventScreenDrag.new()
	look_drag.index = 1
	look_drag.position = hud._screen_pos(Vector2(790, 280))
	look_drag.relative = Vector2(45, -20)
	var before_yaw = player.yaw
	hud._input(look_drag)
	check(not is_equal_approx(player.yaw, before_yaw), "touch drag rotates the third-person camera")
	look_touch.pressed = false
	hud._input(look_touch)
	var fire = InputEventScreenTouch.new()
	fire.index = 2
	fire.pressed = true
	var fire_position = hud._button_geometry("fire")
	fire.position = hud._screen_pos(Vector2(fire_position.x, fire_position.y))
	var ammunition = player.inventory.current().magazine
	hud._input(fire)
	await frames(18)
	fire.pressed = false
	hud._input(fire)
	check(player.inventory.current().magazine < ammunition and not player.fire_held, "holding and releasing touch FIRE fires real ammunition")
	player.action("reload")
	var reloading_magazine = player.inventory.current().magazine
	player.fire_held = true
	await frames(15)
	player.fire_held = false
	check(player.inventory.current().magazine == reloading_magazine, "player cannot fire while reloading")
	await frames(120)
	check(player.inventory.current().magazine == int(player.inventory.current().data.magazine), "training reload refills magazine with unlimited reserve")
	player.inventory.current().attach_optic("scope_4x")
	var aim_touch = InputEventScreenTouch.new()
	aim_touch.index = 9
	aim_touch.pressed = true
	var aim_pos = hud._button_geometry("scope")
	aim_touch.position = hud._screen_pos(Vector2(aim_pos.x, aim_pos.y))
	hud._input(aim_touch)
	await frames(30)
	check(player.scoped and player.camera.fov < 24.0, "touch AIM uses the 4x optic's actual camera zoom")
	aim_touch.pressed = false
	hud._input(aim_touch)
	aim_touch.pressed = true
	hud._input(aim_touch)
	aim_touch.pressed = false
	hud._input(aim_touch)
	check(not player.scoped, "touch AIM toggles back to third-person view")
	var frag_touch = InputEventScreenTouch.new()
	frag_touch.index = 8
	frag_touch.pressed = true
	var frag_pos = hud._button_geometry("grenade")
	frag_touch.position = hud._screen_pos(Vector2(frag_pos.x, frag_pos.y))
	var before_frags = get_nodes_in_group("frag_grenades").size()
	hud._input(frag_touch)
	frag_touch.pressed = false
	hud._input(frag_touch)
	check(get_nodes_in_group("frag_grenades").size() == before_frags + 1 and player.inventory.grenades == 3, "touch FRAG throws a projectile with unlimited training supply")
	var skill_touch = InputEventScreenTouch.new()
	skill_touch.index = 10
	skill_touch.pressed = true
	var skill_pos = hud._button_geometry("ability")
	skill_touch.position = hud._screen_pos(Vector2(skill_pos.x, skill_pos.y))
	var previous_armor = player.armor
	hud._input(skill_touch)
	skill_touch.pressed = false
	hud._input(skill_touch)
	check(player.armor > previous_armor and player.ability_cooldown > 0.0, "touch SKILL activates the selected operator ability")
	player.health = 50
	var medkits = player.inventory.medkits
	player.action("heal")
	check(player.healing_remaining > 0, "medkit begins a timed healing action")
	player.take_damage(5, null, false)
	check(player.healing_remaining == 0 and player.inventory.medkits == medkits, "damage interrupts healing without consuming a kit")
	player.action("heal")
	await frames(150)
	check(player.health == 100 and player.inventory.medkits == medkits - 1, "completed healing consumes one kit and caps health")
	player.action("crouch")
	check(player.crouched and player.head_area.position.y < 1.3, "crouching lowers the real head hitbox")
	player.action("crouch")
	player.global_position = Vector3(0, 0.05, 53)
	player.yaw = 0
	await frames(3)
	player.action("wall")
	check(match_game.wall_manager.preview_active, "wall action enters placement-preview state")
	player.action("wall")
	check(not match_game.wall_manager.preview_active and match_game.stats.walls == 1, "second wall action confirms functional cover")
	app._pause_match()
	var paused_elapsed = match_game.elapsed
	await frames(30)
	check(paused and is_equal_approx(match_game.elapsed, paused_elapsed), "pause freezes gameplay simulation")
	app._resume_match()
	await frames(10)
	check(not paused and match_game.elapsed > paused_elapsed, "resume continues gameplay")
	app.save_manager.data.settings.bot_count = 3
	app._start_match("battle")
	await frames(2)
	var flight_player = app.match_game.player
	var drop_touch = InputEventScreenTouch.new()
	drop_touch.index = 23
	drop_touch.pressed = true
	var drop_pos = app.hud._button_geometry("jump")
	drop_touch.position = app.hud._screen_pos(Vector2(drop_pos.x, drop_pos.y))
	app.hud._input(drop_touch)
	drop_touch.pressed = false
	app.hud._input(drop_touch)
	check(flight_player.deployment_state == "glide" and is_instance_valid(flight_player.deployment_canopy), "touch DROP leaves the aircraft and opens a parachute")
	var steer = InputEventScreenTouch.new()
	steer.index = 24
	steer.pressed = true
	var joy = app.hud._button_geometry("joystick")
	steer.position = app.hud._screen_pos(Vector2(joy.x + joy.z, joy.y))
	var before_steer = flight_player.global_position
	app.hud._input(steer)
	await frames(30)
	steer.pressed = false
	app.hud._input(steer)
	check(flight_player.global_position.x > before_steer.x + 3.0 and flight_player.global_position.y < before_steer.y, "touch joystick steers a real parachute descent")
	app.match_game.deployment.advance(app.match_game.deployment.FLIGHT_DURATION)
	for bot in app.match_game.bots:
		bot._die(flight_player)
	# Victory waits for the player's actual landing and deployment completion.
	for i in 700:
		await physics_frame
		if is_instance_valid(app.overlay):
			break
	await process_frame
	check(is_instance_valid(app.overlay) and app.overlay.get("result") != null and bool(app.overlay.result.victory) and paused, "real match completion opens a paused victory results screen")
	check(app.save_manager.data.progress.totals.wins == 1, "match results are saved to offline progression")
	app.overlay.lobby_requested.emit()
	await process_frame
	check(app.current != null and app.current.has_method("_open_armory") and not paused, "results lobby action resumes the application")
	var app_path = app.save_manager.path
	app.queue_free()
	await frames(3)
	remove_test_files(app_path)

func test_match_results_and_bot_visibility() -> void:
	print("\n-- BOT VISIBILITY / VICTORY / DEFEAT --")
	var audio = SilentAudio.new()
	root.add_child(audio)
	var data = Save.defaults()
	data.settings.bot_count = 3
	var match_game = MatchController.new()
	match_game.setup("practice", data, audio)
	root.add_child(match_game)
	for bot in match_game.bots:
		bot.set_physics_process(false)
	match_game.player.set_physics_process(false)
	match_game.bots[0].global_position = Vector3(0, 0.05, 0)
	match_game.bots[1].global_position = Vector3(70, 0.05, 70)
	match_game.bots[2].global_position = Vector3(5, 0.05, 0)
	match_game.player.global_position = Vector3(0, 0.05, -10)
	var cover = Wall.new()
	cover.position = Vector3(0, 0, -5)
	match_game.add_child(cover)
	await frames(4)
	check(not match_game.bots[0]._line_of_sight(match_game.player), "bot cannot see player through a solid wall")
	var player_rounds = match_game.player.inventory.current().magazine
	match_game.player._try_fire()
	var listener = match_game.bots[0]
	check(match_game.player.inventory.current().magazine == player_rounds - 1 and listener.memory_remaining > 0.0 and not listener.target_visible and listener.target == null and listener.last_seen.distance_to(match_game.player.global_position) < 3.0, "real player gunfire gives nearby bots an approximate investigation point, not sight")
	check(match_game.bots[1].memory_remaining == 0.0, "distant bots cannot hear gunfire beyond its bounded range")
	var listener2 = match_game.bots[2]
	listener2.memory_remaining = 0.0
	listener2.hearing_cooldown = 0.0
	var bot_rounds = listener.inventory.current().magazine
	listener._fire_at(match_game.player)
	check(listener.inventory.current().magazine == bot_rounds - 1 and listener2.memory_remaining > 0.0, "bot gunfire is also audible to other nearby bots")
	cover.queue_free()
	await frames(4)
	check(match_game.bots[0]._line_of_sight(match_game.player), "bot can see unobstructed player")
	match_game.player.armor = 0
	match_game.zone.radius = 1.0
	match_game.zone.center = Vector2(50, 50)
	match_game.zone_damage_timer = 0.01
	await frames(3)
	check(match_game.player.health < 100, "zone damage reaches an actor outside the safe circle")
	match_game.player.health = 100
	match_game.zone.radius = WorldConfig.INITIAL_ZONE_RADIUS
	match_game.zone.center = Vector2.ZERO
	var result_box: Array = []
	match_game.finished.connect(func(result): result_box.append(result))
	for bot in match_game.bots:
		bot.take_damage(9999, match_game.player)
	await process_frame
	await process_frame
	check(result_box.size() == 1 and result_box[0].victory and result_box[0].placement == 1 and result_box[0].kills == 3, "last living player wins and eliminations are counted")
	match_game.queue_free()
	await frames(3)
	var defeat = MatchController.new()
	defeat.setup("practice", data, audio)
	root.add_child(defeat)
	for bot in defeat.bots:
		bot.set_physics_process(false)
	defeat.player.set_physics_process(false)
	await frames(2)
	var defeat_box: Array = []
	defeat.finished.connect(func(result): defeat_box.append(result))
	defeat.bots[0].take_damage(9999, defeat.player)
	defeat.bots[1].take_damage(9999, defeat.player)
	defeat.player.take_damage(9999, defeat.bots[2])
	defeat.bots[2].take_damage(9999, defeat.player)
	await process_frame
	await process_frame
	check(defeat_box.size() == 1 and not defeat_box[0].victory and defeat_box[0].placement == 2, "simultaneous final elimination cannot award victory to a dead player")
	defeat.queue_free()
	audio.queue_free()
	await frames(3)
