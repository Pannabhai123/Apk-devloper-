package com.ronny.aiassistant.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val NeonBlue = Color(0xFF00D4FF)
val NeonPurple = Color(0xFFA855F7)
val BgDark = Color(0xFF0A0E1A)
val PanelDark = Color(0xFF101728)
val DangerRed = Color(0xFFFF3B5C)
val TextLight = Color(0xFFE6F1FF)
val SuccessGreen = Color(0xFF22D39A)

private val RonnyColors = darkColorScheme(
    primary = NeonBlue, onPrimary = Color.Black,
    secondary = NeonPurple, background = BgDark,
    surface = PanelDark, onSurface = TextLight, error = DangerRed
)

private val RonnyType = Typography(
    headlineMedium = TextStyle(fontWeight = FontWeight.Bold, fontSize = 28.sp),
    titleMedium = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 18.sp),
    bodyMedium = TextStyle(fontSize = 15.sp, lineHeight = 22.sp),
    labelLarge = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
)

@Composable
fun RonnyTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = RonnyColors, typography = RonnyType, content = content)
}
