package com.ronny.aiassistant.ui.reminders

import android.app.Application
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
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
import com.ronny.aiassistant.data.db.ReminderEntity
import com.ronny.aiassistant.ui.components.*
import com.ronny.aiassistant.ui.theme.*
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class RemindersViewModel(application: Application) : AndroidViewModel(application) {
    private val repo = (application as RonnyApp).reminderRepository
    val reminders = repo.reminders()

    fun add(title: String, hour: Int, minute: Int, tomorrow: Boolean) {
        viewModelScope.launch {
            val cal = Calendar.getInstance()
            cal.set(Calendar.HOUR_OF_DAY, hour)
            cal.set(Calendar.MINUTE, minute)
            cal.set(Calendar.SECOND, 0)
            if (tomorrow || cal.timeInMillis <= System.currentTimeMillis())
                cal.add(Calendar.DAY_OF_YEAR, 1)
            repo.add(title, cal.timeInMillis)
        }
    }

    fun delete(r: ReminderEntity) {
        viewModelScope.launch { repo.delete(r) }
    }

    fun toggleDone(r: ReminderEntity) {
        viewModelScope.launch {
            if (r.done) repo.add(r.title, System.currentTimeMillis() + 60000)
            else repo.setDone(r)
        }
    }
}

@Composable
fun RemindersScreen(nav: NavController, vm: RemindersViewModel = viewModel()) {
    val reminders by vm.reminders.collectAsState(initial = emptyList())
    var showDialog by remember { mutableStateOf(false) }
    val fmt = remember { SimpleDateFormat("dd MMM, hh:mm a", Locale.getDefault()) }

    Column(Modifier.fillMaxSize().padding(18.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text("⏰ Smart Reminders", style = MaterialTheme.typography.titleMedium,
                color = NeonBlue, fontWeight = FontWeight.Bold)
            Spacer(Modifier.weight(1f))
            NeonButton("➕ New") { showDialog = true }
        }
        Spacer(Modifier.height(12.dp))

        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(reminders) { r ->
                GlassCard(Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(r.title, color = TextLight,
                                fontWeight = FontWeight.SemiBold,
                                style = MaterialTheme.typography.bodyMedium)
                            Text(fmt.format(Date(r.timeMillis)),
                                color = NeonBlue, style = MaterialTheme.typography.labelLarge)
                        }
                        SelectChip(if (r.done) "✅ Done" else "⏰ Pending", r.done) {
                            vm.toggleDone(r)
                        }
                        IconButton(onClick = { vm.delete(r) }) {
                            Icon(Icons.Filled.Delete, "Delete", tint = DangerRed)
                        }
                    }
                }
            }
        }
    }

    if (showDialog) {
        var title by remember { mutableStateOf("") }
        var hh by remember { mutableStateOf("07") }
        var mm by remember { mutableStateOf("00") }
        var tomorrow by remember { mutableStateOf(false) }
        AlertDialog(
            onDismissRequest = { showDialog = false },
            containerColor = PanelDark,
            title = { Text("⏰ New Reminder", color = NeonBlue) },
            text = {
                Column {
                    OutlinedTextField(title, { title = it },
                        placeholder = { Text("Kis cheez ka reminder?") })
                    Spacer(Modifier.height(8.dp))
                    Row {
                        OutlinedTextField(hh, { hh = it }, Modifier.width(80.dp),
                            placeholder = { Text("HH") })
                        Spacer(Modifier.width(8.dp))
                        OutlinedTextField(mm, { mm = it }, Modifier.width(80.dp),
                            placeholder = { Text("MM") })
                        Spacer(Modifier.width(8.dp))
                        SelectChip("Kal", tomorrow) { tomorrow = !tomorrow }
                    }
                }
            },
            confirmButton = {
                NeonButton("✅ Set") {
                    val h = hh.toIntOrNull() ?: 7
                    val m = mm.toIntOrNull() ?: 0
                    if (title.isNotBlank()) vm.add(title, h % 24, m % 60, tomorrow)
                    showDialog = false
                }
            },
            dismissButton = {
                NeonButton("Cancel", color = DangerRed) { showDialog = false }
            }
        )
    }
}
