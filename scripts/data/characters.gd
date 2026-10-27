extends RefCounted
## Eight original operators with small, cooldown-limited gameplay abilities.
const ROSTER = [
	{"name": "VEER", "ability": "bulwark", "ability_name": "BULWARK", "ability_desc": "Restore 30 armor", "ability_cooldown": 35.0, "role": "BALANCED", "color": Color(0.26, 0.43, 0.40), "accent": Color(0.95, 0.60, 0.27)},
	{"name": "AARAV", "ability": "steady", "ability_name": "STEADY HANDS", "ability_desc": "Reduce weapon spread for 6 seconds", "ability_cooldown": 45.0, "role": "TACTICAL", "color": Color(0.25, 0.36, 0.48), "accent": Color(0.84, 0.75, 0.45)},
	{"name": "KAVYA", "ability": "recon", "ability_name": "SIGNAL SCAN", "ability_desc": "Reveal nearby opponents for 6 seconds", "ability_cooldown": 50.0, "role": "RECON", "color": Color(0.35, 0.36, 0.51), "accent": Color(0.98, 0.68, 0.53)},
	{"name": "ARJUN", "ability": "rush", "ability_name": "ADRENALINE", "ability_desc": "Move 25% faster for 6 seconds", "ability_cooldown": 40.0, "role": "VANGUARD", "color": Color(0.40, 0.40, 0.32), "accent": Color(0.87, 0.48, 0.30)},
	{"name": "MIRA", "ability": "terrain", "ability_name": "TERRAIN GUARD", "ability_desc": "Halve environmental damage for 6 seconds", "ability_cooldown": 50.0, "role": "PATHFINDER", "color": Color(0.29, 0.46, 0.45), "accent": Color(0.94, 0.81, 0.54)},
	{"name": "RUDRA", "ability": "repair", "ability_name": "FIELD REPAIR", "ability_desc": "Recover 25 health", "ability_cooldown": 45.0, "role": "SURVIVAL", "color": Color(0.40, 0.30, 0.29), "accent": Color(0.84, 0.60, 0.41)},
	{"name": "TARA", "ability": "reload", "ability_name": "RELOAD DRILL", "ability_desc": "Reload current weapon immediately", "ability_cooldown": 40.0, "role": "SCOUT", "color": Color(0.36, 0.43, 0.30), "accent": Color(0.87, 0.73, 0.31)},
	{"name": "DEV", "ability": "cover", "ability_name": "COVER RESERVE", "ability_desc": "Gain one Gloo Wall", "ability_cooldown": 55.0, "role": "RANGER", "color": Color(0.32, 0.35, 0.39), "accent": Color(0.91, 0.58, 0.35)},
]
