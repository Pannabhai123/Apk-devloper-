package com.ronny.aiassistant.ui.chat

import android.app.Application
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import com.ronny.aiassistant.RonnyApp
import com.ronny.aiassistant.data.db.ChatMessage
import com.ronny.aiassistant.domain.CommandResult
import com.ronny.aiassistant.service.voice.VoiceManager
import com.ronny.aiassistant.ui.components.*
import com.ronny.aiassistant.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

class ChatViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as RonnyApp
    private val repo = app.chatRepository

    val messages = repo.messages()
    val thinking = MutableStateFlow(false)
    val pendingAction = MutableStateFlow<CommandResult.Action?>(null)

    private fun systemPrompt(): String = buildString {
        append("You are Ronny, a friendly futuristic personal AI assistant created to help ")
        append("with daily tasks, education, productivity and conversation. ")
        append("Reply in the same language the user uses (Hindi, English, or Hinglish). ")
        append("Personality: ${Personality.get(app)}. Be natural and concise.")
    }

    fun send(text: String) {
        val t = text.trim()
        if (t.isEmpty()) return
        viewModelScope.launch {
            when (val r = app.commandProcessor.process(t)) {
                is CommandResult.Answer -> {
                    repo.saveUser(t)
                    repo.saveAssistant(r.text, if (r.offline) "offline" else "local")
                }
                is CommandResult.Action -> {
                    repo.saveUser(t)
                    if (r.needsConfirmation) {
                        pendingAction.value = r
                    } else {
                        thinking.value = true
                        val out = try { r.execute() } catch (e: Exception) {
                            "❌ Action fail: ${e.message}"
                        }
                        thinking.value = false
                        repo.saveAssistant(out, "action")
                    }
                }
                CommandResult.Unhandled -> {
                    thinking.value = true
                    repo.ask(t, systemPrompt())   // AI provider with fallback
                    thinking.value = false
                }
            }
        }
    }

    fun confirmAction() {
        val a = pendingAction.value ?: return
        pendingAction.value = null
        viewModelScope.launch {
            thinking.value = true
            val out = try { a.execute() } catch (e: Exception) {
                "❌ Action fail: ${e.message}"
            }
            thinking.value = false
            repo.saveAssistant(out, "action")
        }
    }

    fun cancelAction() {
        pendingAction.value = null
        viewModelScope.launch { repo.saveAssistant("🚫 Action cancelled.", "system") }
    }

    fun clearChat() {
        viewModelScope.launch { repo.clear() }
    }
}

@Composable
fun ChatScreen(
    nav: NavController,
    initialInput: String? = null,
    vm: ChatViewModel = viewModel()
) {
    val context = LocalContext.current
    val messages by vm.messages.collectAsState(initial = emptyList())
    val thinking by vm.thinking.collectAsState()
    val pending by vm.pendingAction.collectAsState()
    var input by remember { mutableStateOf("") }
    var listenState by remember { mutableStateOf("idle") }
    var voiceMode by remember { mutableStateOf(false) }
    val listState = rememberLazyListState()

    val voice = remember {
        VoiceManager(
            context,
            onResult = { text -> listenState = "idle"; vm.send(text) },
            onState = { listenState = it },
            onTtsState = { }
        )
    }
    DisposableEffect(Unit) {
        voice.initTts()
        onDispose { voice.shutdown() }
    }

    LaunchedEffect(initialInput) {
        if (!initialInput.isNullOrBlank()) vm.send(initialInput)
    }
    LaunchedEffect(messages.size, thinking) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.size - 1)
            val last = messages.last()
            if (voiceMode && last.role == "assistant") {
                voice.speak(last.text, "hi-IN")
            }
        }
    }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text("💬 Chat with Ronny", style = MaterialTheme.typography.titleMedium,
                color = NeonBlue, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            SelectChip("🗣 Voice: ${if (voiceMode) "ON" else "OFF"}", voiceMode) {
                voiceMode = !voiceMode
            }
            Spacer(Modifier.width(8.dp))
            IconButton(onClick = { vm.clearChat() }) {
                Icon(Icons.Filled.Delete, "Clear chat", tint = DangerRed)
            }
        }

        Spacer(Modifier.height(8.dp))

        LazyColumn(
            state = listState,
            modifier = Modifier.weight(1f).fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(messages) { m ->
                ChatBubble(m) { text -> voice.speak(text, "hi-IN") }
            }
            if (thinking) {
                item {
                    StatusChip("🤔 Ronny soch raha hai…", NeonPurple)
                }
            }
        }

        Spacer(Modifier.height(8.dp))

        if (listenState == "listening") {
            StatusChip("🎙 Sun raha hoon…", DangerRed)
            Spacer(Modifier.height(8.dp))
        }

        Row(verticalAlignment = Alignment.CenterVertically) {
            MicButton(listening = listenState == "listening") {
                if (listenState == "listening") voice.stopListening()
                else voice.startListening("hi-IN")
            }
            Spacer(Modifier.width(10.dp))
            OutlinedTextField(
                value = input, onValueChange = { input = it },
                modifier = Modifier.weight(1f),
                placeholder = { Text("Message ya command…") },
                shape = MaterialTheme.shapes.large
            )
            Spacer(Modifier.width(8.dp))
            NeonButton("Send") {
                if (input.isNotBlank()) { vm.send(input); input = "" }
            }
        }
    }

    // Confirmation dialog — dangerous actions hamesha confirm hote hain
    pending?.let { action ->
        AlertDialog(
            onDismissRequest = { vm.cancelAction() },
            containerColor = PanelDark,
            title = { Text("⚡ ${action.label}", color = NeonBlue) },
            text = { Text(action.confirmText, color = TextLight) },
            confirmButton = {
                NeonButton("✅ Confirm", color = SuccessGreen) { vm.confirmAction() }
            },
            dismissButton = {
                NeonButton("❌ Cancel", color = DangerRed) { vm.cancelAction() }
            }
        )
    }
}

@Composable
private fun ChatBubble(m: ChatMessage, onSpeak: (String) -> Unit) {
    val isUser = m.role == "user"
    Row(
        Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Column(Modifier.fillMaxWidth(0.85f)) {
            Surface(
                shape = RoundedCornerShape(18.dp),
                color = if (isUser) NeonPurple.copy(alpha = 0.22f) else Color(0xFF12203A),
                border = BorderStroke(1.dp,
                    if (isUser) NeonPurple.copy(alpha = 0.5f) else NeonBlue.copy(alpha = 0.35f))
            ) {
                Text(m.text, Modifier.padding(12.dp), color = TextLight)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    if (isUser) "You" else if (m.provider.isBlank()) "Ronny" else "Ronny · ${m.provider}",
                    color = Color(0xFF7A8BA8),
                    style = MaterialTheme.typography.labelLarge
                )
                if (!isUser) {
                    TextButton(onClick = { onSpeak(m.text) }) {
                        Text("🔊", style = MaterialTheme.typography.labelLarge)
                    }
                }
            }
        }
    }
}
