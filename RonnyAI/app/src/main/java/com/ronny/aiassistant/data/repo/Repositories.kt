package com.ronny.aiassistant.data.repo

import android.content.Context
import androidx.work.*
import com.ronny.aiassistant.data.ai.AiClient
import com.ronny.aiassistant.data.ai.ChatMessageDto
import com.ronny.aiassistant.data.db.*
import com.ronny.aiassistant.service.ReminderWorker
import kotlinx.coroutines.flow.Flow
import java.util.concurrent.TimeUnit

class ChatRepository(private val dao: ChatDao, private val ai: AiClient) {
    fun messages(): Flow<List<ChatMessage>> = dao.flow()

    suspend fun ask(userText: String, systemPrompt: String): AiClient.AiResult {
        dao.insert(ChatMessage(role = "user", text = userText))
        val history = dao.latest(20).reversed()
            .map { ChatMessageDto(it.role, it.text) }
        val result = ai.chat(systemPrompt, history)
        dao.insert(ChatMessage(role = "assistant", text = result.text, provider = result.provider))
        return result
    }

    suspend fun saveAssistant(text: String, provider: String = "system") {
        dao.insert(ChatMessage(role = "assistant", text = text, provider = provider))
    }

    suspend fun saveUser(text: String) =
        dao.insert(ChatMessage(role = "user", text = text))

    suspend fun clear() = dao.clear()
}

class MemoryRepository(private val dao: MemoryDao) {
    fun entries(): Flow<List<MemoryEntity>> = dao.flow()
    suspend fun save(key: String, value: String) = dao.insert(MemoryEntity(key = key, value = value))
    suspend fun get(key: String): String? = dao.get(key)
    suspend fun delete(m: MemoryEntity) = dao.delete(m)
    suspend fun clearAll() = dao.clearAll()

    // Privacy: memory ON hai tabhi save hota hai (caller check karta hai)
    suspend fun rememberIfAllowed(allowed: Boolean, key: String, value: String) {
        if (allowed) save(key, value)
    }
}

class ReminderRepository(
    private val context: Context,
    private val dao: ReminderDao
) {
    fun reminders(): Flow<List<ReminderEntity>> = dao.flow()

    suspend fun add(title: String, timeMillis: Long): Long {
        val id = dao.insert(ReminderEntity(title = title, timeMillis = timeMillis))
        schedule(id, title, timeMillis)
        return id
    }

    suspend fun delete(r: ReminderEntity) {
        dao.delete(r)
        WorkManager.getInstance(context).cancelUniqueWork("reminder-${r.id}")
    }

    suspend fun setDone(r: ReminderEntity) = dao.update(r.copy(done = true))

    private fun schedule(id: Long, title: String, timeMillis: Long) {
        val delay = (timeMillis - System.currentTimeMillis()).coerceAtLeast(0)
        val req = OneTimeWorkRequestBuilder<ReminderWorker>()
            .setInitialDelay(delay, TimeUnit.MILLISECONDS)
            .setInputData(workDataOf("id" to id, "title" to title))
            .build()
        WorkManager.getInstance(context).enqueueUniqueWork(
            "reminder-$id", ExistingWorkPolicy.REPLACE, req
        )
    }
}
