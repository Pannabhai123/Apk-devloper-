# Ronny AI — Advanced Personal AI Assistant (Android)

Futuristic voice-controlled AI assistant: AI chat (Hindi/English/Hinglish),
voice STT+TTS, app automation, reminders, SOS emergency system, smart memory.

## 📦 Is repo mein kya hai
| Folder | Kya hai |
|---|---|
| `RonnyAI-lite/RonnyAI-lite.apk` | ✅ **READY-TO-INSTALL APK** (is sandbox mein built + signed) |
| `RonnyAI-lite/` | Lite APK ka source (Java + WebView UI) + `build-apk.sh` |
| `RonnyAI/` | **Full Jetpack Compose project** (Kotlin, MVVM, Room, Retrofit) |

## 1. APK install kaise karein
1. `RonnyAI-lite/RonnyAI-lite.apk` ko phone par copy karein
2. File manager se tap karein → "Unknown sources" allow karein → Install
3. App kholiye → permissions dein → "Namaste, main Ronny hoon!" 🎙

## 2. Compose project build (Android Studio)
1. File > Open > `RonnyAI/` folder
2. Gradle sync (wrapper auto-download hoga)
3. Build > Build APK(s) → `app/build/outputs/apk/debug/app-debug.apk`

CLI: `./gradlew assembleDebug` (JDK 17 + Android SDK 35 chahiye)

## 3. Lite APK rebuild (toolchain se)
```bash
cd RonnyAI-lite && ./build-apk.sh
```

## 4. AI Provider Setup (secure — koi key APK mein embedded nahi)
- App > Settings > AI Provider
- Koi bhi OpenAI-compatible API: OpenRouter / Groq / Together / self-hosted
- Base URL + model + API key daalein
- Bina key ke bhi app offline commands par chalta hai (honestly labeled)

## 5. Permissions (honest usage)
- 🎙 Mic → voice commands (sirf button dabane par record hota hai)
- 📍 Location → SOS location sharing (aapke action par)
- ✉️ SMS → SOS messages (hamesha confirmation ke saath)
- 📷 Camera → flashlight
- 💡 Write Settings → brightness (system grant page khulta hai)

## 6. Honesty Notes (aapke prompt ke rules ke mutabik)
- Koi API key source/APK mein nahi hai
- SOS messages tabhi jaate hain jab user confirm kare; "sent" sirf tab claim hota hai jab carrier ko submit ho
- WhatsApp/SMS hamesha user-approved intent se jaate hain (silent send kabhi nahi)
- Offline mode clearly label hota hai — koi fake AI response nahi

## 7. Testing report
`RonnyAI/TESTING.md` dekhein.
