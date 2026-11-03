package com.ronny.aiassistant.ui.components

import android.content.Context
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.ronny.aiassistant.ui.theme.*
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

// ---------- Personality (session prefs) ----------
object Personality {
    fun get(c: Context) =
        c.getSharedPreferences("ronny_prefs", Context.MODE_PRIVATE)
            .getString("personality", "Friendly") ?: "Friendly"
    fun set(c: Context, p: String) =
        c.getSharedPreferences("ronny_prefs", Context.MODE_PRIVATE)
            .edit().putString("personality", p).apply()
}

// ---------- Glass Card ----------
@Composable
fun GlassCard(
    modifier: Modifier = Modifier,
    borderColor: Color = NeonBlue.copy(alpha = 0.35f),
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(20.dp),
        color = Color(0x14FFFFFF),
        border = BorderStroke(1.dp, borderColor)
    ) { Column(Modifier.padding(16.dp), content = content) }
}

// ---------- Neon Button ----------
@Composable
fun NeonButton(
    text: String,
    icon: ImageVector? = null,
    color: Color = NeonBlue,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Surface(
        onClick = onClick,
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        color = color.copy(alpha = 0.12f),
        border = BorderStroke(1.dp, color.copy(alpha = 0.55f))
    ) {
        Row(
            Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (icon != null) {
                Icon(icon, null, tint = color, modifier = Modifier.size(20.dp))
                Spacer(Modifier.width(8.dp))
            }
            Text(text, color = TextLight, fontWeight = FontWeight.SemiBold)
        }
    }
}

// ---------- Selectable Chip ----------
@Composable
fun SelectChip(text: String, selected: Boolean, onClick: () -> Unit) {
    Surface(
        onClick = onClick,
        shape = RoundedCornerShape(50),
        color = if (selected) NeonBlue.copy(alpha = 0.22f) else Color(0x11FFFFFF),
        border = BorderStroke(1.dp, if (selected) NeonBlue else Color(0x33FFFFFF))
    ) {
        Text(
            text, Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
            color = if (selected) NeonBlue else TextLight, fontWeight = FontWeight.Medium
        )
    }
}

// ---------- Status Chip ----------
@Composable
fun StatusChip(text: String, color: Color) {
    Surface(
        shape = RoundedCornerShape(50),
        color = color.copy(alpha = 0.15f),
        border = BorderStroke(1.dp, color.copy(alpha = 0.5f))
    ) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            verticalAlignment = Alignment.CenterVertically) {
            Canvas(Modifier.size(10.dp)) {
                drawCircle(color = color)
            }
            Spacer(Modifier.width(8.dp))
            Text(text, color = color, style = MaterialTheme.typography.labelLarge)
        }
    }
}

// ---------- Voice Wave ----------
@Composable
fun VoiceWave(active: Boolean, modifier: Modifier = Modifier, bars: Int = 22) {
    val transition = rememberInfiniteTransition(label = "wave")
    val phase by transition.animateFloat(
        0f, (2 * PI).toFloat(),
        infiniteRepeatable(tween(1400, easing = LinearEasing)), label = "phase"
    )
    val energy by animateFloatAsState(if (active) 1f else 0.12f, label = "energy")
    Canvas(modifier.height(46.dp)) {
        val bw = size.width / (bars * 1.7f)
        for (i in 0 until bars) {
            val x = i * size.width / bars
            val h = ((sin(phase + i * 0.6f) + 1f) / 2f) * size.height * energy
            drawRoundRect(
                color = NeonBlue.copy(alpha = 0.65f + 0.35f * energy),
                topLeft = Offset(x, (size.height - h.coerceAtLeast(3.dp.toPx())) / 2),
                size = Size(bw, h.coerceAtLeast(3.dp.toPx())),
                cornerRadius = CornerRadius(bw / 2)
            )
        }
    }
}

