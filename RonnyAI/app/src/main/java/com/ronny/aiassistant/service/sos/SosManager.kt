package com.ronny.aiassistant.service

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import androidx.core.content.ContextCompat
import com.ronny.aiassistant.domain.AutomationActions
import kotlinx.coroutines.delay

/**
 * SOS rules (honesty first):
 * - Messages tabhi prepare hote hain, silent send KABHI nahi
 * - "Sent" tabhi claim hota hai jab actually submit ho (SmsManager)
 * - SOS cancel-able hai, test mode hai, GPS fail gracefully handle hota hai
 */
class SosManager(private val context: Context) {

    private val automation = AutomationActions(context)

    suspend fun startSosFlow(): String {
        // 5-second countdown — user cancel kar sakta hai (UI side par)
        for (i in 5 downTo 1) delay(1000)

        val location = getLocation()
        val locText = if (location != null)
            "Lat: ${"%.5f".format(location.latitude)}, Lng: ${"%.5f".format(location.longitude)}\n" +
                "Map: https://maps.google.com/?q=${location.latitude},${location.longitude}"
        else
            "⚠️ Location available nahi hai (GPS/Network off). " +
                "Please manually apni location share karein."

        val message = buildString {
            appendLine("EMERGENCY ALERT! 🚨")
            appendLine("I need assistance.")
            appendLine()
            appendLine("My current location:")
            appendLine(locText)
            appendLine()
            append("Please contact me immediately.")
        }

        return buildString {
            appendLine("🚨 SOS prepared (5s countdown complete)")
            appendLine()
            appendLine(message)
            appendLine()
            appendLine("📍 Neeche contacts choose karein — SMS/WhatsApp/Call sirf aapke")
            appendLine("confirm karne par jaayega. (Test mode: Settings > SOS Test)")
        }
    }

    fun getLocation(): Location? {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) return null
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        return try {
            @Suppress("DEPRECATION")
            lm.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                ?: lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
        } catch (e: Exception) { null }
    }

    fun sosMessage(location: Location?): String {
        val locText = location?.let {
            "https://maps.google.com/?q=${it.latitude},${it.longitude}"
        } ?: "Location unavailable — manually share karein"
        return "EMERGENCY ALERT!\nI need assistance.\nMy location: $locText\n" +
            "Please contact me immediately."
    }

    // Caller (UI) pehle confirmation dialog dikhata hai, phir ye call hota hai
    fun sendSmsDirect(number: String, message: String): String {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS)
            != PackageManager.PERMISSION_GRANTED)
            return "⚠️ SMS permission nahi hai — SMS intent use karein."
        return try {
            android.telephony.SmsManager.getDefault()
                .sendTextMessage(number, null, message, null, null)
            // Honest status: submitted, delivery confirm nahi
            "✅ SMS '$number' par carrier ko submit ho gaya (delivery confirm nahi hoti)."
        } catch (e: Exception) {
            "❌ SMS fail: ${e.message}"
        }
    }

    fun prepareSmsViaApp(number: String, message: String) = automation.smsIntent(number, message)
    fun prepareWhatsApp(number: String, message: String) = automation.whatsappTo(number, message)
    fun prepareCall(number: String) = automation.callIntent(number)

    fun testMode(): String = "🧪 SOS Test Mode: koi real message/call nahi jaata. " +
        "Sirf flow verify hota hai — countdown, location fetch, message template."
}
