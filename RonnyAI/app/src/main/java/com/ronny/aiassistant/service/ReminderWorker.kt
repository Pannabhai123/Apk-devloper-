package com.ronny.aiassistant.service

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.ronny.aiassistant.MainActivity
import com.ronny.aiassistant.R

class ReminderWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        val title = inputData.getString("title") ?: return Result.failure()
        val open = PendingIntent.getActivity(
            applicationContext, 0,
            Intent(applicationContext, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(applicationContext, "reminders")
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("⏰ Reminder — Ronny AI")
            .setContentText(title)
            .setContentIntent(open)
            .setAutoCancel(true)
            .build()
        try {
            NotificationManagerCompat.from(applicationContext)
                .notify((inputData.getLong("id", 0L)).toInt(), notification)
        } catch (e: SecurityException) {
            // POST_NOTIFICATIONS permission nahi hai — honest failure, fake claim nahi
            return Result.failure()
        }
        return Result.success()
    }
}
