package com.ronny.aiassistant;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.app.ActivityManager;
import android.hardware.camera2.CameraManager;
import android.location.LocationManager;
import android.media.AudioManager;
import android.net.Uri;
import android.os.BatteryManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.StatFs;
import android.os.SystemClock;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.telephony.SmsManager;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.Locale;

/**
 * Ronny AI — Lite. Real Android automation + voice + AI chat.
 * UI: WebView (futuristic HTML/CSS/JS). Engine: native Java bridge.
 * Koi fake action nahi — sab real Android APIs.
 */
public class MainActivity extends Activity {

    private WebView web;
    private TextToSpeech tts;
    private SpeechRecognizer recognizer;
    private CameraManager cameraManager;
    private boolean torchOn = false;
    private final Handler main = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Dark cinematic system bars
        getWindow().setStatusBarColor(0xFF0A0E1A);
        getWindow().setNavigationBarColor(0xFF0A0E1A);

        web = new WebView(this);
        setContentView(web);
        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setAllowFileAccess(true);
        web.setWebViewClient(new WebViewClient());
        web.setBackgroundColor(0xFF0A0E1A);
        web.addJavascriptInterface(new Bridge(), "Ronny");
        web.loadUrl("file:///android_asset/index.html");

        cameraManager = (CameraManager) getSystemService(Context.CAMERA_SERVICE);

