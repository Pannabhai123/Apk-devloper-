package com.ronny.aiassistant

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.ronny.aiassistant.ui.chat.ChatScreen
import com.ronny.aiassistant.ui.home.HomeScreen
import com.ronny.aiassistant.ui.reminders.RemindersScreen
import com.ronny.aiassistant.ui.settings.SettingsScreen
import com.ronny.aiassistant.ui.sos.SosScreen
import com.ronny.aiassistant.ui.theme.RonnyTheme
import java.net.URLDecoder

class MainActivity : ComponentActivity() {

    private val permissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Runtime permissions (honest: sirf wahi jo features ke liye chahiye)
        val perms = buildList {
            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
            add(Manifest.permission.RECORD_AUDIO)
            add(Manifest.permission.ACCESS_FINE_LOCATION)
            add(Manifest.permission.CAMERA)
            add(Manifest.permission.SEND_SMS)
        }
        permissionLauncher.launch(perms.toTypedArray())

        setContent { RonnyTheme { RonnyNav() } }
    }
}

@Composable
fun RonnyNav() {
    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = "home") {
        composable("home") { HomeScreen(nav) }
        composable("chat") { ChatScreen(nav) }
        composable(
            route = "chat_input/{text}",
            arguments = listOf(navArgument("text") { type = NavType.StringType })
        ) { back ->
            val raw = back.arguments?.getString("text").orEmpty()
            ChatScreen(nav, initialInput = URLDecoder.decode(raw, "UTF-8"))
        }
        composable("sos") { SosScreen(nav) }
        composable("reminders") { RemindersScreen(nav) }
        composable("settings") { SettingsScreen(nav) }
    }
}
