package com.ronny.aiassistant.data.db

import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Entity(tableName = "chat_messages")
data class ChatMessage(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val role: String,               // "user" | "assistant"
    val text: String,
    val provider: String = "",      // "openrouter" | "offline" | ...
    val timestamp: Long = System.currentTimeMillis()
)

@Entity(tableName = "reminders")
data class ReminderEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val title: String,
    val timeMillis: Long,
    val done: Boolean = false
)

@Entity(tableName = "memory")
data class MemoryEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val key: String,
    val value: String,
    val timestamp: Long = System.currentTimeMillis()
)

@Dao
interface ChatDao {
    @Query("SELECT * FROM chat_messages ORDER BY timestamp ASC")
    fun flow(): Flow<List<ChatMessage>>
    @Query("SELECT * FROM chat_messages ORDER BY timestamp DESC LIMIT :limit")
    suspend fun latest(limit: Int): List<ChatMessage>
    @Insert suspend fun insert(m: ChatMessage): Long
    @Query("DELETE FROM chat_messages") suspend fun clear()
}

@Dao
interface ReminderDao {
    @Query("SELECT * FROM reminders ORDER BY timeMillis ASC")
    fun flow(): Flow<List<ReminderEntity>>
    @Query("SELECT * FROM reminders WHERE id = :id") suspend fun byId(id: Long): ReminderEntity?
    @Insert suspend fun insert(r: ReminderEntity): Long
    @Update suspend fun update(r: ReminderEntity)
    @Delete suspend fun delete(r: ReminderEntity)
}

@Dao
interface MemoryDao {
    @Query("SELECT * FROM memory ORDER BY timestamp DESC")
    fun flow(): Flow<List<MemoryEntity>>
    @Insert suspend fun insert(m: MemoryEntity): Long
    @Delete suspend fun delete(m: MemoryEntity)
    @Query("DELETE FROM memory") suspend fun clearAll()
    @Query("SELECT value FROM memory WHERE key = :key LIMIT 1") suspend fun get(key: String): String?
}

@Database(
    entities = [ChatMessage::class, ReminderEntity::class, MemoryEntity::class],
    version = 1, exportSchema = false
)
abstract class RonnyDatabase : RoomDatabase() {
    abstract fun chatDao(): ChatDao
    abstract fun reminderDao(): ReminderDao
    abstract fun memoryDao(): MemoryDao

    companion object {
        @Volatile private var INSTANCE: RonnyDatabase? = null
        fun get(context: Context): RonnyDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext, RonnyDatabase::class.java, "ronny.db"
                ).build().also { INSTANCE = it }
            }
    }
}
