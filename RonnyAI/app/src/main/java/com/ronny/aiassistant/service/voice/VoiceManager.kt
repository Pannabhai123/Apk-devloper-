package com.ronny.aiassistant.service.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.util.Locale

/**
 * Push-to-talk voice manager.
 * Mic sirf button dabane par active hota hai — unrestricted background
 * recording NAHI hoti (battery efficient + privacy).
 */
class VoiceManager(
    private val context: Context,
    private val onPartial: (String) -> Unit = {},
    private val onResult: (String) -> Unit,
    private val onState: (String) -> Unit = {},   // "listening" | "error" | "idle"
    private val onTtsState: (String) -> Unit = {}
) {
    private var recognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    // ---------- Speech to Text ----------
    fun startListening(languageTag: String = "hi-IN") {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            onState("error"); onResult("⚠️ Is device par speech recognition available nahi hai.")
            return
        }
        onState("listening")
        recognizer?.destroy()
        recognizer = SpeechRecognizer.createSpeechRecognizer(context).also { r ->
            r.setRecognitionListener(object : RecognitionListener {
                override fun onResults(results: Bundle?) {
                    val text = results
                        ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        ?.firstOrNull().orEmpty()
                    onState("idle")
                    if (text.isNotBlank()) onResult(text)
                }
                override fun onPartialResults(partialResults: Bundle?) {
                    partialResults
                        ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        ?.firstOrNull()?.let { onPartial(it) }
                }
                override fun onError(error: Int) {
                    onState("error")
                    onResult("🎙️ Voice error ($error) — phir se try karein.")
                }
                override fun onReadyForSpeech(params: Bundle?) {}
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
        }
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        }
        recognizer?.startListening(intent)
    }

    fun stopListening() {
        recognizer?.stopListening()
        onState("idle")
    }

    // ---------- Text to Speech ----------
    fun initTts() {
        tts = TextToSpeech(context) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
        }
    }

    fun speak(text: String, languageTag: String = "hi-IN",
              speed: Float = 1.0f, pitch: Float = 1.0f) {
        val engine = tts ?: run { initTts(); return }
        if (!ttsReady) return
        val locale = Locale.forLanguageTag(languageTag)
        val avail = engine.isLanguageAvailable(locale)
        // Hindi TTS sab devices par nahi hoti — honest fallback to default
        if (avail >= TextToSpeech.LANG_AVAILABLE) engine.language = locale
        else engine.language = Locale.getDefault()
        engine.setSpeechRate(speed)
        engine.setPitch(pitch)
        engine.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
            override fun onStart(utteranceId: String?) { onTtsState("speaking") }
            override fun onDone(utteranceId: String?) { onTtsState("idle") }
            @Deprecated("Deprecated in Java")
            override fun onError(utteranceId: String?) { onTtsState("idle") }
        })
        // Plain text — HTML tags nahi
        engine.speak(text.replace(Regex("\\*|_"), ""), TextToSpeech.QUEUE_FLUSH, null, "ronny")
    }

    fun shutdown() {
        recognizer?.destroy(); recognizer = null
        tts?.shutdown(); tts = null
    }
}
