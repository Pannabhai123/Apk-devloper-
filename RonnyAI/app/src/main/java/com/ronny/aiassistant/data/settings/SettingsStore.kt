package com.ronny.aiassistant.data.settings

import android.content.Context
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

data class AiConfig(
    val providerName: String = "custom",
    val baseUrl: String = "",        // e.g. https://openrouter.ai/api/v1/
    val apiKey: String = "",         // sirf encrypted prefs se aata hai
    val model: String = ""           // e.g. meta-llama/llama-3.1-8b-instruct:free
)

data class AppSettings(
    val language: String = "hi-IN",
    val voiceSpeed: Float = 1.0f,
    val voicePitch: Float = 1.0f,
    val avatarMode: Int = 0,         // 0 = AI girl, 1 = JARVIS circle
    val ttsEnabled: Boolean = true,
    val memoryEnabled: Boolean = true
)

private val Context.dataStore by preferencesDataStore("settings")

class SettingsStore(private val context: Context) {

    private object Keys {
        val LANGUAGE = stringPreferencesKey("language")
        val SPEED = floatPreferencesKey("voice_speed")
        val PITCH = floatPreferencesKey("voice_pitch")
        val AVATAR = intPreferencesKey("avatar_mode")
        val TTS = booleanPreferencesKey("tts_enabled")
        val MEMORY = booleanPreferencesKey("memory_enabled")
        val PROVIDER = stringPreferencesKey("ai_provider")
        val BASE_URL = stringPreferencesKey("ai_base_url")
        val MODEL = stringPreferencesKey("ai_model")
        val SOS_CONTACTS = stringPreferencesKey("sos_contacts") // "name:phone|name:phone"
    }

    // API key encrypted storage mein — source/APK mein kabhi nahi
    private val securePrefs by lazy {
        val mk = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
        EncryptedSharedPreferences.create(
            context, "ronny_secure", mk,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    val settingsFlow: Flow<AppSettings> = context.dataStore.data.map { p ->
        AppSettings(
            language = p[Keys.LANGUAGE] ?: "hi-IN",
            voiceSpeed = p[Keys.SPEED] ?: 1.0f,
            voicePitch = p[Keys.PITCH] ?: 1.0f,
            avatarMode = p[Keys.AVATAR] ?: 0,
            ttsEnabled = p[Keys.TTS] ?: true,
            memoryEnabled = p[Keys.MEMORY] ?: true
        )
    }

    suspend fun update(transform: (AppSettings) -> AppSettings) {
        val cur = settingsFlow.first()
        val nw = transform(cur)
        context.dataStore.edit {
            it[Keys.LANGUAGE] = nw.language
            it[Keys.SPEED] = nw.voiceSpeed
            it[Keys.PITCH] = nw.voicePitch
            it[Keys.AVATAR] = nw.avatarMode
            it[Keys.TTS] = nw.ttsEnabled
            it[Keys.MEMORY] = nw.memoryEnabled
        }
    }

    suspend fun aiConfig(): AiConfig {
        val p = context.dataStore.data.first()
        return AiConfig(
            providerName = p[Keys.PROVIDER] ?: "custom",
            baseUrl = p[Keys.BASE_URL] ?: "",
            apiKey = securePrefs.getString("api_key", "") ?: "",
            model = p[Keys.MODEL] ?: ""
        )
    }

    suspend fun saveAiConfig(cfg: AiConfig) {
        context.dataStore.edit {
            it[Keys.PROVIDER] = cfg.providerName
            it[Keys.BASE_URL] = cfg.baseUrl
            it[Keys.MODEL] = cfg.model
        }
        securePrefs.edit().putString("api_key", cfg.apiKey).apply()
    }

    suspend fun sosContacts(): List<Pair<String, String>> {
        val raw = context.dataStore.data.first()[Keys.SOS_CONTACTS] ?: return emptyList()
        return raw.split("|").mapNotNull {
            val parts = it.split(":")
            if (parts.size == 2) parts[0] to parts[1] else null
        }
    }

    suspend fun saveSosContacts(contacts: List<Pair<String, String>>) {
        context.dataStore.edit {
            it[Keys.SOS_CONTACTS] = contacts.joinToString("|") { (n, p) -> "$n:$p" }
        }
    }
}
