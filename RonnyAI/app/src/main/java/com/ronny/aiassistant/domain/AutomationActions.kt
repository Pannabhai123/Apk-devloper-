package com.ronny.aiassistant.domain

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.StatFs
import android.provider.Settings
import androidx.core.content.ContextCompat
import java.net.URLEncoder

/**
 * Saare actions REAL hain. Koi fake action nahi.
 * Dangerous/irreversible action kabhi bhi confirmation ke bina execute nahi hota.
 */
class AutomationActions(private val context: Context) {

    private var torchOn = false

    private fun launch(intent: Intent): String {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try {
            context.startActivity(intent); "✅ Done — action execute ho gaya."
        } catch (e: Exception) {
            "❌ Ye action is device par available nahi hai: ${e.message}"
        }
    }

    // ---------- App launching ----------
    fun openApp(packageName: String, label: String): String = launch(
        context.packageManager.getLaunchIntentForPackage(packageName)
            ?: Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$packageName"))
    ).let { if (it.startsWith("✅")) "✅ $label open ho gaya." else it }

    fun openByPackageMap(query: String): String? {
        val map = mapOf(
            "chrome" to ("com.android.chrome" to "Chrome"),
            "youtube" to ("com.google.android.youtube" to "YouTube"),
            "whatsapp" to ("com.whatsapp" to "WhatsApp"),
            "camera" to ("com.android.camera2" to "Camera"),
            "gallery" to ("com.android.gallery3d" to "Gallery"),
            "calculator" to ("com.android.calculator2" to "Calculator"),
            "maps" to ("com.google.android.apps.maps" to "Maps"),
            "play store" to ("com.android.vending" to "Play Store"),
            "playstore" to ("com.android.vending" to "Play Store"),
            "contacts" to ("com.android.contacts" to "Contacts"),
            "dialer" to ("com.android.dialer" to "Dialer"),
            "phone" to ("com.android.dialer" to "Dialer"),
            "settings" to ("com.android.settings" to "Settings"),
            "gmail" to ("com.google.android.gm" to "Gmail"),
            "instagram" to ("com.instagram.android" to "Instagram"),
            "facebook" to ("com.facebook.katana" to "Facebook")
        )
        val hit = map.entries.firstOrNull { query.contains(it.key) } ?: return null
        val (pkg, label) = hit.value
        return openApp(pkg, label)
    }

    fun openSettings() = launch(Intent(Settings.ACTION_SETTINGS))
    fun openWifiSettings() = launch(Intent(Settings.ACTION_WIFI_SETTINGS))
    fun openBluetoothSettings() = launch(Intent(Settings.ACTION_BLUETOOTH_SETTINGS))
    fun openDataSettings() = launch(Intent(Settings.ACTION_DATA_ROAMING_SETTINGS))
    fun openDisplaySettings() = launch(Intent(Settings.ACTION_DISPLAY_SETTINGS))

