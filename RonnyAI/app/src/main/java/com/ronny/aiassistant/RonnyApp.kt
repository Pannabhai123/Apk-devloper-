package com.ronny.aiassistant

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.ronny.aiassistant.data.db.RonnyDatabase
import com.ronny.aiassistant.data.ai.AiClient
import com.ronny.aiassistant.data.repo.ChatRepository
import com.ronny.aiassistant.data.repo.MemoryRepository
import com.ronny.aiassistant.data.repo.ReminderRepository
import com.ronny.aiassistant.data.settings.SettingsStore
import com.ronny.aiassistant.domain.CommandProcessor

// Manual DI (ServiceLocator) — lightweight, low-end devices friendly
class RonnyApp : Application() {

    val database: RonnyDatabase by lazy { RonnyDatabase.get(this) }
    val settings: SettingsStore by lazy { SettingsStore(this) }
    val aiClient: AiClient by lazy { AiClient(settings) }
    val chatRepository: ChatRepository by lazy { ChatRepository(database.chatDao(), aiClient) }
    val memoryRepository: MemoryRepository by lazy { MemoryRepository(database.memoryDao()) }
    val reminderRepository: ReminderRepository by lazy { ReminderRepository(this, database.reminderDao()) }
    val commandProcessor: CommandProcessor by lazy {
        CommandProcessor(this, reminderRepository, memoryRepository)
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(
                NotificationChannel("reminders", getString(R.string.channel_reminders),
                    NotificationManager.IMPORTANCE_HIGH)
            )
            nm.createNotificationChannel(
                NotificationChannel("sos", getString(R.string.channel_sos),
                    NotificationManager.IMPORTANCE_MAX)
            )
        }
    }
}
