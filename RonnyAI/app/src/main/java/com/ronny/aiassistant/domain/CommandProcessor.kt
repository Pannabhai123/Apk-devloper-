package com.ronny.aiassistant.domain

import android.content.Context
import com.ronny.aiassistant.data.repo.MemoryRepository
import com.ronny.aiassistant.data.repo.ReminderRepository
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.roundToInt

sealed class CommandResult {
    data class Answer(val text: String, val offline: Boolean = true) : CommandResult()
    data class Action(
        val label: String,
        val confirmText: String,          // confirmation dialog mein dikhega
        val needsConfirmation: Boolean = true,
        val execute: suspend () -> String
    ) : CommandResult()
    object Unhandled : CommandResult()     // → AI provider / offline brain
}

/**
 * Ye router batata hai: ye QUESTION hai, ACTION hai, ya AI ke paas jaana hai.
 * Dangerous/irreversible actions hamesha confirmation maangte hain.
 */
class CommandProcessor(
    private val context: Context,
    private val reminders: ReminderRepository,
    private val memory: MemoryRepository
) {
    private val actions = AutomationActions(context)

    suspend fun process(input: String): CommandResult {
        val t = input.lowercase().trim()
        if (t.isBlank()) return CommandResult.Answer("Kuch toh boliye 🙂")

        sos(t)?.let { return it }
        openApp(t)?.let { return it }
        torch(t)?.let { return it }
        batteryAndDevice(t)?.let { return it }
        volumeBrightness(t)?.let { return it }
        whatsappCmd(t, input)?.let { return it }
        smsCmd(t, input)?.let { return it }
        reminderCmd(t, input)?.let { return it }
        memoryCmd(t, input)?.let { return it }
        timeDate(t)?.let { return it }
        mathCmd(input)?.let { return it }
        weather(t)?.let { return it }
        capability(t)?.let { return it }
        return CommandResult.Unhandled
    }

    // ---------- SOS ----------
    private fun sos(t: String): CommandResult? {
        if (t.contains("sos") || t.contains("emergency") ||
            (t.contains("madad") && t.contains("bula"))) {
            return CommandResult.Action(
                label = "🚨 Emergency SOS",
                confirmText = "SOS activate karna hai? 5 second countdown shuru hoga " +
                    "aur emergency message + location prepare hogi. Cancel bhi kar sakte hain.",
                execute = { com.ronny.aiassistant.service.SosManager(context).startSosFlow() }
            )
        }
        return null
    }

    // ---------- Open apps ----------
    private fun openApp(t: String): CommandResult? {
        val wantsOpen = t.contains("kholo") || t.contains("khol") || t.contains("open") ||
            t.contains("launch") || t.contains("chalu karo") || t.contains("start")
        if (!wantsOpen) return null
        if (t.contains("setting")) {
            return CommandResult.Action("⚙️ Settings", "Phone ki Settings kholni hai?",
                needsConfirmation = false) { actions.openSettings() }
        }
        if (t.contains("wifi")) return CommandResult.Action("📶 Wi-Fi Settings",
            "Wi-Fi settings kholni hai?", false) { actions.openWifiSettings() }
        if (t.contains("bluetooth")) return CommandResult.Action("🔵 Bluetooth Settings",
            "Bluetooth settings kholni hai?", false) { actions.openBluetoothSettings() }

        val result = actions.openByPackageMap(t)
        return if (result != null)
            CommandResult.Action("📱 App launcher", "App kholni hai?", false) { result }
        else null
    }

    // ---------- Torch ----------
    private fun torch(t: String): CommandResult? {
        val hit = t.contains("flash") || t.contains("torch") || t.contains("flashlight") ||
            (t.contains("light") && (t.contains("on") || t.contains("off") || t.contains("jala")))
        if (!hit) return null
        return CommandResult.Action("🔦 Flashlight", "Flashlight toggle karna hai?",
            needsConfirmation = false) { actions.toggleTorch() }
    }

    // ---------- Battery / device ----------
    private fun batteryAndDevice(t: String): CommandResult? {
        if (t.contains("battery") || t.contains("battrey") || t.contains("charge")) {
            return CommandResult.Action("🔋 Battery info", "Battery status dekhni hai?",
                needsConfirmation = false) { actions.batteryInfo() }
        }
        if (t.contains("device") || t.contains("phone info") || t.contains("ram") ||
            t.contains("storage") || t.contains("phone ki jankari")) {
            return CommandResult.Action("📱 Device info", "Device info dekhni hai?",
                needsConfirmation = false) { actions.deviceInfo() }
        }
        return null
    }

    // ---------- Volume / brightness ----------
    private fun volumeBrightness(t: String): CommandResult? {
        if (t.contains("volume") || t.contains("awaaz") || t.contains("aawaz")) {
            val act = when {
                t.contains("up") || t.contains("badha") || t.contains("tez") -> actions::volumeUp
                t.contains("mute") || t.contains("chup") -> actions::mute
                else -> actions::volumeDown
            }
            return CommandResult.Action("🔊 Volume", "Volume control karna hai?",
                needsConfirmation = false) { act() }
        }
        if (t.contains("brightness") || t.contains("screen light")) {
            val pct = Regex("(\\d{1,3})").find(t)?.groupValues?.get(1)?.toIntOrNull()
            return CommandResult.Action("💡 Brightness", "Brightness change karni hai?",
                needsConfirmation = false) {
                if (pct != null) actions.setBrightness(pct)
                else actions.setBrightness(if (t.contains("badha") || t.contains("up")) 80 else 30)
            }
        }
        return null
    }

    // ---------- WhatsApp ----------
    private fun whatsappCmd(t: String, raw: String): CommandResult? {
        if (!t.contains("whatsapp") && !(t.contains("message") && t.contains("bhejo"))) return null

        val number = Regex("(\\+?\\d[\\d\\s]{8,14}\\d)").find(raw)?.groupValues?.get(1) ?: ""
        val nameMatch = Regex("([a-zA-Z]+)\\s+ko\\s").find(raw)?.groupValues?.get(1)
        val message = raw.substringAfter("ki").ifBlank { "Hi! 👋 (Ronny AI se bheja gaya)" }
        val target = number.ifBlank { nameMatch ?: "" }

        return CommandResult.Action(
            label = "💬 WhatsApp Message",
            confirmText = "WhatsApp message bhejna hai?\n\nTo: $target\nMessage: \"$message\"\n\n" +
                "✅ Confirm karne par WhatsApp khulega — *Send* button aap dabayenge (silent send nahi).",
            needsConfirmation = true
        ) { actions.whatsappTo(target, message) }
    }

    // ---------- SMS ----------
    private fun smsCmd(t: String, raw: String): CommandResult? {
        if (!t.contains("sms") && !(t.contains("message") && t.contains("bhejo"))) return null
        if (t.contains("whatsapp")) return null
        val number = Regex("(\\+?\\d[\\d\\s]{8,14}\\d)").find(raw)?.groupValues?.get(1) ?: ""
        if (number.isBlank()) return null
        val message = raw.substringAfter("ki").ifBlank { "Hello from Ronny AI 👋" }
        return CommandResult.Action(
            "✉️ SMS", "SMS bhejni hai?\n\nTo: $number\nMessage: \"$message\"\n\n" +
                "SMS app khulega — *Send* aap confirm karenge.",
            needsConfirmation = true
        ) { actions.smsIntent(number, message) }
    }

    // ---------- Reminders ----------
    private fun reminderCmd(t: String, raw: String): CommandResult? {
        val isReminder = t.contains("remind") || t.contains("reminder") ||
            t.contains("yaad dilana") || t.contains("yaad dila") || t.contains("alarm")
        if (!isReminder) return null

        val time = parseTime(t) ?: (System.currentTimeMillis() + 60 * 60 * 1000)
        val title = raw.substringAfter("ki").ifBlank {
            raw.replace(Regex("(remind|reminder|yaad dilana).*", RegexOption.IGNORE_CASE), "").trim()
                .ifBlank { "Reminder" }
        }
        val pretty = SimpleDateFormat("dd MMM, hh:mm a", Locale.getDefault()).format(Date(time))

        return CommandResult.Action(
            "⏰ Reminder", "Reminder set karna hai?\n\n\"$title\"\nTime: $pretty",
            needsConfirmation = true
        ) {
            reminders.add(title, time)
            "✅ Reminder set ho gaya: \"$title\" — $pretty"
        }
    }

    // Simple time parser: "5 baje", "5:30", "kal subah 5 baje", "17:00"
    private fun parseTime(t: String): Long? {
        val cal = Calendar.getInstance()
        if (t.contains("kal")) cal.add(Calendar.DAY_OF_YEAR, 1)
        val hm = Regex("(\\d{1,2})[:. ]?(\\d{2})?\\s*(baje|am|pm|bje)?").find(t) ?: return null
        var hour = hm.groupValues[1].toIntOrNull() ?: return null
        val min = hm.groupValues[2].toIntOrNull() ?: 0
        val pm = t.contains("pm") || t.contains("shaam") || t.contains("dopahar")
        val am = t.contains("am") || t.contains("subah") || t.contains("savere")
        if (pm && hour < 12) hour += 12
        if (am && hour == 12) hour = 0
        // PM heuristics for "baje" (Hindi): 1-7 aksar shaam, 8-11 subah
        if (!am && !pm && hm.groupValues[3].contains("baje")) {
            if (hour in 1..7) hour += 12
        }
        cal.set(Calendar.HOUR_OF_DAY, hour)
        cal.set(Calendar.MINUTE, min)
        cal.set(Calendar.SECOND, 0)
        if (cal.timeInMillis <= System.currentTimeMillis()) cal.add(Calendar.DAY_OF_YEAR, 1)
        return cal.timeInMillis
    }

    // ---------- Memory ----------
    private fun memoryCmd(t: String, raw: String): CommandResult? {
        if (t.contains("yaad rakho") || t.contains("remember") || t.contains("note karo")) {
            val content = raw.substringAfter("ki").ifBlank {
                raw.substringAfter("remember").ifBlank { raw.substringAfter("yaad rakho") }
            }.trim()
            return CommandResult.Action("🧠 Memory", "Memory mein save karna hai?\n\"$content\"",
                needsConfirmation = true) {
                memory.save("note", content)
                "🧠 Yaad rakh liya: \"$content\"\n(Aap ise Settings → Memory se delete kar sakte hain)"
            }
        }
        return null
    }

    // ---------- Time / date ----------
    private fun timeDate(t: String): CommandResult? {
        if (t.contains("time") || t.contains("samay") || t.contains("kitne baje") ||
            t.contains("date") || t.contains("aaj ka din")) {
            val now = SimpleDateFormat("EEEE, dd MMMM yyyy — hh:mm a", Locale.getDefault())
                .format(Date())
            return CommandResult.Answer("🕐 Abhi: $now")
        }
        return null
    }

    // ---------- Math (real calculation) ----------
    private fun mathCmd(raw: String): CommandResult? {
        val expr = raw.replace(Regex("[=?]|karo|calculate|kitna|kitne|hota"), " ").trim()
        val m = Regex("^([\\d\\s.+\\-*/()]+)$").find(expr) ?: return null
        if (!m.groupValues[1].any { it in "+-*/" }) return null
        return try {
            val result = Evaluator(m.groupValues[1].replace(" ", "")).parseExpr()
            CommandResult.Answer("🧮 ${m.groupValues[1].trim()} = ${
                result.roundToInt().takeIf { result == result.roundToInt().toDouble() } ?: result
            }")
        } catch (e: Exception) {
            CommandResult.Answer("🧮 Calculation samajh nahi aaya — simple numbers + - * / try karein.")
        }
    }

    // Recursive-descent evaluator (safe — no eval)
    private class Evaluator(private val s: String) {
        private var i = 0
        private val t = s.toCharArray()
        fun parseExpr(): Double {
            var v = parseTerm()
            while (i < t.size && (t[i] == '+' || t[i] == '-')) {
                val op = t[i++]; val r = parseTerm()
                v = if (op == '+') v + r else v - r
            }
            return v
        }
        private fun parseTerm(): Double {
            var v = parseFactor()
            while (i < t.size && (t[i] == '*' || t[i] == '/')) {
                val op = t[i++]; val r = parseFactor()
                v = if (op == '*') v * r else v / r
            }
            return v
        }
        private fun parseFactor(): Double {
            if (t[i] == '(') { i++; val v = parseExpr(); i++; return v }
            val st = i
            while (i < t.size && (t[i].isDigit() || t[i] == '.')) i++
            return t.concatToString(st, i).toDouble()
        }
    }

    // ---------- Weather (honest: browser search action) ----------
    private fun weather(t: String): CommandResult? {
        if (t.contains("weather") || t.contains("mausam")) {
            return CommandResult.Action(
                "🌦️ Weather", "Weather browser mein search karna hai?\n" +
                    "(Real weather ke liye AI provider + weather API configure karein)",
                needsConfirmation = false
            ) {
                val i = android.content.Intent(android.content.Intent.ACTION_VIEW,
                    android.net.Uri.parse("https://www.google.com/search?q=weather"))
                i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(i)
                "✅ Browser mein weather search khul gaya."
            }
        }
        return null
    }

    // ---------- Capability intro ----------
    private fun capability(t: String): CommandResult? {
        if (t.contains("kya kar sakt") || t.contains("who are you") || t.contains("tum kaun") ||
            t.contains("your name") || t.contains("tumhara naam") ||
            (t.contains("help") && t.length < 20)) {
            return CommandResult.Answer(
                "Main *Ronny* hoon — tumhara personal AI assistant! 🤖✨\n\n" +
                    "• Sawal-jawab (Hindi/English/Hinglish) — AI provider ya offline mode\n" +
                    "• Apps kholna: \"Chrome kholo\", \"YouTube kholo\"\n" +
                    "• System: flashlight, volume, brightness, battery, device info\n" +
                    "• Reminders: \"mujhe kal subah 5 baje running ka reminder\"\n" +
                    "• WhatsApp/SMS (hamesha tumhari confirmation ke saath)\n" +
                    "• Emergency SOS with location\n" +
                    "• Memory: \"yaad rakho ki meri class 8 baje hai\"\n\n" +
                    "Bolo, kya karna hai? 😊"
            )
        }
        return null
    }
}
