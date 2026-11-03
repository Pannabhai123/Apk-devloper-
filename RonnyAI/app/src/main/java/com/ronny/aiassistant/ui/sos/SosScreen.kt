package com.ronny.aiassistant.ui.sos

import android.app.Application
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.ronny.aiassistant.RonnyApp
import com.ronny.aiassistant.service.SosManager
import com.ronny.aiassistant.ui.components.*
import com.ronny.aiassistant.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

class SosViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as RonnyApp
    val sos = SosManager(application)

    val countdown = MutableStateFlow<Int?>(null)
    val preparedMessage = MutableStateFlow("")
    val locationText = MutableStateFlow("")
    val log = MutableStateFlow<List<String>>(emptyList())
    val contacts = MutableStateFlow<List<Pair<String, String>>>(emptyList())
    private var cancelled = false

    init {
        viewModelScope.launch { contacts.value = app.settings.sosContacts() }
    }

    fun start() {
        cancelled = false
        viewModelScope.launch {
            for (i in 5 downTo 1) {
                if (cancelled) { addLog("🚫 SOS cancelled."); countdown.value = null; return@launch }
                countdown.value = i
                delay(1000)
            }
            countdown.value = null
            val loc = sos.getLocation()
            locationText.value = if (loc != null)
                "Lat: ${"%.5f".format(loc.latitude)}, Lng: ${"%.5f".format(loc.longitude)}"
            else "⚠️ Location unavailable (GPS/Network) — manually share karein"
            preparedMessage.value = sos.sosMessage(loc)
            addLog("🚨 SOS prepared — neeche contacts se action chunein (hamesha confirm ke saath).")
        }
    }

    fun cancel() {
        cancelled = true
        countdown.value = null
        addLog("🚫 SOS cancelled by user.")
    }

    fun sendSms(name: String, number: String) {
        viewModelScope.launch {
            addLog(sos.sendSmsDirect(number, sos.sosMessage(sos.getLocation())))
        }
    }

    fun sendWhatsApp(name: String, number: String) {
        addLog(sos.prepareWhatsApp(number, sos.sosMessage(sos.getLocation())))
    }

    fun call(name: String, number: String) {
        addLog(sos.prepareCall(number))
    }

    fun testMode() = addLog(sos.testMode())

    fun addContact(name: String, phone: String) {
        if (name.isBlank() || phone.isBlank()) return
        viewModelScope.launch {
            val next = contacts.value + (name to phone)
            app.settings.saveSosContacts(next)
            contacts.value = next
        }
    }

    fun removeContact(c: Pair<String, String>) {
        viewModelScope.launch {
            val next = contacts.value - c
            app.settings.saveSosContacts(next)
            contacts.value = next
        }
    }

    private fun addLog(line: String) {
        log.value = (log.value + line).takeLast(12)
    }
}

@Composable
fun SosScreen(nav: NavController, vm: SosViewModel = viewModel()) {
    val countdown by vm.countdown.collectAsState()
    val message by vm.preparedMessage.collectAsState()
    val location by vm.locationText.collectAsState()
    val log by vm.log.collectAsState()
    val contacts by vm.contacts.collectAsState()
    var newName by remember { mutableStateOf("") }
    var newPhone by remember { mutableStateOf("") }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(18.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("🚨 Emergency SOS", style = MaterialTheme.typography.headlineMedium,
            color = DangerRed, fontWeight = FontWeight.Bold)
        Text("Cancel-able · Test mode · Koi fake 'sent' claim nahi",
            color = TextLight, style = MaterialTheme.typography.labelLarge)

        Spacer(Modifier.height(20.dp))

        if (countdown != null) {
            GlassCard(Modifier.fillMaxWidth(), DangerRed.copy(alpha = 0.6f)) {
                Text("SOS ACTIVATING IN…", color = DangerRed, fontWeight = FontWeight.Bold)
                Text("$countdown", style = MaterialTheme.typography.headlineMedium, color = DangerRed)
                Spacer(Modifier.height(8.dp))
                NeonButton("❌ CANCEL SOS", color = DangerRed) { vm.cancel() }
            }
        } else if (message.isBlank()) {
            Surface(
                onClick = { vm.start() },
                shape = MaterialTheme.shapes.extraLarge,
                color = DangerRed.copy(alpha = 0.18f),
                border = BorderStroke(2.dp, DangerRed)
            ) {
                Text("🚨  SOS  🚨", Modifier.padding(horizontal = 40.dp, vertical = 22.dp),
                    color = DangerRed, style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.height(8.dp))
            NeonButton("🧪 Test Mode") { vm.testMode() }
        }

        if (message.isNotBlank()) {
            GlassCard(Modifier.fillMaxWidth(), DangerRed.copy(alpha = 0.5f)) {
                Text("📨 Emergency Message (prepared)", color = DangerRed, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Text(message, color = TextLight)
                Spacer(Modifier.height(8.dp))
                Text("📍 $location", color = NeonBlue)
            }
            Spacer(Modifier.height(12.dp))
        }

        // Emergency contacts
        GlassCard(Modifier.fillMaxWidth()) {
            Text("👥 Emergency Contacts", color = NeonBlue, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            contacts.forEach { c ->
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(c.first, color = TextLight, fontWeight = FontWeight.SemiBold)
                        Text(c.second, color = Color(0xFF7A8BA8),
                            style = MaterialTheme.typography.labelLarge)
                    }
                    if (message.isNotBlank()) {
                        NeonButton("✉️ SMS", color = NeonBlue) { vm.sendSms(c.first, c.second) }
                        Spacer(Modifier.width(6.dp))
                        NeonButton("💬 WA", color = SuccessGreen) { vm.sendWhatsApp(c.first, c.second) }
                        Spacer(Modifier.width(6.dp))
                        NeonButton("📞", color = NeonPurple) { vm.call(c.first, c.second) }
                    }
                    TextButton(onClick = { vm.removeContact(c) }) { Text("🗑", color = DangerRed) }
                }
                Spacer(Modifier.height(6.dp))
            }
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                OutlinedTextField(newName, { newName = it },
                    Modifier.weight(1f), placeholder = { Text("Naam") })
                Spacer(Modifier.width(8.dp))
                OutlinedTextField(newPhone, { newPhone = it },
                    Modifier.weight(1f), placeholder = { Text("Phone") })
                Spacer(Modifier.width(8.dp))
                NeonButton("Add") { vm.addContact(newName, newPhone); newName = ""; newPhone = "" }
            }
        }

        Spacer(Modifier.height(12.dp))

        // Honest status log
        GlassCard(Modifier.fillMaxWidth(), NeonPurple.copy(alpha = 0.5f)) {
            Text("📋 Status Log (honest)", color = NeonPurple, fontWeight = FontWeight.Bold)
            log.forEach { Text("• $it", color = TextLight) }
        }
        Spacer(Modifier.height(20.dp))
    }
}