// ---------- AI Avatar (Mode 0: AI Girl, Mode 1: JARVIS) ----------
@Composable
fun AiAvatar(mode: Int, active: Boolean, modifier: Modifier = Modifier) {
    val t = rememberInfiniteTransition(label = "av")
    val pulse by t.animateFloat(
        0.92f, 1.08f,
        infiniteRepeatable(tween(1800, easing = FastOutSlowInEasing)), label = "pulse"
    )
    val rot by t.animateFloat(
        0f, 360f,
        infiniteRepeatable(tween(10000, easing = LinearEasing)), label = "rot"
    )
    Canvas(modifier.size(230.dp)) {
        val c = Offset(size.width / 2, size.height / 2)
        val r = size.minDimension / 2 * (if (active) pulse else 1f)
        val accent = if (mode == 0) NeonPurple else NeonBlue
        drawCircle(accent.copy(alpha = 0.18f), radius = r, center = c)
        drawCircle(accent.copy(alpha = 0.8f), radius = r * 0.8f, center = c,
            style = Stroke(2.5.dp.toPx()))
        if (mode == 0) {
            drawCircle(Color(0xFF1B2440), r * 0.56f, c)
            drawArc(NeonPurple.copy(alpha = 0.9f), 150f, 240f, useCenter = false,
                topLeft = Offset(c.x - r * 0.64f, c.y - r * 0.64f),
                size = Size(r * 1.28f, r * 1.28f), style = Stroke(9.dp.toPx()))
            drawCircle(NeonBlue, r * 0.085f, Offset(c.x - r * 0.19f, c.y - r * 0.07f))
            drawCircle(NeonBlue, r * 0.085f, Offset(c.x + r * 0.19f, c.y - r * 0.07f))
            drawArc(TextLight, 25f, 130f, useCenter = false,
                topLeft = Offset(c.x - r * 0.2f, c.y - r * 0.22f),
                size = Size(r * 0.4f, r * 0.4f), style = Stroke(3.dp.toPx()))
            for (i in 0..7) {
                val a = rot * PI / 180 + i * PI / 4
                drawCircle(accent.copy(alpha = 0.75f), 3.2.dp.toPx(),
                    Offset(c.x + cos(a).toFloat() * r * 0.7f,
                        c.y + sin(a).toFloat() * r * 0.7f))
            }
        } else {
            drawArc(NeonBlue, rot, 300f, useCenter = false,
                topLeft = Offset(c.x - r * 0.72f, c.y - r * 0.72f),
                size = Size(r * 1.44f, r * 1.44f), style = Stroke(4.dp.toPx()))
            drawArc(NeonPurple, 180f + rot, 120f, useCenter = false,
                topLeft = Offset(c.x - r * 0.54f, c.y - r * 0.54f),
                size = Size(r * 1.08f, r * 1.08f), style = Stroke(6.dp.toPx()))
            drawCircle(Color(0xFF081226), r * 0.34f, c)
            drawCircle(NeonBlue, r * 0.34f, c, style = Stroke(2.dp.toPx()))
            drawLine(NeonBlue.copy(alpha = 0.7f),
                Offset(c.x - r * 0.48f, c.y), Offset(c.x - r * 0.22f, c.y), 2.dp.toPx())
            drawLine(NeonBlue.copy(alpha = 0.7f),
                Offset(c.x + r * 0.22f, c.y), Offset(c.x + r * 0.48f, c.y), 2.dp.toPx())
            drawLine(NeonBlue.copy(alpha = 0.7f),
                Offset(c.x, c.y - r * 0.48f), Offset(c.x, c.y - r * 0.22f), 2.dp.toPx())
            drawLine(NeonBlue.copy(alpha = 0.7f),
                Offset(c.x, c.y + r * 0.22f), Offset(c.x, c.y + r * 0.48f), 2.dp.toPx())
        }
    }
}

// ---------- Mic Button (pulsing) ----------
@Composable
fun MicButton(listening: Boolean, onClick: () -> Unit) {
    val t = rememberInfiniteTransition(label = "mic")
    val scale by t.animateFloat(
        1f, if (listening) 1.12f else 1f,
        infiniteRepeatable(tween(900, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse), label = "scale"
    )
    Surface(
        onClick = onClick,
        shape = CircleShape,
        color = if (listening) DangerRed.copy(alpha = 0.25f) else NeonPurple.copy(alpha = 0.22f),
        border = BorderStroke(2.dp, if (listening) DangerRed else NeonPurple),
        modifier = Modifier.size((86 * scale).dp)
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(if (listening) "⏹" else "🎙", style = MaterialTheme.typography.headlineMedium)
        }
    }
}
