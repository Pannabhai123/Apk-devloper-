package com.ronny.aiassistant.ui.settings

import android.app.Application
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.ronny.aiassistant.RonnyApp
import com.ronny.aiassistant.data.db.MemoryEntity
import com.ronny.aiassistant.data.settings.AiConfig
import com.ronny.aiassistant.data.settings.AppSettings
import com.ronny.aiassistant.ui.components.*
import com.ronny.aiassistant.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

class SettingsViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as RonnyApp

    val settings = app.settings.settingsFlow
    val memory = app.memoryRepository.entries()
    val saved = MutableStateFlow(false)

    val cfg = MutableStateFlow(AiConfig())

    init {
        viewModelScope.launch { cfg.value = app.settings.aiConfig() }
    }

    fun saveCfg() {
        viewModelScope.launch {
            app.settings.saveAiConfig(cfg.value)
            saved.value = true
        }
    }

    fun update(transform: (AppSettings) -> AppSettings) {
        viewModelScope.launch { app.settings.update(transform) }
    }

    fun deleteMemory(m: MemoryEntity) {
        viewModelScope.launch { app.memoryRepository.delete(m) }
    }

    fun clearMemory() {
        viewModelScope.launch { app.memoryRepository.clearAll() }
    }
}

@Composable
fun SettingsScreen(nav: NavController, vm: SettingsViewModel = viewModel()) {
    val context = LocalContext.current
    val st by vm.settings.collectAsState(initial = null)
    val memory by vm.memory.collectAsState(initial = emptyList())
    val cfg by vm.cfg.collectAsState()
    val saved by vm.saved.collectAsState()
    var showKey by remember { mutableStateOf(false) }

    Column(
        Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("⚙️ Settings", style = MaterialTheme.typography.headlineMedium,
            color = NeonBlue, fontWeight = FontWeight.Bold)

        // --- AI Provider ---
        GlassCard(Modifier.fillMaxWidth()) {
            Text("🤖 AI Provider (OpenAI-compatible)", color = NeonPurple,
                fontWeight = FontWeight.Bold)
            Text("Key sirf encrypted storage mein — APK/source mein kabhi nahi.",
                color = Color(0xFF7A8BA8), style = MaterialTheme.typography.labelLarge)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(cfg.providerName, {
                vm.cfg.value = cfg.copy(providerName = it)
            }, Modifier.fillMaxWidth(), label = { Text("Provider name") })
            OutlinedTextField(cfg.baseUrl, {
                vm.cfg.value = cfg.copy(baseUrl = it)
            }, Modifier.fillMaxWidth(),
                label = { Text("Base URL (e.g. https://openrouter.ai/api/v1/)") })
            OutlinedTextField(cfg.model, {
                vm.cfg.value = cfg.copy(model = it)
            }, Modifier.fillMaxWidth(),
                label = { Text("Model (e.g. meta-llama/llama-3.1-8b-instruct:free)") })
            OutlinedTextField(cfg.apiKey, {
                vm.cfg.value = cfg.copy(apiKey = it)
            }, Modifier.fillMaxWidth(),
                label = { Text("API Key") },
                visualTransformation = if (showKey) VisualTransformation.None
                    else PasswordVisualTransformation())
            Spacer(Modifier.height(8.dp))
            Row {
                NeonButton(if (showKey) "🙈 Hide Key" else "👁 Show Key") { showKey = !showKey }
                Spacer(Modifier.width(8.dp))
                NeonButton(if (saved) "✅ Saved!" else "💾 Save Config", color = SuccessGreen) {
                    vm.saveCfg()
                }
            }
        }

        // --- Voice ---
        GlassCard(Modifier.fillMaxWidth()) {
            Text("🎙 Voice", color = NeonBlue, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Text("Language", color = TextLight)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SelectChip("🇮🇳 Hindi (hi-IN)", st?.language == "hi-IN") {
                    vm.update { it.copy(language = "hi-IN") }
                }
                SelectChip("🇬🇧 English (en-IN)", st?.language == "en-IN") {
                    vm.update { it.copy(language = "en-IN") }
                }
            }
            Spacer(Modifier.height(8.dp))
            Text("Voice Speed: ${st?.voiceSpeed ?: 1f}", color = TextLight)
            Slider(
                value = st?.voiceSpeed ?: 1f,
                onValueChange = { v -> vm.update { it.copy(voiceSpeed = v) } },
                valueRange = 0.5f..2f
            )
            Text("Voice Pitch: ${st?.voicePitch ?: 1f}", color = TextLight)
            Slider(
                value = st?.voicePitch ?: 1f,
                onValueChange = { v -> vm.update { it.copy(voicePitch = v) } },
                valueRange = 0.5f..2f
            )
            Row {
                SelectChip("🔊 TTS ${if (st?.ttsEnabled == true) "ON" else "OFF"}",
                    st?.ttsEnabled == true) {
                    vm.update { it.copy(ttsEnabled = !(it.ttsEnabled)) }
                }
                Spacer(Modifier.width(8.dp))
                SelectChip("🧠 Memory ${if (st?.memoryEnabled == true) "ON" else "OFF"}",
                    st?.memoryEnabled == true) {
                    vm.update { it.copy(memoryEnabled = !(it.memoryEnabled)) }
                }
            }
        }

        // --- Memory dashboard ---
        GlassCard(Modifier.fillMaxWidth(), NeonPurple.copy(alpha = 0.5f)) {
            Text("🧠 Smart Memory (privacy dashboard)", color = NeonPurple,
                fontWeight = FontWeight.Bold)
            Text("Ronny sirf aapki permission se yaad rakhta hai. Kabhi bhi delete karein.",
                color = Color(0xFF7A8BA8), style = MaterialTheme.typography.labelLarge)
            Spacer(Modifier.height(8.dp))
            memory.forEach { m ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("• ${m.key}: ${m.value}", color = TextLight,
                        modifier = Modifier.weight(1f))
                    TextButton(onClick = { vm.deleteMemory(m) }) { Text("🗑", color = DangerRed) }
                }
            }
            if (memory.isEmpty()) Text("Memory khali hai 🙂", color = Color(0xFF7A8BA8))
            Spacer(Modifier.height(8.dp))
            NeonButton("🧹 Clear All Memory", color = DangerRed) { vm.clearMemory() }
        }

        // --- Permissions ---
        GlassCard(Modifier.fillMaxWidth()) {
            Text("🔐 Permissions", color = NeonBlue, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Text("• 🎙 Mic — voice commands (sirf button dabane par)\n" +
                "• 📍 Location — SOS location\n" +
                "• 🔔 Notifications — reminders\n" +
                "• ✉️ SMS — SOS messages (confirmation ke saath)\n" +
                "• 📷 Camera — flashlight\n" +
                "• 💡 Write Settings — brightness",
                color = TextLight)
            Spacer(Modifier.height(8.dp))
            NeonButton("🛠 App Permission Settings") {
                context.startActivity(Intent(
                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:${context.packageName}")
                ))
            }
            Spacer(Modifier.width(8.dp))
            NeonButton("💡 Brightness Permission") {
                context.startActivity(Intent(
                    Settings.ACTION_MANAGE_WRITE_SETTINGS,
                    Uri.parse("package:${context.packageName}")
                ))
            }
        }

        // --- About ---
        GlassCard(Modifier.fillMaxWidth()) {
            Text("ℹ️ About Ronny AI", color = NeonBlue, fontWeight = FontWeight.Bold)
            Text(
                "Version 1.0 · Kotlin + Jetpack Compose\n" +
                    "Architecture: MVVM + Clean · Room · Retrofit · WorkManager\n\n" +
                    "Privacy: koi hidden data collection nahi. API keys encrypted.\n" +
                    "SOS: honest status — koi fake 'sent' claim nahi.",
                color = TextLight
            )
        }
        Spacer(Modifier.height(20.dp))
    }
}
