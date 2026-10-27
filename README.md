# Free Fire Bharat — offline 3D prototype

A **playable vertical slice**, not the complete production game described in the original brief. It is a native **Godot 4.7.2 / GDScript** project, not a website. Gameplay is local and has no accounts, advertisements, servers, or runtime network code. The Android preset disables the Internet permission, but an exported APK's manifest still needs verification after a successful build.

**Build status:** the development sandbox lacks the Android SDK, Java SDK and matching Android export templates, so its local export attempt failed. A GitHub Actions workflow can build a debug prototype and publish a prerelease when explicitly requested; check that workflow and the repository releases for the result. **No Android device or emulator gameplay test has been performed.** See [Android build instructions](docs/ANDROID_BUILD.md).

## What is playable now

- Third-person movement, sprint, jump, crouch, shoulder camera and aiming, with desktop and multitouch controls.
- Solo Battle Royale (3–49 bots), Practice Match (up to 15 bots), and Training Ground (stationary and moving targets, headshot/accuracy readout, unlimited reserve ammo, grenades and Gloo Walls; medkits are limited).
- An original approximately **320 × 320 m** intermediate Bharat Island test map with ten small named landmarks, roads, collision-backed structures, distributed loot and boundaries. A watchpost has a walkable ramp and rooftop. These are low-detail prototype areas, **not** the requested 1.5 km production map or fully authored locations.
- Twelve original data-driven firearms across six roles: sidearm, assault rifle, SMG, shotgun, marksman rifle and LMG. Hitscan physics includes separate head/body hitboxes, pellet spread, fire rate, recoil, magazines, reserve ammunition, reload timing and hit feedback.
- Two weapon slots and manual/automatic pickup; ammo, armor, medkits and Gloo Wall inventory limits. Healing takes time and is interrupted by damage. Red-dot, 2× and 4× optics attach to the selected weapon and change aim FOV and shot spread; they use simple HUD reticles, not modeled scope interiors.
- Gloo Wall preview/confirmation, invalid-placement detection, physical collision, bullet blocking, durability and destruction. Frag grenades are physics projectiles with a timed fuse, cover-aware damage falloff and a bounded inventory; bots can throw them too.
- Battle matches begin with an aircraft flyover: tap **DROP** / press Space to jump, steer a parachute, and land; bots depart on a schedule. An automatic drop prevents staying aboard forever. The safe-zone countdown starts after flight and all surviving actors have landed. Practice and training start on the ground.
- A shrinking safe zone, next-zone preview on the minimap, escalating damage and a final storm. Bots fight the player **and each other**, loot, heal, move toward the zone and may deploy walls. A shared obstacle grid updates when ground-level Gloo Walls are placed or destroyed, and local probes handle nearby collisions. Bots can investigate nearby gunfire but need line of sight to shoot; a temporary recon ability can reveal nearby opponents through cover.
- Eight original palette-based operators with distinct cooldown abilities: armor repair, steadier aim, a short-range scan, faster movement, environmental damage reduction, healing, instant reserve-based reload, and one extra Gloo Wall. Bots can use them as well. Models and animations remain primitive.
- Interactive lobby preview and scrollable training loadout selector; offline statistics, five local missions, experience and currency; local settings and progress with save backup recovery.
- Customizable touch HUD with drag-to-position controls, default/compact presets, left-handed mirroring, button size and opacity. Pause remains fixed. Match results include a dead-player victory guard.
- Original procedural geometry, a vector shield logo, and locally synthesized sound effects. No third-party game assets are copied or downloaded at runtime.

## Open and run

1. Install the standard (non-.NET) **Godot 4.7.2 stable** editor and its matching export templates from the official Godot download page.
2. In Godot's Project Manager, choose **Import**, select this repository's `project.godot`, and open it. Wait for the first import to finish.
3. Press **F5** (run the main project) and choose a mode. On a desktop, click a mode to capture the mouse; press **Esc** to pause/release it.

You can also run from a terminal with `godot --path .` after the first import. A graphics-capable desktop display or an exported Android build is required to see and play the game; headless execution is for tests only.

## Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Move / sprint | WASD / Shift | Left joystick / push to edge |
| Aim / fire | Mouse / left mouse | Drag on empty screen or drag from **FIRE**; hold **FIRE** |
| Aim down sights | Hold right mouse | Tap **AIM** to toggle |
| Battle deployment | Space to drop, WASD to steer | **DROP**, then joystick to steer |
| Jump / crouch on the ground | Space / C | **JUMP** / **CROUCH** |
| Reload / swap | R / Q | **RELOAD** / **SWAP** |
| Pick up nearby loot | E | **PICK** |
| Heal | H | **HEAL** |
| Gloo Wall | G once to preview, G again to place; X cancels | **WALL**, then **PLACE**; **X** cancels |
| Frag grenade / operator skill | T / F | **FRAG** / **SKILL** |
| Pause | Esc | **II** |

While aboard or gliding, combat controls are hidden until landing; pause and camera look still work. Green wall previews are valid; red previews are blocked, including unsupported roof edges and slopes. Auto-pickup will not replace a full weapon slot; use **PICK** / E to replace the selected weapon. Auto-pickup only upgrades an optic; manual pickup may replace it with a lower-ranked optic. Open **Settings → Customize Touch Layout** to drag controls or apply a preset, then save or cancel.

## Test

After installing Godot 4.7.2, from the repository root:

```sh
godot --headless --editor --path . --import --quit
godot --headless --path . --script res://tests/run_tests.gd --fixed-fps 60
# Optional: 180 seconds of simulated 49-bot play (not a phone benchmark)
godot --headless --path . --script res://tests/soak_simulation.gd --fixed-fps 60
```

See [the test report](docs/TEST_REPORT.md) for results and what was **not** tested. See [the milestone status and remaining work](docs/ROADMAP.md) before treating this as a shippable game.

## Project layout

- `project.godot`, `scenes/main.tscn`, `export_presets.cfg` — engine and Android configuration.
- `scripts/actors/` — player, AI, training targets, abilities and original procedural models.
- `scripts/combat/` and `scripts/data/` — firearms, attachments, grenades, inventory and operator/HUD configuration.
- `scripts/world/` — island, aircraft/parachute deployment, shared navigation grid, loot, Gloo Walls and safe zone.
- `scripts/core/` — game/match coordination, local save and synthesized audio.
- `scripts/ui/` — lobby, settings, mobile HUD and editor, pause and results.
- `tests/` — repeatable Godot engine tests and an optional bot soak simulation.

This project uses the requested working title. Before any public release, independently review name/trademark clearance and age-rating requirements.