    // ---------- Torch ----------
    fun toggleTorch(): String {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
            != PackageManager.PERMISSION_GRANTED)
            return "⚠️ Flashlight ke liye Camera permission chahiye (Settings > Permissions)."
        return try {
            val cm = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val id = cm.cameraIdList.firstOrNull() ?: return "❌ Koi camera nahi mila."
            torchOn = !torchOn
            cm.setTorchMode(id, torchOn)
            if (torchOn) "🔦 Flashlight ON." else "💡 Flashlight OFF."
        } catch (e: Exception) {
            "❌ Torch control fail: ${e.message}"
        }
    }

    // ---------- Volume / Brightness ----------
    fun volumeUp(): String {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_RAISE, 0)
        return "🔊 Volume badha diya (media: ${am.getStreamVolume(AudioManager.STREAM_MUSIC)})."
    }

    fun volumeDown(): String {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_LOWER, 0)
        return "🔉 Volume kam kar diya (media: ${am.getStreamVolume(AudioManager.STREAM_MUSIC)})."
    }

    fun mute(): String {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
        am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_MUTE, 0)
        return "🔇 Media mute kar diya."
    }

    fun setBrightness(percent: Int): String {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.System.canWrite(context))
            return launch(Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS,
                Uri.parse("package:${context.packageName}")))
                .replace("Done — action execute ho gaya.",
                    "Brightness permission page khul raha hai — 'Allow' karein, phir dobara bolein.")
        val v = (percent.coerceIn(0, 100) * 255) / 100
        Settings.System.putInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS, v)
        return "💡 Brightness $percent% kar di."
    }

    // ---------- Battery ----------
    fun batteryInfo(): String {
        val bm = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val pct = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
        val sticky = context.registerReceiver(null,
            android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val status = when (sticky?.getIntExtra(BatteryManager.EXTRA_STATUS, -1)) {
            BatteryManager.BATTERY_STATUS_CHARGING -> "Charging ⚡"
            BatteryManager.BATTERY_STATUS_FULL -> "Full ✅"
            else -> "Discharging 🔋"
        }
        val health = when (sticky?.getIntExtra(BatteryManager.EXTRA_HEALTH, -1)) {
            BatteryManager.BATTERY_HEALTH_GOOD -> "Good"
            BatteryManager.BATTERY_HEALTH_OVERHEAT -> "Overheat ⚠️"
            else -> "Unknown"
        }
        val temp = sticky?.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1)?.div(10.0)
        return "🔋 Battery: $pct% ($status)\nHealth: $health\nTemperature: ${temp ?: "?"}°C"
    }

    // ---------- Device info ----------
    fun deviceInfo(): String {
        val mem = android.app.ActivityManager.MemoryInfo()
        (context.getSystemService(Context.ACTIVITY_SERVICE) as android.app.ActivityManager)
            .getMemoryInfo(mem)
        val totalRamGb = mem.totalMem / (1024.0 * 1024 * 1024)
        val availGb = mem.availMem / (1024.0 * 1024 * 1024)
        val stat = StatFs(android.os.Environment.getDataDirectory().path)
        val storageFree = stat.availableBytes / (1024.0 * 1024 * 1024)
        val storageTotal = stat.totalBytes / (1024.0 * 1024 * 1024)
        return buildString {
            appendLine("📱 Device: ${Build.MANUFACTURER} ${Build.MODEL}")
            appendLine("Android: ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT})")
            appendLine("RAM: %.1f GB total, %.1f GB free".format(totalRamGb, availGb))
            append("Storage: %.1f GB total, %.1f GB free".format(storageTotal, storageFree))
        }
    }

    // ---------- WhatsApp / SMS / Call (hamesha user-approved) ----------
    fun whatsappTo(phone: String, message: String): String {
        val number = phone.filter { it.isDigit() }
        return if (number.length >= 10) {
            // Number diya hai → wa.me deep link se seedha us chat mein message pre-fill
            val url = "https://wa.me/${number}?text=${URLEncoder.encode(message, "UTF-8")}"
            launch(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            "✅ WhatsApp khul raha hai — message pre-filled hai. *Send* button aap dabayein."
        } else {
            val send = Intent(Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(Intent.EXTRA_TEXT, message)
                setPackage("com.whatsapp")
            }
            try {
                launch(send)
                "✅ WhatsApp khul raha hai — contact chunein aur *Send* dabayein."
            } catch (e: Exception) {
                launch(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"; putExtra(Intent.EXTRA_TEXT, message)
                }, "Share message via"))
                "✅ Share chooser khul raha hai — app chunein."
            }
        }
    }

    fun smsIntent(number: String, message: String): String {
        val uri = Uri.parse("smsto:${number.filter { it.isDigit() }}")
        val i = Intent(Intent.ACTION_SENDTO, uri).apply {
            putExtra("sms_body", message)
        }
        launch(i)
        return "✅ SMS app khul raha hai — message ready hai. *Send* aap confirm karein."
    }

    fun callIntent(number: String): String {
        launch(Intent(Intent.ACTION_DIAL, Uri.parse("tel:${number.filter { it.isDigit() }}")))
        return "✅ Dialer khul raha hai — call button aap dabayein (auto-call nahi hota)."
    }
}
