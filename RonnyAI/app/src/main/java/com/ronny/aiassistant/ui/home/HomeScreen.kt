package com.ronny.aiassistant.ui.home

import android.app.Application
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.ronny.aiassistant.RonnyApp
import com.ronny.aiassistant.domain.AutomationActions
import com.ronny.aiassistant.service.voice.VoiceManager
import com.ronny.aiassistant.ui.components.*
import com.ronny.aiassistant.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import java.net.URLEncoder

class HomeViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as RonnyApp
    private val actions = AutomationActions(application)
    val settings = app.settings

    val online = MutableStateFlow(true)
    val battery = MutableStateFlow("🔋 ---%")
    val avatarMode = MutableStateFlow(0)

    init {
        refresh()
        viewModelScope.launch {
            settings.settingsFlow.collect { s -> avatarMode.value = s.avatarMode }
        }
    }

    fun refresh() {
        viewModelScope.launch {
            val cm = app.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            online.value = cm.getNetworkCapabilities(cm.activeNetwork)
                ?.hasCapability(NetworkCapabilities.NETCAPABILITY_INTERNET) == true
            battery.value = actions.batteryInfo().lineSequence().first()
        }
    }

    fun setAvatarMode(m: Int) {
        viewModelScope.launch { settings.update { it.copy(avatarMode = m) } }
    }
}

@Composable
fun HomeScreen(nav: NavController, vm: HomeViewModel = viewModel()) {
    val context = LocalContext.current
    val online by vm.online.collectAsState()
    val battery by vm.battery.collectAsState()
    val avatarMode by vm.avatarMode.collectAsState()
    var personality by remember { mutableStateOf(Personality.get(context)) }
    var listenState by remember { mutableStateOf("idle") }
    var partial by remember { mutableStateOf("") }

    val voice = remember {
        VoiceManager(
            context,
            onPartial = { partial = it },
            onResult = { text ->
                listenState = "idle"
                nav.navigate("chat_input/${URLEncoder.encode(text, "UTF-8")}")
            },
            onState = { listenState = it }
        )
    }
    DisposableEffect(Unit) { onDispose { voice.shutdown() } }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(18.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Top bar
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("RONNY AI", style = MaterialTheme.typography.headlineMedium,
                color = NeonBlue, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            StatusChip(if (online) "● Online" else "○ Offline Mode",
                if (online) SuccessGreen else DangerRed)
            Spacer(Modifier.width(8.dp))
            IconButton(onClick = { nav.navigate("settings") }) {
                Icon(Icons.Filled.Settings, "Settings", tint = NeonBlue)
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(battery, color = TextLight, style = MaterialTheme.typography.labelLarge)
            Text(if (listenState == "listening") "🎙 Listening…" else "Status: Ready",
                color = if (listenState == "listening") DangerRed else TextLight,
                style = MaterialTheme.typography.labelLarge)
        }

        Spacer(Modifier.height(20.dp))

        // Avatar + identity
        AiAvatar(avatarMode, active = listenState == "listening")
        Text("Ronny", style = MaterialTheme.typography.headlineMedium, color = TextLight)
        Text("Advanced Personal AI Assistant",
            color = NeonPurple, style = MaterialTheme.typography.labelLarge)

        Spacer(Modifier.height(8.dp))
        VoiceWave(active = listenState == "listening", modifier = Modifier.fillMaxWidth(0.85f))

        if (partial.isNotBlank() && listenState == "listening") {
            Text("“$partial”", color = NeonBlue, style = MaterialTheme.typography.bodyMedium)
        }

        Spacer(Modifier.height(16.dp))

        // Mic + text input
        MicButton(listening = listenState == "listening") {
            if (listenState == "listening") voice.stopListening()
            else { partial = ""; voice.startListening("hi-IN") }
        }
        Spacer(Modifier.height(12.dp))

        var input by remember { mutableStateOf("") }
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = input, onValueChange = { input = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Ronny se kuch bhi poochho…") },
                shape = MaterialTheme.shapes.large
            )
            Spacer(Modifier.width(8.dp))
            NeonButton("Send") {
                if (input.isNotBlank()) {
                    nav.navigate("chat_input/${URLEncoder.encode(input, "UTF-8")}")
                    input = ""
                }
            }
        }

        Spacer(Modifier.height(18.dp))

        // Quick Actions Panel
        GlassCard(Modifier.fillMaxWidth()) {
            Text("⚡ Quick Actions", color = NeonBlue, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SelectChip("💬 Chat", false) { nav.navigate("chat") }
                SelectChip("🚨 SOS", false) { nav.navigate("sos") }
                SelectChip("⏰ Reminders", false) { nav.navigate("reminders") }
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SelectChip("📱 Chrome kholo", false) {
                    nav.navigate("chat_input/${URLEncoder.encode("Chrome kholo", "UTF-8")}")
                }
                SelectChip("▶️ YouTube", false) {
                    nav.navigate("chat_input/${URLEncoder.encode("YouTube kholo", "UTF-8")}")
                }
                SelectChip("🔋 Battery", false) {
                    nav.navigate("chat_input/${URLEncoder.encode("battery kitni hai", "UTF-8")}")
                }
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SelectChip("🔦 Flashlight", false) {
                    nav.navigate("chat_input/${URLEncoder.encode("flashlight on karo", "UTF-8")}")
                }
                SelectChip("⚙️ Automation", false) {
                    nav.navigate("chat_input/${URLEncoder.encode("tum kya kar sakte ho", "UTF-8")}")
                }
            }
        }

        Spacer(Modifier.height(14.dp))

        // AI Personality Selector
        GlassCard(Modifier.fillMaxWidth(), NeonPurple.copy(alpha = 0.5f)) {
            Text("🎭 AI Personality", color = NeonPurple, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("Friendly", "Professional", "JARVIS").forEach { p ->
                    SelectChip(p, personality == p) {
                        personality = p; Personality.set(context, p)
                    }
                }
            }
        }

        Spacer(Modifier.height(14.dp))

        // Avatar mode switch
        GlassCard(Modifier.fillMaxWidth()) {
            Text("👁 Avatar Mode", color = NeonBlue, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SelectChip("🤖 AI Companion", avatarMode == 0) { vm.setAvatarMode(0) }
                SelectChip("◉ JARVIS Interface", avatarMode == 1) { vm.setAvatarMode(1) }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}
