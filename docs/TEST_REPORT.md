# Test report — 2026-10-27

## Environment

- Linux x86_64 sandbox, 2 vCPUs and approximately 3.8 GiB RAM.
- Godot **4.7.2 stable** Linux editor, obtained temporarily for testing; its SHA-256 was checked against the official release. The engine binary is not part of this repository.
- Headless dummy renderer/audio; no display, GPU benchmark, Android SDK/JDK, Android emulator or physical Android phone.

## Executed on the current working tree

1. `godot --headless --editor --path . --import --quit` — project and original SVG imported without script errors. The editor also reported `Unable to open Android 'build-tools' directory` because the Android SDK was absent.
2. `godot --headless --path . --quit-after 120 --fixed-fps 60` — main scene/lobby startup completed without runtime script errors.
3. `godot --headless --path . --script res://tests/run_tests.gd --fixed-fps 60` — **145 assertions passed, 0 failed**. Coverage includes:
   - Twelve weapon configurations, reload/ammunition, two-slot pickup/swap, bounded consumables and optic pickup, replacement and ADS camera zoom.
   - Real Godot physics head/body hitboxes, headshot multiplier, wall blocking/durability/destruction, placement checks and nearby loot behavior.
   - Frag projectile movement, fuse, inventory, cover shielding, wall damage, player credit and measured near/far radial damage falloff; bot and touch throws.
   - Each of eight operator abilities, cooldowns, health/armor and ammo limits, bounded recon, a bot ability decision and touch activation.
   - Bounded shrinking circle, outside-zone damage and final storm; long-distance and obstacle routes, path-request budget, dynamic Gloo Wall insertion/removal, overlapping-obstacle accounting and actual bot movement around cover.
   - Shared 320 m terrain/grid/zone/minimap dimensions, ten named landmarks with collision geometry and nearby loot, physical boundaries, sampled static-grid rasterization, and real character movement up a ramp onto a rooftop. Tests also cover elevated cover/loot and prevent collecting through a floor.
   - Aircraft movement, staged bot jumps, paused zone countdown, manual and automatic player drop, restricted combat while airborne, physical steering/landing, and surface-correct loot when a bot is eliminated in the air or on a roof.
   - Missing/corrupt saves, backup recovery, reset behavior, training loadouts, settings, results, XP, missions and sanitized history.
   - Lobby/armory/settings, simultaneous synthetic move/fire/look touch pointers, widescreen coordinate transforms, touch drop and parachute steering, editable HUD drag/presets/cancel/mirroring/persistence, training targets, healing, cover deployment and pause.
   - Bot line of sight, bounded approximate gunshot hearing, real victory/results-to-lobby/save flow, and simultaneous final elimination where a dead player must lose.
4. `godot --headless --path . --script res://tests/soak_simulation.gd --fixed-fps 60` — **three separate accelerated runs with 49 initial bots and 180 simulated seconds each** completed without script errors after map expansion, dynamic navigation and aircraft deployment. Each verified deployment completion and subsequent zone shrink; 3–5 bots remained. The inactive test player's health was deliberately raised to keep each simulation observable. These are robustness smoke tests, **not FPS or Android performance results**.
5. A clean extraction of the updated source archive was imported independently, passed the same **145 / 145** integration checks, and completed the main-scene startup. Its import emitted the same missing Android build-tools warning.
6. An earlier `godot --headless --path . --export-debug Android /tmp/free-fire-bharat-debug.apk` attempt **failed** because matching Android templates, Java SDK, Android platform-tools/`adb` and build-tools/`apksigner` were absent. No APK was produced locally. Check the GitHub Actions run and releases for the result of any later remote build.

## Not verified

- Visual quality, rendered HUD placement/readability, aircraft/parachute presentation, sound quality or actual human gameplay.
- Airplane-mode launch on Android, runtime manifest permissions, device touch input, rotation, background/foreground lifecycle, save persistence after the OS kills the app, emulator or physical phone installation.
- Performance on a 4 GB Android device, actual frame rate, battery, thermal behavior or memory use. Accelerated headless timing is not comparable.
- This local report does not establish the result of the GitHub Actions build; inspect the run logs and release for the exact commit.
- Full match-duration distribution, multi-level bot navigation, balance, or the complete feature set in the original specification. Consult [ROADMAP.md](ROADMAP.md).

The source has no runtime networking calls and the Android export preset sets Internet permission to false, but that static observation is not a substitute for checking a built APK and testing offline on hardware.
