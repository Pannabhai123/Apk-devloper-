# Indian Bus Simulator Ultimate 3D

A playable browser-based 3D driving prototype built with Three.js and Vite. The first release focuses on the requested development priority: a driveable Indian highway scene, touch/keyboard controls, chase/cockpit/front/side camera views, route acceptance, pickup/drop-off loop, garage preview, and locally saved route rewards.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local Vite URL shown in the terminal. For a production bundle, run `npm run build`; the static output is in `dist/`. A Capacitor Android wrapper is included.

### Android APK build

Install Android Studio with the Android SDK and a compatible JDK (Java 21 for the current Capacitor 8 toolchain), then:

```sh
npm install
npm run android:sync
cd android
./gradlew assembleDebug
```

The debug APK should be created at `android/app/build/outputs/apk/debug/app-debug.apk`. The app is configured for landscape orientation. This workspace does not have Java/`JAVA_HOME` or an Android SDK, so that Gradle command was attempted but could not run here; **no APK is claimed as generated**.

## Controls

- W / Up: accelerate
- S / Down: brake
- A / Left and D / Right: steer
- On touchscreens, use the on-screen steering, brake, and accelerator controls.
- The gear control cycles Neutral → Drive → Reverse. Camera cycles through four views.
- Accept the Patna–Hajipur career route, stop in the marked pickup zone, open doors with **DOORS**, then use **Open Doors & Board**. Drive to Hajipur, stop at the destination and repeat the door interaction to unload and receive the route reward. Free Drive is available from the title screen.

## Implemented

- Procedurally built Three.js highway scene with lane markings, village homes, trees, roadside dhaba, route signs, bus model, and a bounded road surface.
- Speed-dependent steering, acceleration/braking, neutral/drive/reverse, basic fuel consumption, four cameras, touch and keyboard input.
- Six lightweight AI traffic cars using opposing/same-direction lanes, recycling, and simple bus collision response.
- Career route pickup/drop-off interaction and locally persisted currency.
- Highway refuelling stop: park at the left-side marked bay to refill the tank for ₹200.
- Garage selection and purchase of a second coach with earned in-game currency; unlock and selection persist locally and change the bus livery in gameplay.
- Functional pause/resume, forward headlight beams, a synthesized horn, animated passenger-door panels, and responsive landscape-oriented HUD.
- English/Hindi language switch for the menus, driving controls, mission prompts, settings, and result flow; language choice persists locally.
- Saved settings for low/medium/high render quality, steering sensitivity, and horn mute; low quality reduces render resolution, disables shadows, and trims visible traffic.

## Known limitations

This is an early playable prototype, not the full scope of the proposed commercial-quality simulator. It uses a single procedural bus and compact straight highway. It does not yet include full rigid-body suspension/collision physics, AI traffic, animated passenger models, a true connected open-world map, native Android packaging, audio, dynamic weather/time, advanced navigation/minimap, multiple owned buses/upgrades, or full settings and career progression. Scene assets are original procedural geometry; no third-party game assets are bundled. WebGL performance depends on the device/browser.
