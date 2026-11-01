package com.ronny.assistant;

import android.Manifest;
import android.app.*;
import android.animation.ValueAnimator;
import android.content.*;
import android.content.pm.*;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.hardware.camera2.CameraCharacteristics;
import android.hardware.camera2.CameraManager;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.media.AudioManager;
import android.text.util.Linkify;
import android.util.Log;
import android.os.*;
import android.provider.AlarmClock;
import android.provider.MediaStore;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.text.InputType;
import android.view.*;
import android.widget.*;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.DateFormat;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.*;

public class MainActivity extends Activity {
    private static final int BG=0xff071324, PANEL=0xff10263a, CYAN=0xff56dfef, TEXT=0xffe9f7fa, MUTED=0xff91b4c4;
    private static final int VOICE=101, CAMERA_PERMISSION=102, NOTIFICATION_PERMISSION=103;
    private LinearLayout root, content, chat;
    private ScrollView scroll;
    private EditText input;
    private TextView status;
    private TextToSpeech tts;
    private ValueAnimator orbAnimator;
    private boolean ttsReady=false, busy=false, pendingTorch=false;
    private boolean voiceConversation=false, recognizerOpen=false, pendingListen=false, foreground=false;
    private String conversationUtterance="";
    private long utteranceNumber=0;
    private String lastAnswer="", page="Assistant";
    private JSONArray history=new JSONArray();
    private final ExecutorService executor=Executors.newSingleThreadExecutor();
    private android.content.SharedPreferences settings, data;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        settings=getSharedPreferences("settings",0); data=getSharedPreferences("data",0);
        try { history=new JSONArray(data.getString("history","[]")); for(int i=history.length()-1;i>=0;i--){JSONObject message=history.optJSONObject(i);if(message!=null && "assistant".equals(message.optString("role"))){lastAnswer=message.optString("content");break;}} } catch (Exception ignored) {}
        tts=new TextToSpeech(this, result -> {
            ttsReady=result==TextToSpeech.SUCCESS;
            if(ttsReady){
                configureVoice();
                tts.setOnUtteranceProgressListener(new UtteranceProgressListener(){
                    @Override public void onStart(String id){}
                    @Override public void onDone(String id){runOnUiThread(()->{if(voiceConversation && id.equals(conversationUtterance)){conversationUtterance="";pendingListen=true;maybeListen();}});}
                    @Override public void onError(String id){runOnUiThread(()->{if(voiceConversation && id.equals(conversationUtterance)){stopConversation();toast("Speech failed; voice conversation stopped.");}});}
                });
            }
        });
        showHome();
    }
    private int dp(float n){ return (int)(n*getResources().getDisplayMetrics().density+0.5f); }
    private GradientDrawable shape(int color, int radius, int stroke) { GradientDrawable d=new GradientDrawable(); d.setColor(color); d.setCornerRadius(dp(radius)); if(stroke!=0)d.setStroke(dp(1),stroke); return d; }
    private TextView label(String text, int size, int color) { TextView v=new TextView(this); v.setText(text); v.setTextSize(size); v.setTextColor(color); return v; }
    private Button button(String text, Runnable action) { Button b=new Button(this); b.setText(text); b.setAllCaps(false); b.setTextColor(TEXT); b.setTextSize(14); b.setBackground(shape(PANEL,12,0xff28556b)); b.setPadding(dp(12),dp(8),dp(12),dp(8)); b.setOnClickListener(v->action.run()); return b; }
    private EditText field(String hint) { EditText e=new EditText(this); e.setTextColor(TEXT); e.setHintTextColor(MUTED); e.setTextSize(16); e.setHint(hint); e.setPadding(dp(14),dp(10),dp(14),dp(10)); e.setBackground(shape(PANEL,12,0xff28556b)); return e; }
    private void addGap(LinearLayout l, int h) { View v=new View(this); l.addView(v,new LinearLayout.LayoutParams(1,dp(h))); }
    private void rowButton(LinearLayout row,String name,Runnable action){ LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,dp(48),1); p.setMargins(dp(3),0,dp(3),0); row.addView(button(name,action),p); }
    private LinearLayout row(){ LinearLayout l=new LinearLayout(this); l.setOrientation(LinearLayout.HORIZONTAL); return l; }
    private void navButton(LinearLayout row,String name,Runnable action){LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(dp(105),dp(48));p.setMargins(0,0,dp(6),0);row.addView(button(name,action),p);}
    private void setup(String title) {
        if(orbAnimator!=null){orbAnimator.cancel();orbAnimator=null;}
        if(!title.equals("Assistant") && voiceConversation)stopConversation();
        page=title; root=new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(dp(16),dp(12),dp(16),dp(10)); root.setBackgroundColor(BG); setContentView(root);
        TextView brand=label("◉  RONNY AI",20,CYAN); brand.setTypeface(null,Typeface.BOLD); root.addView(brand);
        TextView subtitle=label(title.toUpperCase(Locale.ROOT),11,MUTED); subtitle.setLetterSpacing(.18f); root.addView(subtitle); addGap(root,10);
        LinearLayout nav=row(); navButton(nav,"Assistant",this::showHome); navButton(nav,"Reminders",this::showReminders); navButton(nav,"Tasks",this::showTasks); navButton(nav,"Notes",this::showNotes); navButton(nav,"Settings",this::showSettings); HorizontalScrollView navScroll=new HorizontalScrollView(this);navScroll.setHorizontalScrollBarEnabled(true);navScroll.addView(nav);root.addView(navScroll);TextView navHint=label("Swipe menu for more →",11,MUTED);navHint.setGravity(Gravity.RIGHT);root.addView(navHint);addGap(root,6);
        scroll=new ScrollView(this); scroll.setFillViewport(false); content=new LinearLayout(this); content.setOrientation(LinearLayout.VERTICAL); scroll.addView(content); root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
    }
    private void showHome() {
        setup("Assistant");
        TextView orb=label("◎",64,CYAN); orb.setGravity(Gravity.CENTER); content.addView(orb);
        orbAnimator=ValueAnimator.ofFloat(0f,1f);orbAnimator.setDuration(1800);orbAnimator.setRepeatCount(ValueAnimator.INFINITE);orbAnimator.setRepeatMode(ValueAnimator.REVERSE);orbAnimator.addUpdateListener(a->{float t=(Float)a.getAnimatedValue();orb.setScaleX(.94f+.06f*t);orb.setScaleY(.94f+.06f*t);orb.setAlpha(.8f+.2f*t);});orbAnimator.start();if(!foreground)orbAnimator.pause();
        status=label(statusText(),13,MUTED); status.setGravity(Gravity.CENTER); content.addView(status); addGap(content,8);
        LinearLayout quick=row(); rowButton(quick,"Battery",()->submit("battery")); rowButton(quick,"Time",()->submit("time")); rowButton(quick,"Apps",this::showApps); rowButton(quick,"Search",this::searchDialog); content.addView(quick); addGap(content,12);
        TextView heading=label("CONVERSATION",12,MUTED); heading.setLetterSpacing(.14f); content.addView(heading); addGap(content,8);
        chat=new LinearLayout(this); chat.setOrientation(LinearLayout.VERTICAL); content.addView(chat);
        if(history.length()==0) bubble("RONNY", "Hello! I’m Ronny. Try ‘open camera’, ‘battery’, or configure an AI provider in Settings. Weather requests send your chosen city to Open-Meteo.");
        for(int i=0;i<history.length();i++){ JSONObject m=history.optJSONObject(i); if(m!=null) bubble(m.optString("role").equals("user")?"YOU":"RONNY",m.optString("content")); }
        LinearLayout actions=row(); navButton(actions,"🎙 Speak",this::listen);navButton(actions,"Conversation",this::startConversation);navButton(actions,"Stop voice",this::stopConversation);navButton(actions,"Repeat",()->{stopConversation();if(!lastAnswer.isEmpty())speak(lastAnswer);else toast("No answer to repeat yet");});HorizontalScrollView voiceScroll=new HorizontalScrollView(this);voiceScroll.setHorizontalScrollBarEnabled(true);voiceScroll.addView(actions);root.addView(voiceScroll);addGap(root,8);
        LinearLayout compose=row(); input=field("Ask or give a command…"); input.setSingleLine(false); compose.addView(input,new LinearLayout.LayoutParams(0,dp(52),1)); LinearLayout.LayoutParams sendParams=new LinearLayout.LayoutParams(dp(70),dp(52)); sendParams.setMargins(dp(8),0,0,0); compose.addView(button("Send",()->{String text=input.getText().toString().trim(); if(!text.isEmpty()){input.setText("");submit(text);}}),sendParams); root.addView(compose);
        scroll.post(()->scroll.fullScroll(View.FOCUS_DOWN));
    }
    private void bubble(String who,String text){ TextView v=label(who+"\n"+text,15,TEXT); v.setPadding(dp(14),dp(10),dp(14),dp(10)); v.setBackground(shape(who.equals("YOU")?0xff173d50:PANEL,14,0));v.setLinkTextColor(CYAN);Linkify.addLinks(v,Linkify.WEB_URLS); LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2); p.bottomMargin=dp(8); chat.addView(v,p); }
    private String statusText(){if(busy)return "Thinking…";return networkStatus()+(voiceConversation?"  •  Voice conversation on":"  •  Tap mic to speak");}
    private void refreshStatus(){if(status!=null && page.equals("Assistant"))status.setText(statusText());}
    private String networkStatus(){ ConnectivityManager cm=(ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE); NetworkCapabilities n=cm.getNetworkCapabilities(cm.getActiveNetwork()); return n!=null && n.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)?"Online":"Offline / unverified"; }
    private void toast(String text){Toast.makeText(this,text,Toast.LENGTH_LONG).show();}
    private void addMessage(String role,String text){try{history.put(new JSONObject().put("role",role).put("content",text)); while(history.length()>100)history.remove(0); data.edit().putString("history",history.toString()).apply();}catch(Exception ignored){} if(page.equals("Assistant") && chat!=null){bubble(role.equals("user")?"YOU":"RONNY",text);scroll.post(()->scroll.fullScroll(View.FOCUS_DOWN));}}
    private void answer(String text,boolean voice){lastAnswer=text;addMessage("assistant",text);if(voice && settings.getBoolean("speak",true))speak(text);else if(voiceConversation)stopConversation();}
    private void submit(String text){
        if(busy){toast("Please wait for the current response.");return;}
        addMessage("user",text);
        String city=WeatherCommand.city(text);
        if(city!=null){requestWeather(city);return;}
        String local=localCommand(text);
        if(local!=null){answer(local,true);return;}
        busy=true;refreshStatus();
        final JSONArray context; try { context=new JSONArray(history.toString()); }catch(Exception e){busy=false;answer("Could not read conversation history.",false);return;}
        String memory=data.getString("memory","");
        executor.execute(()->{String result; boolean success; try{result=AiClient.ask(getApplicationContext(),context,memory);success=true;}catch(Exception e){result=e.getMessage();success=false;} final String reply=result; final boolean ok=success; runOnUiThread(()->{ if(isFinishing()||isDestroyed())return; busy=false;refreshStatus();answer(reply,ok);});});
    }
    private void requestWeather(String city){
        busy=true;refreshStatus();
        executor.execute(()->{String result;boolean ok;try{result=WeatherClient.fetch(city);ok=true;}catch(Exception e){result="Weather unavailable: "+(e.getMessage()==null?"network or service error":e.getMessage())+".";ok=false;}final String reply=result;final boolean success=ok;runOnUiThread(()->{if(isFinishing()||isDestroyed())return;busy=false;refreshStatus();answer(reply,success);});});
    }
    private String localCommand(String original){
        String s=original.toLowerCase(Locale.ROOT).trim().replaceAll("^[, ]*(hey |hello |ok )?ronny[, ]*","").trim();
        if(s.matches("(hi|hello|hello ronny|namaste|नमस्ते)[!. ]*"))return "Hello! I am Ronny, your personal assistant. How can I help?";
        if(s.matches(".*(battery|बैटरी).*(percentage|level|status|kitn|kya|है|%|$).*")) { Intent b=registerReceiver(null,new IntentFilter(Intent.ACTION_BATTERY_CHANGED)); if(b==null)return "Battery information is unavailable."; int level=b.getIntExtra(BatteryManager.EXTRA_LEVEL,-1),scale=b.getIntExtra(BatteryManager.EXTRA_SCALE,-1);return level>=0&&scale>0?"Battery: "+(level*100/scale)+"%.":"Battery level unavailable."; }
        if(s.matches("(time|date|date and time|current time|what time is it|samay|समय|तारीख|aaj ki date)[?. ]*"))return DateFormat.getDateTimeInstance(DateFormat.FULL,DateFormat.SHORT).format(new Date());
        if(s.equals("device info")||s.equals("device information"))return "Device: "+Build.MANUFACTURER+" "+Build.MODEL+"; Android "+Build.VERSION.RELEASE+".";
        if(s.equals("storage")||s.equals("available storage")){android.os.StatFs fs=new android.os.StatFs(getFilesDir().getAbsolutePath());return "Available internal storage: "+android.text.format.Formatter.formatFileSize(this,fs.getAvailableBytes())+".";}
        if(s.equals("internet status")||s.equals("network status"))return networkStatus()+".";
        if(s.equals("weather")||s.equals("mausam")||s.equals("aaj ka mausam kaisa hai")||s.equals("मौसम"))return "Please specify a city, for example: weather in Bhagalpur. Your city will be sent to Open-Meteo.";
        if(s.equals("volume up")||s.equals("volume down")){try{AudioManager audio=(AudioManager)getSystemService(AUDIO_SERVICE);audio.adjustStreamVolume(AudioManager.STREAM_MUSIC,s.equals("volume up")?AudioManager.ADJUST_RAISE:AudioManager.ADJUST_LOWER,AudioManager.FLAG_SHOW_UI);return "Requested media volume "+(s.equals("volume up")?"up":"down")+".";}catch(Exception e){return "Could not adjust media volume on this device.";}}
        if(s.equals("flashlight on")||s.equals("torch on"))return setTorch(true);
        if(s.equals("flashlight off")||s.equals("torch off"))return setTorch(false);
        if(s.equals("wifi settings")||s.equals("wi-fi settings"))return openIntent(new Intent(Settings.ACTION_WIFI_SETTINGS),"Wi-Fi settings");
        if(s.equals("bluetooth settings"))return openIntent(new Intent(Settings.ACTION_BLUETOOTH_SETTINGS),"Bluetooth settings");
        if(s.equals("location settings"))return openIntent(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS),"location settings");
        if(s.equals("display settings"))return openIntent(new Intent(Settings.ACTION_DISPLAY_SETTINGS),"display settings");
        if(s.equals("set alarm")||s.equals("alarm"))return openIntent(new Intent(AlarmClock.ACTION_SET_ALARM),"alarm app");
        if(ReminderParser.looksLikeReminder(s)) {
            ReminderParser.Result reminder=ReminderParser.parse(s,Calendar.getInstance());
            if(reminder==null)return "I couldn't safely understand that reminder. Try ‘remind me to run tomorrow at 6 am’ or ‘kal subah 6 baje running ke liye yaad dilana’. You can also use the Reminders screen.";
            try {
                Reminders.add(this,reminder.text,reminder.time,reminder.daily);
                if(Build.VERSION.SDK_INT>=33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFICATION_PERMISSION);
                return "Reminder scheduled for "+DateFormat.getDateTimeInstance(DateFormat.MEDIUM,DateFormat.SHORT).format(new Date(reminder.time))+": "+reminder.text+(reminder.daily?" (daily).":".")+" Delivery is approximate.";
            } catch(Exception e){return "Could not schedule the reminder.";}
        }
        if(s.equals("installed apps")||s.equals("list apps")){showApps();return "Showing launchable apps.";}
        if(s.startsWith("convert ")){Matcher conversion=Pattern.compile("^convert\\s+(-?\\d+(?:\\.\\d+)?)\\s*([a-z]+)\\s+to\\s+([a-z]+)[?.! ]*$").matcher(s);if(!conversion.matches())return "Try: convert 10 km to miles.";try{double value=UnitConverter.convert(Double.parseDouble(conversion.group(1)),conversion.group(2),conversion.group(3));return "Result: "+value+" "+conversion.group(3)+".";}catch(IllegalArgumentException e){return "Could not convert: "+e.getMessage()+".";}}
        boolean explicitCalc=s.startsWith("calculate ")||s.startsWith("calc ");
        boolean arithmetic=s.matches("[0-9 .()+*/×÷^%\\-]+")&&s.matches(".*[+*/×÷^%\\-].*");
        if(explicitCalc||arithmetic){String expression=explicitCalc?s.substring(s.indexOf(' ')+1).trim():s;try{double value=Calculator.evaluate(expression);return "Result: "+value;}catch(IllegalArgumentException e){return "Could not calculate: "+e.getMessage()+".";}}
        Matcher search=Pattern.compile("^(?:search (?:for )?|google )(.*)$").matcher(s);if(search.matches()&&!search.group(1).trim().isEmpty()){return webSearch(search.group(1).trim());}
        Matcher app=Pattern.compile("^(?:open|launch)\\s+(.+?)(?:\\s+(?:app|application))?[.! ]*$").matcher(s);
        if(app.matches())return launchApp(app.group(1).trim());
        app=Pattern.compile("^(.+?)\\s+(?:kholo|open karo|khol do|खोलो)[.! ]*$").matcher(s);
        if(app.matches())return launchApp(app.group(1).trim());
        return null;
    }
    private String openIntent(Intent intent,String name){if(voiceConversation)stopConversation();try{startActivity(intent);return "Opened "+name+".";}catch(Exception e){return "Could not open "+name+" on this device.";}}
    private String webSearch(String query){return openIntent(new Intent(Intent.ACTION_VIEW,Uri.parse("https://www.google.com/search?q="+Uri.encode(query))),"web search for “"+query+"”");}
    private String launchApp(String name){
        switch(name){
            case "यूट्यूब": name="youtube";break;
            case "सेटिंग": case "सेटिंग्स": name="settings";break;
            case "कैमरा": name="camera";break;
            case "फोन": name="phone";break;
            case "गैलरी": name="gallery";break;
            case "क्रोम": name="chrome";break;
            case "मैप्स": name="maps";break;
            case "व्हाट्सएप": name="whatsapp";break;
            case "इंस्टाग्राम": name="instagram";break;
        }
        if(name.equals("settings"))return openIntent(new Intent(Settings.ACTION_SETTINGS),"settings");
        if(name.equals("camera"))return openIntent(new Intent(MediaStore.INTENT_ACTION_STILL_IMAGE_CAMERA),"camera");
        if(name.equals("phone"))return openIntent(new Intent(Intent.ACTION_DIAL),"phone");
        if(name.equals("messages"))return openIntent(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_APP_MESSAGING),"messages");
        if(name.equals("gallery"))return openIntent(new Intent(Intent.ACTION_VIEW).setType("image/*"),"gallery");
        PackageManager pm=getPackageManager(); Intent query=new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        List<ResolveInfo> apps=pm.queryIntentActivities(query,0); ResolveInfo match=null;
        for(ResolveInfo a:apps){String label=a.loadLabel(pm).toString();if(label.equalsIgnoreCase(name)){match=a;break;}}
        if(match==null){for(ResolveInfo a:apps){String label=a.loadLabel(pm).toString().toLowerCase(Locale.ROOT);if(label.contains(name.toLowerCase(Locale.ROOT))){if(match!=null)return "More than one app matches “"+name+"”. Please use its full name.";match=a;}}}
        if(match==null)return "I couldn't find a launchable app named “"+name+"”.";
        Intent launch=new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setClassName(match.activityInfo.packageName,match.activityInfo.name);
        return openIntent(launch,match.loadLabel(pm).toString());
    }
    private String setTorch(boolean on){
        if(checkSelfPermission(Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED){pendingTorch=on;requestPermissions(new String[]{Manifest.permission.CAMERA},CAMERA_PERMISSION);return "Camera permission is needed to control the flashlight. Please respond to the permission request.";}
        try{CameraManager m=(CameraManager)getSystemService(CAMERA_SERVICE);for(String id:m.getCameraIdList()){Boolean flash=m.getCameraCharacteristics(id).get(CameraCharacteristics.FLASH_INFO_AVAILABLE);if(Boolean.TRUE.equals(flash)){m.setTorchMode(id,on);return "Flashlight "+(on?"on":"off")+".";}}return "No flashlight is available on this device.";}catch(Exception e){return "Could not change the flashlight: "+e.getClass().getSimpleName()+".";}
    }
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==CAMERA_PERMISSION){if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)answer(setTorch(pendingTorch),false);else toast("Camera permission denied; flashlight unavailable.");}if(request==NOTIFICATION_PERMISSION && (results.length==0||results[0]!=PackageManager.PERMISSION_GRANTED))toast("Notifications are disabled; reminder alerts may not appear.");}
    private void startConversation(){
        if(busy){toast("Wait for the current answer first.");return;}
        if(!ttsReady || !settings.getBoolean("speak",true)){toast("Enable spoken answers and wait for text-to-speech before starting conversation.");return;}
        if(voiceConversation){toast("Voice conversation is already on. Tap Stop voice to end it.");return;}
        new AlertDialog.Builder(this).setTitle("Start voice conversation?").setMessage("The device's speech service opens after each spoken answer. It may send audio to its provider. Tap Stop voice, cancel recognition, leave the app, or open another app to end the session. There is no background wake word.")
                .setNegativeButton("Cancel",null).setPositiveButton("Start",(d,w)->{voiceConversation=true;refreshStatus();listen();}).show();
    }
    private void stopConversation(){voiceConversation=false;pendingListen=false;conversationUtterance="";if(tts!=null)tts.stop();refreshStatus();}
    private void maybeListen(){if(voiceConversation && pendingListen && foreground && !recognizerOpen && !busy){pendingListen=false;listen();}}
    private void listen(){
        if(busy){toast("Wait for the current answer first.");return;}
        if(recognizerOpen)return;
        if(tts!=null)tts.stop();conversationUtterance="";
        try{Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,settings.getString("language","en-IN"));intent.putExtra(RecognizerIntent.EXTRA_PROMPT,voiceConversation?"RONNY conversation — cancel to stop":"Speak to Ronny");recognizerOpen=true;startActivityForResult(intent,VOICE);}catch(Exception e){recognizerOpen=false;stopConversation();toast("No speech recognition app is available on this device.");}
    }
    @Override protected void onActivityResult(int request,int result,Intent intent){
        super.onActivityResult(request,result,intent);
        if(request!=VOICE)return;
        recognizerOpen=false;
        ArrayList<String> words=result==RESULT_OK&&intent!=null?intent.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS):null;
        if(words==null||words.isEmpty()||words.get(0).trim().isEmpty()){if(voiceConversation)stopConversation();return;}
        submit(words.get(0));
    }
    private void configureVoice(){
        if(tts==null||!ttsReady)return;
        Locale language=Locale.forLanguageTag(settings.getString("language","en-IN"));tts.setLanguage(language);
        String selected=settings.getString("voiceName","");
        if(!selected.isEmpty() && tts.getVoices()!=null)for(Voice voice:tts.getVoices())if(voice.getName().equals(selected)&&voice.getLocale().getLanguage().equals(language.getLanguage())){tts.setVoice(voice);break;}
        tts.setSpeechRate(settings.getFloat("rate",1f));tts.setPitch(settings.getFloat("pitch",1f));
    }
    private void chooseVoice(){
        if(!ttsReady||tts==null){toast("Text-to-speech is not ready.");return;}
        Locale language=Locale.forLanguageTag(settings.getString("language","en-IN"));Set<Voice> available=tts.getVoices();ArrayList<Voice> voices=new ArrayList<>();
        if(available!=null)for(Voice voice:available)if(voice.getLocale().getLanguage().equals(language.getLanguage()))voices.add(voice);
        voices.sort((a,b)->a.getName().compareToIgnoreCase(b.getName()));
        if(voices.isEmpty()){toast("No selectable voices for this language are available.");return;}
        String[] labels=new String[voices.size()+1];labels[0]="Device default";for(int i=0;i<voices.size();i++){Voice v=voices.get(i);labels[i+1]=v.getName()+" • "+v.getLocale().toLanguageTag()+(v.isNetworkConnectionRequired()?" • network":"");}
        new AlertDialog.Builder(this).setTitle("Device voices").setItems(labels,(d,which)->{settings.edit().putString("voiceName",which==0?"":voices.get(which-1).getName()).apply();configureVoice();toast("Voice selected. Availability depends on the device speech engine.");}).setNegativeButton("Cancel",null).show();
    }
    private void speak(String text){
        if(!ttsReady||tts==null){if(voiceConversation)stopConversation();toast("Text-to-speech is not available yet.");return;}
        configureVoice();String id="ronny-"+(++utteranceNumber);conversationUtterance=voiceConversation?id:"";
        int limit=TextToSpeech.getMaxSpeechInputLength();String spoken=text;
        if(text.length()>limit){spoken=text.substring(0,limit-1);toast("Reading the beginning only; the full answer is in chat.");}
        if(tts.speak(spoken,TextToSpeech.QUEUE_FLUSH,null,id)==TextToSpeech.ERROR){if(voiceConversation)stopConversation();toast("Could not start speech.");}
    }
    @Override protected void onResume(){super.onResume();foreground=true;if(orbAnimator!=null)orbAnimator.resume();maybeListen();if(ReminderReceiver.notificationsEnabled(this))executor.execute(()->{try{Reminders.restore(getApplicationContext());}catch(Exception e){Log.e("RONNY","Could not restore reminders",e);}});}
    @Override protected void onPause(){foreground=false;if(orbAnimator!=null)orbAnimator.pause();super.onPause();}
    @Override protected void onStop(){if(voiceConversation && !recognizerOpen)stopConversation();super.onStop();}
    @Override public void onBackPressed(){if(!page.equals("Assistant"))showHome();else super.onBackPressed();}
    @Override protected void onDestroy(){if(orbAnimator!=null)orbAnimator.cancel();voiceConversation=false;pendingListen=false;if(tts!=null){tts.stop();tts.shutdown();}executor.shutdownNow();super.onDestroy();}
    private void showApps(){
        setup("Installed apps"); TextView intro=label("Tap a launchable app to open it. Android limits visibility to launcher apps.",14,MUTED);content.addView(intro);addGap(content,10);
        PackageManager pm=getPackageManager(); List<ResolveInfo> apps=pm.queryIntentActivities(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER),0);
        apps.sort((a,b)->a.loadLabel(pm).toString().compareToIgnoreCase(b.loadLabel(pm).toString()));
        for(ResolveInfo app:apps){String name=app.loadLabel(pm).toString();Button b=button(name,()->openIntent(new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setClassName(app.activityInfo.packageName,app.activityInfo.name),name));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,dp(48));p.bottomMargin=dp(5);content.addView(b,p);}
    }
    private void searchDialog(){EditText query=field("Search the web");new AlertDialog.Builder(this).setTitle("Web search").setView(query).setNegativeButton("Cancel",null).setPositiveButton("Search",(d,w)->{String q=query.getText().toString().trim();if(!q.isEmpty())toast(webSearch(q));}).show();}
    private void showTasks(){
        setup("Tasks");content.addView(label("Keep a simple on-device to-do list.",14,MUTED));addGap(content,10);
        EditText task=field("Add a task");task.setSingleLine(true);content.addView(task);addGap(content,8);
        content.addView(button("Add task",()->{String value=task.getText().toString().trim();if(value.isEmpty()){toast("Enter a task first.");return;}try{JSONArray tasks=new JSONArray(data.getString("tasks","[]"));tasks.put(new JSONObject().put("text",value).put("done",false));data.edit().putString("tasks",tasks.toString()).apply();showTasks();}catch(Exception e){toast("Could not save task.");}}));addGap(content,12);
        final JSONArray tasks;try{tasks=new JSONArray(data.getString("tasks","[]"));}catch(Exception e){toast("Could not read tasks.");return;}
        if(tasks.length()==0)content.addView(label("No tasks yet.",15,MUTED));
        for(int i=0;i<tasks.length();i++){final int position=i;JSONObject item=tasks.optJSONObject(i);if(item==null)continue;CheckBox check=new CheckBox(this);check.setText(item.optString("text"));check.setTextColor(TEXT);check.setChecked(item.optBoolean("done"));content.addView(check);
            check.setOnCheckedChangeListener((v,checked)->{try{JSONArray current=new JSONArray(data.getString("tasks","[]"));if(position>=current.length())return;current.getJSONObject(position).put("done",checked);data.edit().putString("tasks",current.toString()).apply();}catch(Exception e){toast("Could not update task.");}});
            content.addView(button("Delete task",()->{try{JSONArray current=new JSONArray(data.getString("tasks","[]"));if(position<current.length())current.remove(position);data.edit().putString("tasks",current.toString()).apply();showTasks();}catch(Exception e){toast("Could not delete task.");}}));addGap(content,8);
        }
    }
    private void showNotes(){
        setup("Notes & memory");
        TextView explanation=label("Stored on this device. Memory is sent to your configured AI provider with each request; only save information you want to share.",14,MUTED);content.addView(explanation);addGap(content,12);
        content.addView(label("Personal memory",17,CYAN)); EditText memory=field("Preferences and facts you approve");memory.setMinLines(4);memory.setGravity(Gravity.TOP);memory.setText(data.getString("memory",""));content.addView(memory);addGap(content,8);
        content.addView(button("Save memory",()->{data.edit().putString("memory",memory.getText().toString()).apply();toast("Memory saved on this device.");}));addGap(content,16);
        content.addView(label("Notes & to-do",17,CYAN));EditText notes=field("Write notes, tasks or a study plan");notes.setMinLines(8);notes.setGravity(Gravity.TOP);notes.setText(data.getString("notes",""));content.addView(notes);addGap(content,8);
        content.addView(button("Save notes",()->{data.edit().putString("notes",notes.getText().toString()).apply();toast("Notes saved.");}));
    }
    private void showReminders(){
        setup("Reminders");content.addView(label("Reminders use Android inexact alarms and may arrive late, especially in battery saver. Allow notifications for alerts.",14,MUTED));addGap(content,10);
        if(!ReminderReceiver.notificationsEnabled(this)){content.addView(label("Notifications are disabled. Missed reminders stay pending; enable notifications and reopen RONNY to retry them.",14,CYAN));addGap(content,8);content.addView(button("Open notification settings",()->openIntent(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()),"notification settings")));addGap(content,10);}
        content.addView(button("+ New reminder",this::reminderForm));addGap(content,12);
        JSONArray a=Reminders.load(this);
        if(a.length()==0)content.addView(label("No reminders yet.",15,MUTED));
        for(int i=0;i<a.length();i++){
            JSONObject item=a.optJSONObject(i);if(item==null)continue; int id=item.optInt("id");boolean done=item.optBoolean("done");
            TextView t=label((done?"✓  ":"◷  ")+item.optString("text")+"\n"+DateFormat.getDateTimeInstance(DateFormat.MEDIUM,DateFormat.SHORT).format(new Date(item.optLong("time")))+(item.optBoolean("daily")?"  •  Daily":"")+(done?"  •  Complete":""),15,TEXT);t.setPadding(dp(12),dp(12),dp(12),dp(12));t.setBackground(shape(PANEL,12,0));content.addView(t);
            LinearLayout r=row(); if(!done)rowButton(r,"Mark complete",()->{try{Reminders.remove(this,id,true);showReminders();}catch(Exception e){toast("Could not update reminder.");}});rowButton(r,"Delete",()->{try{Reminders.remove(this,id,false);showReminders();}catch(Exception e){toast("Could not delete reminder.");}});content.addView(r);addGap(content,10);
        }
    }
    private void reminderForm(){
        setup("New reminder");EditText text=field("What should I remind you about?");content.addView(text);addGap(content,12);
        Calendar chosen=Calendar.getInstance();chosen.add(Calendar.MINUTE,10);chosen.set(Calendar.SECOND,0);chosen.set(Calendar.MILLISECOND,0);
        TextView date=label("",16,TEXT); Runnable update=()->date.setText("Scheduled: "+DateFormat.getDateTimeInstance(DateFormat.MEDIUM,DateFormat.SHORT).format(chosen.getTime()));update.run();content.addView(date);addGap(content,8);
        LinearLayout r=row();rowButton(r,"Choose date",()->new DatePickerDialog(this,(v,y,m,d)->{chosen.set(Calendar.YEAR,y);chosen.set(Calendar.MONTH,m);chosen.set(Calendar.DAY_OF_MONTH,d);update.run();},chosen.get(Calendar.YEAR),chosen.get(Calendar.MONTH),chosen.get(Calendar.DAY_OF_MONTH)).show());
        rowButton(r,"Choose time",()->new TimePickerDialog(this,(v,h,m)->{chosen.set(Calendar.HOUR_OF_DAY,h);chosen.set(Calendar.MINUTE,m);update.run();},chosen.get(Calendar.HOUR_OF_DAY),chosen.get(Calendar.MINUTE),android.text.format.DateFormat.is24HourFormat(this)).show());content.addView(r);addGap(content,10);
        Switch daily=new Switch(this);daily.setText("Repeat daily");daily.setTextColor(TEXT);content.addView(daily);addGap(content,10);
        content.addView(button("Save reminder",()->{String value=text.getText().toString().trim();if(value.isEmpty()){toast("Enter a reminder.");return;}if(chosen.getTimeInMillis()<=System.currentTimeMillis()){toast("Choose a future date and time.");return;}try{Reminders.add(this,value,chosen.getTimeInMillis(),daily.isChecked());if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},NOTIFICATION_PERMISSION);toast("Reminder scheduled; delivery time is approximate.");showReminders();}catch(Exception e){toast("Could not schedule reminder: "+e.getMessage());}}));
    }
    private void showSettings(){
        setup("Settings");content.addView(label("AI PROVIDERS",13,CYAN));addGap(content,6);
        content.addView(label("Configure up to two OpenAI-compatible chat-completions endpoints. Provider 2 is tried if provider 1 fails. Providers may require a key and can change pricing or availability; check their terms. Your conversation and approved memory are sent to the provider.",14,MUTED));addGap(content,12);
        for(int i=1;i<=2;i++)providerForm(i);
        addGap(content,8);content.addView(label("VOICE",13,CYAN));addGap(content,8);
        Switch speak=new Switch(this);speak.setText("Speak answers");speak.setTextColor(TEXT);speak.setChecked(settings.getBoolean("speak",true));speak.setOnCheckedChangeListener((v,checked)->settings.edit().putBoolean("speak",checked).apply());content.addView(speak);addGap(content,8);
        TextView language=label("Recognition and speech language",14,TEXT);content.addView(language);Spinner spinner=new Spinner(this);String[] langs={"English (India)","Hindi (India)","English (US)"};String[] codes={"en-IN","hi-IN","en-US"};ArrayAdapter<String> adapter=new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,langs);spinner.setAdapter(adapter);int selected=0;for(int i=0;i<codes.length;i++)if(codes[i].equals(settings.getString("language","en-IN")))selected=i;spinner.setSelection(selected);spinner.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> a){} public void onItemSelected(android.widget.AdapterView<?> a,View v,int position,long id){settings.edit().putString("language",codes[position]).apply();configureVoice();}});content.addView(spinner);
        content.addView(button("Choose device voice",this::chooseVoice));addGap(content,8);
        seek("Speech speed", "rate", .5f, 2f);seek("Voice pitch", "pitch", .5f, 2f);addGap(content,12);
        content.addView(label("PRIVACY & DATA",13,CYAN));addGap(content,8);
        content.addView(button("Clear conversation history",()->{if(busy){toast("Wait for the current AI request to finish before clearing history.");return;}new AlertDialog.Builder(this).setMessage("Delete all locally stored chat history?").setNegativeButton("Cancel",null).setPositiveButton("Delete",(d,w)->{history=new JSONArray();data.edit().remove("history").apply();lastAnswer="";toast("History deleted.");}).show();}));addGap(content,8);
        content.addView(button("Delete notes and memory",()->new AlertDialog.Builder(this).setMessage("Delete locally stored notes and personal memory?").setNegativeButton("Cancel",null).setPositiveButton("Delete",(d,w)->{data.edit().remove("notes").remove("memory").apply();toast("Notes and memory deleted.");}).show()));addGap(content,8);
        content.addView(button("Delete all app data",()->{if(busy){toast("Wait for the current AI request to finish first.");return;}new AlertDialog.Builder(this).setMessage("Delete conversation, tasks, notes, memory, reminders, provider settings and keys? Scheduled reminders will be cancelled.").setNegativeButton("Cancel",null).setPositiveButton("Delete",(d,w)->{try{Reminders.cancelAll(this);new Secrets(this).clearAll();if(!data.edit().clear().commit() || !settings.edit().clear().commit())throw new Exception("Storage write failed");history=new JSONArray();lastAnswer="";configureVoice();toast("App data deleted.");showHome();}catch(Exception e){toast("Could not delete all data. Please retry or uninstall the app.");}}).show();}));addGap(content,8);
        content.addView(button("About & help",this::showAbout));addGap(content,20);
    }
    private void providerForm(int index){
        content.addView(label("Provider "+index,16,TEXT));addGap(content,6);
        EditText url=field("HTTPS chat completions URL");url.setSingleLine(true);url.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_URI);url.setText(settings.getString("url"+index,""));content.addView(url);addGap(content,6);
        EditText model=field("Model name");model.setSingleLine(true);model.setText(settings.getString("model"+index,""));content.addView(model);addGap(content,6);
        content.addView(button("Fill OpenRouter free settings",()->{url.setText("https://openrouter.ai/api/v1/chat/completions");model.setText("openrouter/free");toast("Add your OpenRouter API key, then save. Free usage is subject to provider limits.");}));addGap(content,6);
        EditText key=field("API key (blank keeps existing)");key.setSingleLine(true);key.setInputType(InputType.TYPE_CLASS_TEXT|InputType.TYPE_TEXT_VARIATION_PASSWORD);content.addView(key);addGap(content,6);
        LinearLayout actions=row();rowButton(actions,"Save provider",()->{
            String endpoint=url.getText().toString().trim(), modelName=model.getText().toString().trim();
            if(!endpoint.isEmpty())try{java.net.URL u=new java.net.URL(endpoint);if(!u.getProtocol().equalsIgnoreCase("https")||u.getHost().isEmpty()||u.getUserInfo()!=null)throw new Exception();}catch(Exception e){toast("Enter a valid HTTPS endpoint without credentials in the URL.");return;}
            if(endpoint.isEmpty()!=modelName.isEmpty()){toast("Enter both endpoint and model, or clear both to disable.");return;}
            if(endpoint.isEmpty()&&!key.getText().toString().trim().isEmpty()){toast("Enter an endpoint and model before saving a key.");return;}
            try{String k=key.getText().toString().trim(), previous=settings.getString("url"+index,"").trim(); Secrets secrets=new Secrets(this); if(!k.isEmpty())secrets.put("key"+index,BoundSecret.encode(endpoint,k)); else if(!endpoint.equals(previous))secrets.put("key"+index,"");settings.edit().putString("url"+index,endpoint).putString("model"+index,modelName).apply();key.setText("");toast("Provider "+index+" saved. Availability is checked when you send a message.");}catch(Exception e){toast("Could not securely store key: "+e.getClass().getSimpleName());}
        });rowButton(actions,"Delete key",()->{try{new Secrets(this).put("key"+index,"");key.setText("");toast("Provider key deleted.");}catch(Exception e){toast("Could not delete key.");}});content.addView(actions);addGap(content,16);
    }
    private void seek(String title,String key,float min,float max){TextView label=label(title,14,TEXT);content.addView(label);SeekBar bar=new SeekBar(this);bar.setMax(150);bar.setProgress(Math.round((settings.getFloat(key,1f)-min)*100));bar.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onStartTrackingTouch(SeekBar b){}public void onStopTrackingTouch(SeekBar b){}public void onProgressChanged(SeekBar b,int p,boolean user){float value=Math.min(max,min+p/100f);label.setText(title+": "+String.format(Locale.ROOT,"%.2f",value));if(user){settings.edit().putFloat(key,value).apply();configureVoice();}}});content.addView(bar);}
    private void showAbout(){setup("About RONNY");content.addView(label("RONNY AI 1.0\n\nA native Android personal assistant. Local commands work without an AI provider. Online answers require a working OpenAI-compatible endpoint and model you configure. RONNY opens browser search results rather than claiming to have checked sources itself.\n\nSpeech uses your device's recognition and text-to-speech services. Speak opens the device recognizer. Conversation mode repeatedly opens it with your permission and stops when you leave the app. No background wake word is implemented.\n\nReminders are approximate, not suitable for critical alerts. Notification permissions and battery settings affect delivery.\n\nNo contacts, messages or notifications are read. Provider keys are stored encrypted using Android Keystore. App data is not backed up.",16,TEXT));}
}