        // Notification channel (reminders)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel("reminders", "Reminders",
                    NotificationManager.IMPORTANCE_HIGH);
            getSystemService(NotificationManager.class).createNotificationChannel(ch);
        }

        // TTS init
        tts = new TextToSpeech(this, status -> {
            if (status == TextToSpeech.SUCCESS) tts.setLanguage(new Locale("hi", "IN"));
        });
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String utteranceId) { js("onTtsState('speaking')"); }
            @Override public void onDone(String utteranceId) { js("onTtsState('idle')"); }
            @Override @Deprecated public void onError(String utteranceId) { js("onTtsState('idle')"); }
        });

        // Runtime permissions (honest: sirf features ke liye)
        ArrayList<String> need = new ArrayList<>();
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
            need.add(Manifest.permission.RECORD_AUDIO);
        if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED)
            need.add(Manifest.permission.ACCESS_FINE_LOCATION);
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED)
            need.add(Manifest.permission.CAMERA);
        if (checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED)
            need.add(Manifest.permission.SEND_SMS);
        if (!need.isEmpty())
            requestPermissions(need.toArray(new String[0]), 101);
    }

    private void js(final String code) {
        main.post(() -> web.evaluateJavascript(code, null));
    }

    private static String q(String s) {
        try { return JSONObject.quote(s == null ? "" : s); }
        catch (Exception e) { return "\"\""; }
    }

    @Override
    public void onBackPressed() {
        js("if(window.onBack){window.onBack();}");
    }

    // ================= BRIDGE =================
    public class Bridge {

        // ---------- App automation ----------
        @JavascriptInterface
        public String openApp(String pkg) {
            try {
                Intent i = getPackageManager().getLaunchIntentForPackage(pkg);
                if (i == null) throw new Exception("app not installed");
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
                return "✅ App open ho gaya.";
            } catch (Exception e) {
                return "❌ Ye app is device par nahi hai: " + pkg;
            }
        }

        @JavascriptInterface
        public String openUrl(String url) {
            try {
                Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
                return "✅ Khul raha hai…";
            } catch (Exception e) { return "❌ " + e.getMessage(); }
        }

        @JavascriptInterface
        public String openSettings() {
            Intent i = new Intent(android.provider.Settings.ACTION_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
            return "✅ Settings khul rahi hai…";
        }

        @JavascriptInterface
        public String openWifiSettings() {
            Intent i = new Intent(android.provider.Settings.ACTION_WIFI_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
            return "✅ Wi-Fi settings khul rahi hain…";
        }

        @JavascriptInterface
        public String openBluetoothSettings() {
            Intent i = new Intent(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
            return "✅ Bluetooth settings khul rahi hain…";
        }

        @JavascriptInterface
        public String openAppSettings() {
            Intent i = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
            return "✅ App permission settings khul rahi hain…";
        }

        @JavascriptInterface
        public String openBrightnessSettings() {
            Intent i = new Intent(android.provider.Settings.ACTION_MANAGE_WRITE_SETTINGS,
                    Uri.parse("package:" + getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try { startActivity(i); return "✅ Brightness permission page khul raha hai — Allow karein."; }
            catch (Exception e) { return "❌ " + e.getMessage(); }
        }

        // ---------- Torch ----------
        @JavascriptInterface
        public String toggleTorch() {
            try {
                if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, 102);
                    return "⚠️ Flashlight ke liye Camera permission chahiye.";
                }
                String id = cameraManager.getCameraIdList()[0];
                torchOn = !torchOn;
                cameraManager.setTorchMode(id, torchOn);
                return torchOn ? "🔦 Flashlight ON." : "💡 Flashlight OFF.";
            } catch (Exception e) { return "❌ Torch fail: " + e.getMessage(); }
        }

        // ---------- Volume ----------
        @JavascriptInterface
        public String volumeUp() {
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_RAISE, 0);
            return "🔊 Volume: " + am.getStreamVolume(AudioManager.STREAM_MUSIC);
        }

        @JavascriptInterface
        public String volumeDown() {
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_LOWER, 0);
            return "🔉 Volume: " + am.getStreamVolume(AudioManager.STREAM_MUSIC);
        }

        @JavascriptInterface
        public String volumeMute() {
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            am.adjustStreamVolume(AudioManager.STREAM_MUSIC, AudioManager.ADJUST_MUTE, 0);
            return "🔇 Media muted.";
        }

        // ---------- Info ----------
        @JavascriptInterface
        public String batteryInfo() {
            BatteryManager bm = (BatteryManager) getSystemService(Context.BATTERY_SERVICE);
            int pct = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
            Intent sticky = registerReceiver(null, new IntentFilter(Intent.ACTION_BATTERY_CHANGED));
            String status = "Discharging 🔋";
            int st = sticky != null ? sticky.getIntExtra(BatteryManager.EXTRA_STATUS, -1) : -1;
            if (st == BatteryManager.BATTERY_STATUS_CHARGING) status = "Charging ⚡";
            else if (st == BatteryManager.BATTERY_STATUS_FULL) status = "Full ✅";
            int healthG = sticky != null ? sticky.getIntExtra(BatteryManager.EXTRA_HEALTH, -1) : -1;
            String health = healthG == BatteryManager.BATTERY_HEALTH_GOOD ? "Good" :
                    healthG == BatteryManager.BATTERY_HEALTH_OVERHEAT ? "Overheat ⚠️" : "Unknown";
            float temp = sticky != null ? sticky.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, -1) / 10f : -1;
            return "🔋 Battery: " + pct + "% (" + status + ")\nHealth: " + health +
                    "\nTemperature: " + temp + "°C";
        }

        @JavascriptInterface
        public String deviceInfo() {
            ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
            android.app.ActivityManager.MemoryInfo mi = new android.app.ActivityManager.MemoryInfo();
            am.getMemoryInfo(mi);
            StatFs stat = new StatFs(android.os.Environment.getDataDirectory().getPath());
            double ramTotal = mi.totalMem / (1024.0 * 1024 * 1024);
            double ramFree = mi.availMem / (1024.0 * 1024 * 1024);
            double storTotal = stat.getTotalBytes() / (1024.0 * 1024 * 1024);
            double storFree = stat.getAvailableBytes() / (1024.0 * 1024 * 1024);
            return String.format(Locale.US,
                    "📱 Device: %s %s\nAndroid: %s (SDK %d)\nRAM: %.1f GB total, %.1f GB free\nStorage: %.1f GB total, %.1f GB free",
                    Build.MANUFACTURER, Build.MODEL, Build.VERSION.RELEASE, Build.VERSION.SDK_INT,
                    ramTotal, ramFree, storTotal, storFree);
        }

        // ---------- TTS ----------
        @JavascriptInterface
        public void speak(String text, String lang, float speed, float pitch) {
            main.post(() -> {
                if (tts == null) return;
                Locale loc = Locale.forLanguageTag(lang == null ? "hi-IN" : lang);
                if (tts.isLanguageAvailable(loc) >= TextToSpeech.LANG_AVAILABLE) tts.setLanguage(loc);
                else tts.setLanguage(Locale.getDefault());
                tts.setSpeechRate(speed <= 0 ? 1f : speed);
                tts.setPitch(pitch <= 0 ? 1f : pitch);
                tts.speak(text == null ? "" : text.replaceAll("[*_#]", ""), TextToSpeech.QUEUE_FLUSH,
                        null, "ronny");
            });
        }

        @JavascriptInterface
        public void stopSpeak() { main.post(() -> { if (tts != null) tts.stop(); }); }

        // ---------- STT (push-to-talk) ----------
        @JavascriptInterface
        public void startListening(final String lang) {
            main.post(() -> {
                try {
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO)
                            != PackageManager.PERMISSION_GRANTED) {
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, 103);
                        js("onSttResult('', 'Mic permission chahiye — Settings mein allow karein.')");
                        return;
                    }
                    if (recognizer != null) recognizer.destroy();
                    recognizer = SpeechRecognizer.createSpeechRecognizer(MainActivity.this);
                    recognizer.setRecognitionListener(new RecognitionListener() {
                        @Override public void onResults(Bundle results) {
                            ArrayList<String> r = results != null ?
                                    results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) : null;
                            String text = (r != null && !r.isEmpty()) ? r.get(0) : "";
                            js("onSttResult(" + q(text) + ")");
                        }
                        @Override public void onPartialResults(Bundle partial) {
                            ArrayList<String> r = partial != null ?
                                    partial.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) : null;
                            if (r != null && !r.isEmpty()) js("onSttPartial(" + q(r.get(0)) + ")");
                        }
                        @Override public void onError(int error) {
                            js("onSttResult('', 'Voice error (" + error + ") — phir se try karein.')");
                        }
                        @Override public void onReadyForSpeech(Bundle params) {}
                        @Override public void onBeginningOfSpeech() {}
                        @Override public void onRmsChanged(float rmsdB) {}
                        @Override public void onBufferReceived(byte[] buffer) {}
                        @Override public void onEndOfSpeech() {}
                        @Override public void onEvent(int eventType, Bundle params) {}
                    });
                    Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                            RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang == null ? "hi-IN" : lang);
                    intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3);
                    recognizer.startListening(intent);
                    js("onSttState('listening')");
                } catch (Exception e) {
                    js("onSttResult('', " + q("Voice fail: " + e.getMessage()) + ")");
                }
            });
        }

        @JavascriptInterface
        public void stopListening() {
            main.post(() -> {
                if (recognizer != null) recognizer.stopListening();
                js("onSttState('idle')");
            });
        }

        // ---------- Location ----------
        @JavascriptInterface
        public String getLocation() {
            try {
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)
                        != PackageManager.PERMISSION_GRANTED) return "";
                LocationManager lm = (LocationManager) getSystemService(Context.LOCATION_SERVICE);
                android.location.Location loc = null;
                try { loc = lm.getLastKnownLocation(LocationManager.GPS_PROVIDER); } catch (Exception ignored) {}
                if (loc == null) {
                    try { loc = lm.getLastKnownLocation(LocationManager.NETWORK_PROVIDER); } catch (Exception ignored) {}
                }
                if (loc == null) return "";
                return loc.getLatitude() + "," + loc.getLongitude();
            } catch (Exception e) { return ""; }
        }

        // ---------- WhatsApp / SMS / Call (hamesha user-approved) ----------
        @JavascriptInterface
        public String whatsappTo(String number, String message) {
            try {
                String n = number == null ? "" : number.replaceAll("[^0-9]", "");
                Intent i;
                if (n.length() >= 10) {
                    i = new Intent(Intent.ACTION_VIEW,
                            Uri.parse("https://wa.me/" + n + "?text=" + Uri.encode(message)));
                } else {
                    i = new Intent(Intent.ACTION_SEND);
                    i.setType("text/plain");
                    i.setPackage("com.whatsapp");
                    i.putExtra(Intent.EXTRA_TEXT, message);
                }
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
                return "✅ WhatsApp khul raha hai — *Send* aap dabayein (silent send nahi hota).";
            } catch (Exception e) {
                try {
                    Intent i = new Intent(Intent.ACTION_SEND);
                    i.setType("text/plain");
                    i.putExtra(Intent.EXTRA_TEXT, message);
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(Intent.createChooser(i, "Share message via"));
                    return "✅ Share chooser khul raha hai — app chunein.";
                } catch (Exception e2) { return "❌ " + e2.getMessage(); }
            }
        }

        @JavascriptInterface
        public String sendSmsViaApp(String number, String message) {
            try {
                Intent i = new Intent(Intent.ACTION_SENDTO,
                        Uri.parse("smsto:" + (number == null ? "" : number.replaceAll("[^0-9+]", ""))));
                i.putExtra("sms_body", message);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
                return "✅ SMS app khul raha hai — message ready hai. *Send* aap confirm karein.";
            } catch (Exception e) { return "❌ " + e.getMessage(); }
        }

        @JavascriptInterface
        public String sendSmsDirect(String number, String message) {
            try {
                if (checkSelfPermission(Manifest.permission.SEND_SMS)
                        != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.SEND_SMS}, 104);
                    return "⚠️ SMS permission chahiye — pehle SMS-app mode use karein.";
                }
                SmsManager.getDefault().sendTextMessage(number, null, message, null, null);
                return "✅ SMS carrier ko submit ho gaya (delivery confirm nahi hoti — honest status).";
            } catch (Exception e) { return "❌ SMS fail: " + e.getMessage(); }
        }

        @JavascriptInterface
        public String dial(String number) {
            try {
                Intent i = new Intent(Intent.ACTION_DIAL,
                        Uri.parse("tel:" + (number == null ? "" : number.replaceAll("[^0-9+]", ""))));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
                return "✅ Dialer khul raha hai — call button aap dabayein (auto-call nahi).";
            } catch (Exception e) { return "❌ " + e.getMessage(); }
        }

        // ---------- Reminders (real AlarmManager + notification) ----------
        @JavascriptInterface
        public void addReminder(long id, String title, long timeMillis) {
            try {
                Intent i = new Intent(this == null ? null : MainActivity.this, ReminderReceiver.class);
                i.putExtra("title", title);
                i.putExtra("id", (int) id);
                PendingIntent pi = PendingIntent.getBroadcast(MainActivity.this, (int) id, i,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
                am.set(AlarmManager.RTC_WAKEUP, timeMillis, pi);
                js("onReminderResult('✅ Reminder set: " + q(title) + " (real alarm)')");
            } catch (Exception e) {
                js("onReminderResult('❌ " + q(e.getMessage()) + "')");
            }
        }

        @JavascriptInterface
        public void cancelReminder(long id) {
            try {
                Intent i = new Intent(MainActivity.this, ReminderReceiver.class);
                PendingIntent pi = PendingIntent.getBroadcast(MainActivity.this, (int) id, i,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
                am.cancel(pi);
            } catch (Exception ignored) {}
        }

        // ---------- FREE KEYLESS AI (koi API key nahi chahiye) ----------
        // Chain: Pollinations AI -> Wikipedia (hi/en) -> DuckDuckGo -> offline (JS side)
        @JavascriptInterface
        public void aiChat(final String json) {
            new Thread(() -> {
                String out;
                try {
                    JSONObject req = new JSONObject(json);
                    out = aiChain(
                        req.optString("question", ""),
                        req.optJSONArray("history"),
                        req.optString("persona", "Friendly"),
                        req.optString("term", "")
                    );
                } catch (Exception e) {
                    out = jerr("Internal error");
                }
                final String r = out;
                js("onAiResult(" + q(r) + ")");
            }).start();
        }

        // ---------- Real weather (Open-Meteo — free, no key) ----------
        @JavascriptInterface
        public String weather(final String city) {
            try {
                String lat = null, lon = null, place = (city == null ? "" : city.trim());
                if (place.length() > 0) {
                    String g = httpGet("https://geocoding-api.open-meteo.com/v1/search?name="
                            + Uri.encode(place) + "&count=1&language=hi&format=json", 8000);
                    JSONArray res = new JSONObject(g).optJSONArray("results");
                    if (res != null && res.length() > 0) {
                        JSONObject r0 = res.getJSONObject(0);
                        lat = r0.getString("latitude");
                        lon = r0.getString("longitude");
                        place = r0.optString("name", place);
                    }
                } else {
                    String loc = getLocation();
                    if (loc != null && loc.contains(",")) {
                        String[] p = loc.split(",");
                        lat = p[0]; lon = p[1]; place = "Aapki location";
                    }
                }
                if (lat == null) return "⚠️ City samajh nahi aayi — aisa likhein: \"weather Patna\"";
                String w = httpGet("https://api.open-meteo.com/v1/forecast?latitude=" + lat
                        + "&longitude=" + lon
                        + "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto", 8000);
                JSONObject cur = new JSONObject(w).getJSONObject("current");
                return "🌦️ " + place + " ka mausam:\n"
                        + weatherDesc(cur.getInt("weather_code"))
                        + "\n🌡 Temp: " + cur.getDouble("temperature_2m") + "°C (feels like "
                        + cur.getDouble("apparent_temperature") + "°C)"
                        + "\n💧 Humidity: " + cur.getDouble("relative_humidity_2m") + "%"
                        + "\n🌬 Wind: " + cur.getDouble("wind_speed_10m") + " km/h"
                        + "\n\n(Source: Open-Meteo — free, no key)";
            } catch (Exception e) {
                return "⚠️ Weather nahi mil paya — internet check karein aur phir try karein.";
            }
        }

        // ---------- Web search (har sawal ka jawab guarantee) ----------
        @JavascriptInterface
        public String searchWeb(String query) {
            return openUrl("https://www.google.com/search?q=" + Uri.encode(query == null ? "" : query));
        }
    }

    // ================= FREE KEYLESS AI CHAIN =================
    private String aiChain(String question, JSONArray history, String persona, String term) {
        // 1) Pollinations AI — free, no API key (chat mode)
        try {
            JSONArray msgs = new JSONArray();
            msgs.put(kv("role", "system", "content",
                "You are Ronny, a friendly futuristic personal AI assistant. Answer in the same " +
                "language as the question (Hindi, English, or Hinglish). Personality: " + persona +
                ". Be accurate, helpful and concise. Answer EVERY question."));
            if (history != null) {
                for (int i = Math.max(0, history.length() - 10); i < history.length(); i++) {
                    JSONObject m = history.getJSONObject(i);
                    msgs.put(kv("role", m.optString("role", "user"),
                        "content", m.optString("content", "")));
                }
            }
            msgs.put(kv("role", "user", "content", question));
            JSONObject body = new JSONObject();
            body.put("model", "openai");
            body.put("messages", msgs);
            String resp = httpPostJson("https://text.pollinations.ai/openai", body.toString(), 25000);
            JSONArray ch = new JSONObject(resp).optJSONArray("choices");
            if (ch != null && ch.length() > 0) {
                String text = ch.getJSONObject(0).optJSONObject("message")
                    .optString("content", "").trim();
                if (!text.isEmpty() && !text.startsWith("<") && !text.startsWith("{\"error\""))
                    return jok(text, "Pollinations AI ✨");
            }
        } catch (Exception ignored) {}

        // 2) Pollinations AI — simple GET mode
        try {
            String prompt = "Answer briefly in the same language (Hindi/English/Hinglish): " + question;
            String text = httpGet("https://text.pollinations.ai/" + Uri.encode(prompt)
                + "?model=openai&referrer=ronny-ai", 18000).trim();
            if (!text.isEmpty() && !text.startsWith("<") && !text.startsWith("{\"error\""))
                return jok(text, "Pollinations AI ✨");
        } catch (Exception ignored) {}

        // 3) Wikipedia (Hindi + English) — free encyclopedia
        String t = extractTerm((term == null || term.isEmpty()) ? question : term);
        if (!t.isEmpty()) {
            for (String lang : new String[]{"hi", "en"}) {
                try {
                    String s = httpGet("https://" + lang + ".wikipedia.org/api/rest_v1/page/summary/"
                        + Uri.encode(t), 7000);
                    String extract = new JSONObject(s).optString("extract", "").trim();
                    if (!extract.isEmpty())
                        return jok(extract + "\n\n📖 Source: " + lang + ".wikipedia.org", "Wikipedia 📖");
                } catch (Exception ignored) {}
            }
            try { // search fallback
                String s = httpGet("https://en.wikipedia.org/w/api.php?action=opensearch&search="
                    + Uri.encode(t) + "&limit=1&format=json", 7000);
                JSONArray arr = new JSONArray(s);
                if (arr.length() >= 4 && arr.getJSONArray(3).length() > 0) {
                    String title = arr.getJSONArray(1).getString(0);
                    String s2 = httpGet("https://en.wikipedia.org/api/rest_v1/page/summary/"
                        + Uri.encode(title), 7000);
                    String extract = new JSONObject(s2).optString("extract", "").trim();
                    if (!extract.isEmpty())
                        return jok(extract + "\n\n📖 Source: Wikipedia (" + title + ")", "Wikipedia 📖");
                }
            } catch (Exception ignored) {}
        }

        // 4) DuckDuckGo instant answers — free, no key
        try {
            String s = httpGet("https://api.duckduckgo.com/?q=" + Uri.encode(question)
                + "&format=json&no_html=1&skip_disambig=1", 8000);
            JSONObject r = new JSONObject(s);
            String ans = r.optString("AbstractText", "").trim();
            if (ans.isEmpty()) ans = r.optString("Answer", "").trim();
            if (ans.isEmpty()) {
                JSONArray rel = r.optJSONArray("RelatedTopics");
                if (rel != null && rel.length() > 0)
                    ans = rel.getJSONObject(0).optString("Text", "").trim();
            }
            if (!ans.isEmpty())
                return jok(ans + "\n\n🔎 Source: DuckDuckGo", "DuckDuckGo 🔎");
        } catch (Exception ignored) {}

        return jerr("offline");  // JS side: offline KB + web search button
    }

    // ---------- HTTP helpers ----------
    private String httpGet(String urlStr, int timeoutMs) throws Exception {
        HttpURLConnection con = (HttpURLConnection) new URL(urlStr).openConnection();
        con.setRequestMethod("GET");
        con.setConnectTimeout(timeoutMs);
        con.setReadTimeout(timeoutMs);
        con.setRequestProperty("User-Agent", "RonnyAI/1.1");
        int code = con.getResponseCode();
        BufferedReader br = new BufferedReader(new InputStreamReader(
            code < 400 ? con.getInputStream() : con.getErrorStream(), "UTF-8"));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) sb.append(line);
        br.close();
        if (code >= 400) throw new Exception("HTTP " + code);
        return sb.toString();
    }

    private String httpPostJson(String urlStr, String json, int timeoutMs) throws Exception {
        HttpURLConnection con = (HttpURLConnection) new URL(urlStr).openConnection();
        con.setRequestMethod("POST");
        con.setRequestProperty("Content-Type", "application/json");
        con.setRequestProperty("User-Agent", "RonnyAI/1.1");
        con.setConnectTimeout(timeoutMs);
        con.setReadTimeout(timeoutMs);
        con.setDoOutput(true);
        OutputStream os = con.getOutputStream();
        os.write(json.getBytes(Charset.forName("UTF-8")));
        os.close();
        int code = con.getResponseCode();
        BufferedReader br = new BufferedReader(new InputStreamReader(
            code < 400 ? con.getInputStream() : con.getErrorStream(), "UTF-8"));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) sb.append(line);
        br.close();
        if (code >= 400) throw new Exception("HTTP " + code);
        return sb.toString();
    }

    // ---------- Small JSON helpers ----------
    private static JSONObject kv(String k1, String v1, String k2, String v2) {
        JSONObject j = new JSONObject();
        try { j.put(k1, v1); j.put(k2, v2); } catch (Exception ignored) {}
        return j;
    }

    private static String jok(String text, String source) {
        try {
            return new JSONObject().put("ok", true).put("text", text)
                .put("source", source).toString();
        } catch (Exception e) { return "{\"ok\":true,\"text\":\"\"}"; }
    }

    private static String jerr(String err) {
        try {
            return new JSONObject().put("ok", false).put("err", err).toString();
        } catch (Exception e) { return "{\"ok\":false}"; }
    }

    // Question -> wiki search term
    private static String extractTerm(String q) {
        String t = q.replaceAll("(?i)(kya hai|kya h\\b|kaun hai|kaun h\\b|kisne banaya|kaise kare\\w*|kaise hai|kya hota hai|batao|tell me about|what is|who is|why is|how is|explain|define|meaning of|matlab|ke baare mein|about)", " ");
        t = t.replaceAll("(?i)\\b(the|a|an|is|are|was|were|of|in|on|to|for|me|my|please|yaar|bhai|kripya|mujhe|hum|mai|main|ye|yah|wo|wah|ka|ki|ke|ko|se|par|mein|hai|hain|ho|kya|kaun|kaise|kyu|kyon|bata|do|re|ra|ho|ga|gi)\\b", " ");
        t = t.replaceAll("[?!.,]", " ").replaceAll("\\s+", " ").trim();
        if (t.length() > 60) t = t.substring(0, 60).trim();
        if (t.length() > 0) t = Character.toUpperCase(t.charAt(0)) + t.substring(1);
        return t;
    }

    private static String weatherDesc(int c) {
        if (c == 0) return "Clear sky ☀️";
        if (c <= 3) return "Partly cloudy ⛅";
        if (c <= 48) return "Foggy 🌫";
        if (c <= 57) return "Drizzle 🌦";
        if (c <= 67) return "Rain 🌧";
        if (c <= 77) return "Snow ❄️";
        if (c <= 82) return "Rain showers 🌦";
        if (c <= 86) return "Snow showers 🌨";
        return "Thunderstorm ⛈";
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (tts != null) { tts.shutdown(); tts = null; }
        if (recognizer != null) { recognizer.destroy(); recognizer = null; }
    }
}

// ================= Reminder receiver (real notification) =================
class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String title = intent != null ? intent.getStringExtra("title") : "Reminder";
        int id = intent != null ? intent.getIntExtra("id", 0) : 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel("reminders", "Reminders",
                    NotificationManager.IMPORTANCE_HIGH);
            context.getSystemService(NotificationManager.class).createNotificationChannel(ch);
        }
        android.app.Notification.Builder nb = new android.app.Notification.Builder(context, "reminders")
                .setSmallIcon(android.R.drawable.ic_popup_reminder)
                .setContentTitle("⏰ Reminder — Ronny AI")
                .setContentText(title == null ? "Reminder" : title)
                .setAutoCancel(true);
        try {
            context.getSystemService(NotificationManager.class).notify(id, nb.build());
        } catch (Exception ignored) {}
    }
}
