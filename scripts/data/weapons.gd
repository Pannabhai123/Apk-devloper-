extends RefCounted
## All weapons are original gameplay configurations. Distances are in metres.

const DEFINITIONS = {
	"pistol_01": {"name": "Pistol-01", "category": "SIDEARM", "damage": 23.0, "head": 1.8, "interval": 0.32, "reload": 1.35, "magazine": 12, "reserve": 48, "max_reserve": 96, "spread": 0.018, "recoil": 0.010, "range": 90.0, "pellets": 1, "color": Color(0.80, 0.82, 0.78)},
	"ar_01": {"name": "AR-01 Balanced", "category": "ASSAULT RIFLE", "damage": 20.0, "head": 1.8, "interval": 0.14, "reload": 1.9, "magazine": 30, "reserve": 90, "max_reserve": 180, "spread": 0.012, "recoil": 0.008, "range": 135.0, "pellets": 1, "color": Color(0.94, 0.70, 0.30)},
	"smg_01": {"name": "SMG-01 Compact", "category": "SUBMACHINE GUN", "damage": 14.0, "head": 1.7, "interval": 0.085, "reload": 1.6, "magazine": 32, "reserve": 96, "max_reserve": 192, "spread": 0.021, "recoil": 0.009, "range": 70.0, "pellets": 1, "color": Color(0.39, 0.84, 0.74)},
	"sg_01": {"name": "SG-01 Pump", "category": "SHOTGUN", "damage": 9.0, "head": 1.5, "interval": 0.85, "reload": 2.15, "magazine": 6, "reserve": 30, "max_reserve": 60, "spread": 0.055, "recoil": 0.035, "range": 32.0, "pellets": 8, "color": Color(0.90, 0.48, 0.31)},
	"sr_01": {"name": "SR-01 Scout", "category": "MARKSMAN", "damage": 68.0, "head": 2.0, "interval": 1.15, "reload": 2.4, "magazine": 5, "reserve": 25, "max_reserve": 50, "spread": 0.003, "recoil": 0.035, "range": 180.0, "pellets": 1, "color": Color(0.67, 0.65, 0.96)},
	"lmg_01": {"name": "LMG-01 Support", "category": "LIGHT MACHINE GUN", "damage": 18.0, "head": 1.7, "interval": 0.12, "reload": 3.1, "magazine": 60, "reserve": 120, "max_reserve": 240, "spread": 0.024, "recoil": 0.012, "range": 115.0, "pellets": 1, "color": Color(0.75, 0.82, 0.42)},
	"pistol_02": {"name": "Pistol-02 Heavy", "category": "SIDEARM", "damage": 31.0, "head": 1.9, "interval": 0.48, "reload": 1.55, "magazine": 8, "reserve": 40, "max_reserve": 80, "spread": 0.015, "recoil": 0.014, "range": 95.0, "pellets": 1, "color": Color(0.70, 0.73, 0.68)},
	"ar_02": {"name": "AR-02 Precision", "category": "ASSAULT RIFLE", "damage": 26.0, "head": 1.8, "interval": 0.18, "reload": 2.0, "magazine": 24, "reserve": 96, "max_reserve": 192, "spread": 0.008, "recoil": 0.007, "range": 150.0, "pellets": 1, "color": Color(0.82, 0.73, 0.43)},
	"smg_02": {"name": "SMG-02 Steady", "category": "SUBMACHINE GUN", "damage": 16.0, "head": 1.7, "interval": 0.105, "reload": 1.7, "magazine": 36, "reserve": 108, "max_reserve": 216, "spread": 0.016, "recoil": 0.007, "range": 82.0, "pellets": 1, "color": Color(0.37, 0.69, 0.67)},
	"sg_02": {"name": "SG-02 Rapid", "category": "SHOTGUN", "damage": 7.0, "head": 1.5, "interval": 0.48, "reload": 2.4, "magazine": 8, "reserve": 32, "max_reserve": 64, "spread": 0.063, "recoil": 0.027, "range": 28.0, "pellets": 8, "color": Color(0.88, 0.59, 0.40)},
	"sr_02": {"name": "SR-02 Longshot", "category": "MARKSMAN", "damage": 83.0, "head": 2.1, "interval": 1.55, "reload": 2.7, "magazine": 4, "reserve": 20, "max_reserve": 40, "spread": 0.002, "recoil": 0.043, "range": 200.0, "pellets": 1, "color": Color(0.58, 0.57, 0.84)},
	"lmg_02": {"name": "LMG-02 Heavy", "category": "LIGHT MACHINE GUN", "damage": 22.0, "head": 1.7, "interval": 0.16, "reload": 3.4, "magazine": 75, "reserve": 150, "max_reserve": 225, "spread": 0.020, "recoil": 0.013, "range": 125.0, "pellets": 1, "color": Color(0.65, 0.73, 0.38)},
}
const ORDER = ["pistol_01", "pistol_02", "ar_01", "ar_02", "smg_01", "smg_02", "sg_01", "sg_02", "sr_01", "sr_02", "lmg_01", "lmg_02"]

static func get_data(id: String) -> Dictionary:
	return DEFINITIONS.get(id, DEFINITIONS["pistol_01"]).duplicate(true)
