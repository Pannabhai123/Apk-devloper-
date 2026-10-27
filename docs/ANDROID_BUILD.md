# Android build and install

## Current status

**No APK is included.** The 2026-10-27 sandbox export attempt failed because there was no Java SDK, Android SDK/platform-tools/build-tools, or matching Godot Android export templates. There was also no Android device or emulator available. The configuration below is provided to make a later build reproducible; it is not a claim that installation or launch has been verified.

The checked-in `Android` preset targets ARMv7 and ARM64, uses landscape orientation, requests no Internet permission, and has no keystore or secret committed. The game does not need a connection at runtime. Verify the actual APK manifest and device behavior after exporting.

## Requirements

- Godot **4.7.2 stable**, standard non-.NET editor, and **matching 4.7.2 export templates**. In the editor use **Editor → Manage Export Templates → Download and Install**. A different editor/template version pair will not work.
- **OpenJDK 17** and Android Studio's Android SDK. Install the current SDK Command-line Tools, Platform Tools, the build-tools and SDK platform required by your Godot installation. Godot's 4.7 documentation lists platform 35, build-tools 35.0.1, CMake 3.10.2.4988404 and NDK 28.1.13356709; the optional CI workflow uses platform 36/build-tools 36.1.0. If Godot reports a different requirement, install the indicated version.
- In **Editor → Editor Settings → Export → Android**, set **Java SDK Path** to the JDK root and **Android SDK Path** to the SDK root containing `platform-tools/adb` and `build-tools/`.
- A debug keystore for testing, or a separate private release keystore for distribution. Never commit keystores or passwords to this repository.

For example, on Linux after installing the Android command-line tools and accepting their licenses (change the SDK path if yours differs):

```sh
export ANDROID_HOME="$HOME/Android/Sdk"
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$ANDROID_HOME" \
  "platform-tools" "build-tools;35.0.1" "platforms;android-35" \
  "cmdline-tools;latest" "cmake;3.10.2.4988404" "ndk;28.1.13356709"
```

On Windows/macOS, use the corresponding SDK path and executable names. Official reference: <https://docs.godotengine.org/en/4.7/tutorials/export/exporting_for_android.html>.

## Debug-signed APK

1. Open `project.godot` in Godot, wait for imports, and check **Project → Export → Android** for errors.
2. Godot can generate a debug keystore after the JDK is configured. If necessary, create a **test-only** key outside the project:

   ```sh
   mkdir -p "$HOME/.android"
   keytool -genkeypair -noprompt -keystore "$HOME/.android/ffb-debug.keystore" \
     -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 \
     -storepass android -keypass android -dname 'CN=Android Debug,O=Android,C=US'
   ```

   In **Editor Settings → Export → Android**, set the debug keystore path, user `androiddebugkey`, and password `android`. The values above are public debug credentials and are **not appropriate for a release**.
3. From the project directory, with the editor executable named `godot`:

   ```sh
   godot --headless --editor --path . --import --quit
   godot --headless --path . --script res://tests/run_tests.gd --fixed-fps 60
   mkdir -p build
   godot --headless --path . --export-debug Android build/free-fire-bharat-debug.apk
   ```

   Alternatively, in **Project → Export**, select **Android**, leave **Export With Debug** enabled, and export an `.apk`.
4. Verify the output with tools from your Android SDK (substitute the installed build-tools version):

   ```sh
   BUILD_TOOLS="$ANDROID_HOME/build-tools/35.0.1"
   "$BUILD_TOOLS/apksigner" verify --verbose build/free-fire-bharat-debug.apk
   "$BUILD_TOOLS/aapt" dump badging build/free-fire-bharat-debug.apk
   "$BUILD_TOOLS/aapt" dump permissions build/free-fire-bharat-debug.apk
   ```

   Check the package name and confirm the actual output does not request `android.permission.INTERNET`. A successful export/signature check is **not** a substitute for device testing.
5. Enable USB debugging on your Android phone and connect it. After accepting the device's authorization prompt:

   ```sh
   "$ANDROID_HOME/platform-tools/adb" devices
   "$ANDROID_HOME/platform-tools/adb" install -r build/free-fire-bharat-debug.apk
   ```

   Or transfer the APK and install it using Android's system installer, granting that installer permission to install this file if prompted. Only install an APK you trust. If replacing a build signed with a different key, uninstalling the old app may be required; **uninstalling deletes its local progress**.
6. Launch the app, switch on airplane mode, and test lobby, touch controls, combat, zone, pause/background/resume, sound, settings/save across restart and a full win/loss. Check frame time, battery, heating, memory, and scaling on the intended low-end phone.

## Android-editor alternative (not tested here)

Godot's 4.7 documentation states that its **Android editor** can export Android projects without a separate desktop JDK or Android SDK. If you have the official Godot **4.7.2 Android editor**, extract the source ZIP into a writable folder, import `project.godot`, wait for imports, install matching export templates if prompted, then use **Project → Export → Android** to export a debug APK to a writable location. Android storage permissions and editor UI vary by device/version. This route has not been exercised for this project; verify the resulting APK and playtest it offline before sharing it.

## Release signing

Create a separate release keystore locally, protect its password and back it up securely. Set **Keystore → Release**, **Release User**, and **Release Password** in the Android export preset on your own machine, then export with **Export With Debug** disabled, or run `godot --headless --path . --export-release Android build/free-fire-bharat-release.apk`. Do not paste credentials into chat, commit a keystore, or reuse the public debug key. Losing a release key prevents normal in-place app updates. Verify the release signature and install it on real devices before distributing it.

## GitHub Actions debug build and public prerelease

`.github/workflows/android-debug.yml` can build a debug APK, run the engine tests, verify the APK's signature/package/architecture/Internet permission, and upload the output as a seven-day Actions artifact. The job uses pinned Godot 4.7.2 files and a temporary debug signing key. **It does not install or play-test the APK on Android.** Check the run for the exact source commit before relying on a build.

For this session's branch, an explicitly authorized push whose commit message contains `[publish-debug-apk]` also publishes the verified build as a public GitHub **prerelease**, with its SHA-256 and source commit. Ordinary pushes without that marker do not run the build. A manual `workflow_dispatch` has a separate opt-in `publish_prerelease` input; GitHub requires the workflow to exist on the default branch before it can be run manually.

The debug key is **ephemeral on each run**, so different builds cannot necessarily update each other in place. Uninstalling an older installation can erase local saves. A debug prerelease is not a production-signed release, and installation, gameplay, offline operation, lifecycle and performance still require device testing.
