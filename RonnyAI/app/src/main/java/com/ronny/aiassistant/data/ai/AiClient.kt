package com.ronny.aiassistant.data.ai

import com.ronny.aiassistant.data.settings.AiConfig
import com.ronny.aiassistant.data.settings.SettingsStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST
import java.util.concurrent.TimeUnit

// ---------- OpenAI-compatible DTOs (OpenRouter / Groq / Together / self-hosted) ----------
data class ChatMessageDto(val role: String, val content: String)
data class ChatRequest(val model: String, val messages: List<ChatMessageDto>)
data class ChatChoice(val index: Int, val message: ChatMessageDto?)
data class ChatResponse(val id: String?, val choices: List<ChatChoice>?, val error: ApiError?)
data class ApiError(val message: String?, val type: String?)

interface OpenAiCompatibleApi {
    @POST("chat/completions")
    suspend fun chat(
        @Header("Authorization") auth: String,
        @Body body: ChatRequest
    ): ChatResponse
}

// ---------- Provider manager with automatic fallback ----------
class AiClient(private val settings: SettingsStore) {

    data class AiResult(val text: String, val provider: String, val offline: Boolean)

    private val http = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private fun api(baseUrl: String): OpenAiCompatibleApi {
        val url = if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/"
        return Retrofit.Builder()
            .baseUrl(url)
            .client(http)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(OpenAiCompatibleApi::class.java)
    }

    /**
     * Priority: configured provider -> offline brain.
     * Koi bhi provider bina API key ke claim nahi karta ki "free hai" —
     * key na hone par offline mode clearly label hota hai.
     */
    suspend fun chat(systemPrompt: String, history: List<ChatMessageDto>): AiResult =
        withContext(Dispatchers.IO) {
            val cfg = settings.aiConfig()
            if (cfg.baseUrl.isNotBlank() && cfg.apiKey.isNotBlank() && cfg.model.isNotBlank()) {
                try {
                    val messages = buildList {
                        add(ChatMessageDto("system", systemPrompt))
                        addAll(history.takeLast(20))
                    }
                    val resp = api(cfg.baseUrl)
                        .chat("Bearer ${cfg.apiKey}", ChatRequest(cfg.model, messages))
                    val text = resp.choices?.firstOrNull()?.message?.content?.trim()
                    if (!text.isNullOrEmpty()) return@withContext AiResult(text, cfg.providerName, false)
                    if (resp.error != null) {
                        return@withContext AiResult(
                            "⚠️ ${cfg.providerName} error: ${resp.error.message ?: "unknown"}",
                            cfg.providerName, true
                        )
                    }
                } catch (e: Exception) {
                    return@withContext AiResult(
                        "⚠️ Network/provider error (${cfg.providerName}): ${e.message}\n" +
                            "Offline mode mein switch kar raha hoon.",
                        cfg.providerName, true
                    )
                }
            }
            AiResult(offlineReply(), "offline", true)
        }

    // Offline brain — honest local assistant, fake AI response nahi
    private fun offlineReply(): String = buildString {
        appendLine("🤖 *Offline Mode* — AI provider connected nahi hai.")
        appendLine()
        appendLine("Main abhi local commands samajhta hoon (apps kholna, torch, battery, "
            + "reminders, SOS, WhatsApp...).")
        appendLine()
        appendLine("Full AI intelligence ke liye: *Settings → AI Provider* mein apna "
            + "OpenRouter/Groq/Together base-URL, model aur API key daalein. "
            + "Key sirf encrypted storage mein save hoti hai.")
    }
}
