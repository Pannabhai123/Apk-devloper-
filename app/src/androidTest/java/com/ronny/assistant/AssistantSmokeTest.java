package com.ronny.assistant;

import static org.junit.Assert.*;
import static androidx.test.espresso.intent.Intents.intending;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasAction;
import android.accessibilityservice.AccessibilityService;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.DialogInterface;
import android.app.Instrumentation;
import android.content.Context;
import android.content.ContentValues;
import android.net.Uri;
import android.provider.MediaStore;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import android.content.Intent;
import android.content.pm.ResolveInfo;
import android.os.SystemClock;
import android.provider.Settings;
import android.speech.RecognizerIntent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.filters.SdkSuppress;
import androidx.test.espresso.intent.Intents;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.ArrayList;

/** Real-device/emulator smoke checks; not a substitute for full release QA. */
@RunWith(AndroidJUnit4.class)
public class AssistantSmokeTest {
    @Before public void clearData() {
        InstrumentationRegistry.getInstrumentation().getUiAutomation().performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME);
        Context app=InstrumentationRegistry.getInstrumentation().getTargetContext();
        app.getSharedPreferences("data",Context.MODE_PRIVATE).edit().clear().commit();
        app.getSharedPreferences("settings",Context.MODE_PRIVATE).edit().clear().commit();
    }
    private static TextView text(View view,String value,Class<?> type) {
        if(type.isInstance(view) && view instanceof TextView && value.contentEquals(((TextView)view).getText()))return (TextView)view;
        if(view instanceof ViewGroup){ViewGroup group=(ViewGroup)view;for(int i=0;i<group.getChildCount();i++){TextView found=text(group.getChildAt(i),value,type);if(found!=null)return found;}}
        return null;
    }
    private static EditText field(View view,String hint){
        if(view instanceof EditText && ((EditText)view).getHint()!=null && hint.contentEquals(((EditText)view).getHint()))return (EditText)view;
        if(view instanceof ViewGroup){ViewGroup group=(ViewGroup)view;for(int i=0;i<group.getChildCount();i++){EditText found=field(group.getChildAt(i),hint);if(found!=null)return found;}}
        return null;
    }
    static void click(MainActivity a,String label){TextView button=text(a.getWindow().getDecorView(),label,Button.class);assertNotNull("Missing button: "+label,button);button.performClick();}
    static void respondToDocumentConsent(MainActivity a,int which){
        try{java.lang.reflect.Field field=MainActivity.class.getDeclaredField("documentConsent");field.setAccessible(true);AlertDialog dialog=(AlertDialog)field.get(a);assertNotNull("Document consent dialog missing",dialog);assertTrue("Document consent dialog not shown",dialog.isShowing());Button button=dialog.getButton(which);assertNotNull(button);button.performClick();}
        catch(ReflectiveOperationException e){throw new AssertionError(e);}
    }
    @Test public void launchesAndCalculatesOffline() {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(a->{assertNotNull(text(a.getWindow().getDecorView(),"◉  RONNY AI",TextView.class));
                EditText input=field(a.getWindow().getDecorView(),"Ask or give a command…");assertNotNull(input);input.setText("2 + 3 * 4");click(a,"Send");
                assertNotNull("Local result missing",text(a.getWindow().getDecorView(),"RONNY\nResult: 14.0",TextView.class));});
        }
    }
    @Test public void notesSurviveActivityRecreation() {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(a->{click(a,"Notes");EditText notes=field(a.getWindow().getDecorView(),"Write notes, tasks or a study plan");assertNotNull(notes);notes.setText("A note saved on device");click(a,"Save notes");});
            scenario.recreate();
            scenario.onActivity(a->{click(a,"Notes");EditText notes=field(a.getWindow().getDecorView(),"Write notes, tasks or a study plan");assertNotNull(notes);assertEquals("A note saved on device",notes.getText().toString());});
        }
    }
    static boolean containsText(View view,String value) {
        if(view instanceof TextView && ((TextView)view).getText().toString().contains(value))return true;
        if(view instanceof ViewGroup){ViewGroup group=(ViewGroup)view;for(int i=0;i<group.getChildCount();i++)if(containsText(group.getChildAt(i),value))return true;}
        return false;
    }
    @Test public void microphoneButtonHandlesSimulatedRecognitionResult() {
        Intents.init();
        try {
            ArrayList<String> words=new ArrayList<>();words.add("battery");Intent result=new Intent().putStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS,words);
            intending(hasAction(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,result));
            try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
                scenario.onActivity(a->click(a,"🎙 Speak"));
                long deadline=SystemClock.elapsedRealtime()+10000;boolean[] found={false};
                while(SystemClock.elapsedRealtime()<deadline && !found[0]){scenario.onActivity(a->found[0]=containsText(a.getWindow().getDecorView(),"Battery:"));if(!found[0])SystemClock.sleep(200);}
                assertTrue("Recognized command did not produce a battery answer",found[0]);
            }
        } finally {Intents.release();}
    }
    @Test @SdkSuppress(minSdkVersion=29) public void selectedTextRequiresConsentAndIsNotStoredInHistory() throws Exception {
        Context app=InstrumentationRegistry.getInstrumentation().getTargetContext();
        ContentValues values=new ContentValues();values.put(MediaStore.MediaColumns.DISPLAY_NAME,"ronny-document-test.txt");values.put(MediaStore.MediaColumns.MIME_TYPE,"text/plain");
        Uri file=app.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);assertNotNull(file);
        String privateText="Unique local document content for the test";
        try {
            try(OutputStream out=app.getContentResolver().openOutputStream(file)){assertNotNull(out);out.write(privateText.getBytes(StandardCharsets.UTF_8));}
            Intents.init();
            try {
                intending(hasAction(Intent.ACTION_OPEN_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(file)));
                try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
                    scenario.onActivity(a->{click(a,"Documents");click(a,"Choose text file");});
                    long deadline=SystemClock.elapsedRealtime()+15000;boolean[] loaded={false};
                    while(SystemClock.elapsedRealtime()<deadline && !loaded[0]){scenario.onActivity(a->loaded[0]=containsText(a.getWindow().getDecorView(),privateText));if(!loaded[0])SystemClock.sleep(200);}
                    assertTrue("Selected text was not displayed",loaded[0]);
                    scenario.onActivity(a->{click(a,"Summarize");respondToDocumentConsent(a,DialogInterface.BUTTON_NEGATIVE);});
                    assertFalse("Cancel must not add document text to chat",app.getSharedPreferences("data",Context.MODE_PRIVATE).getString("history","").contains(privateText));
                    scenario.onActivity(a->{click(a,"Summarize");respondToDocumentConsent(a,DialogInterface.BUTTON_POSITIVE);});
                    long finish=SystemClock.elapsedRealtime()+15000;boolean[] answered={false};
                    while(SystemClock.elapsedRealtime()<finish && !answered[0]){scenario.onActivity(a->answered[0]=containsText(a.getWindow().getDecorView(),"No AI provider configured"));if(!answered[0])SystemClock.sleep(200);}
                    assertTrue("Unavailable AI was not reported",answered[0]);
                    String history=app.getSharedPreferences("data",Context.MODE_PRIVATE).getString("history","");
                    assertFalse("Original document text must not be saved to chat",history.contains(privateText));
                }
            } finally {Intents.release();}
        } finally {app.getContentResolver().delete(file,null,null);}
    }
    @Test public void settingsVoiceStyleCommandOpensSystemSettings() {
        Context app=InstrumentationRegistry.getInstrumentation().getTargetContext();
        ResolveInfo resolved=app.getPackageManager().resolveActivity(new Intent(Settings.ACTION_SETTINGS),0);
        assertNotNull("No system Settings app on this device",resolved);String expected=resolved.activityInfo.packageName;
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            try {
                scenario.onActivity(a->{EditText input=field(a.getWindow().getDecorView(),"Ask or give a command…");assertNotNull(input);input.setText("settings kholo");click(a,"Send");});
                long deadline=SystemClock.elapsedRealtime()+10000;boolean opened=false;
                while(SystemClock.elapsedRealtime()<deadline){AccessibilityNodeInfo root=InstrumentationRegistry.getInstrumentation().getUiAutomation().getRootInActiveWindow();
                    if(root!=null && root.getPackageName()!=null && expected.contentEquals(root.getPackageName())){opened=true;break;}SystemClock.sleep(200);}
                assertTrue("System Settings did not open",opened);
            } finally {InstrumentationRegistry.getInstrumentation().getUiAutomation().performGlobalAction(AccessibilityService.GLOBAL_ACTION_HOME);}
        }
    }
    @Test public void taskCanBeAddedAndDeleted() {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(a->{click(a,"Tasks");EditText task=field(a.getWindow().getDecorView(),"Add a task");assertNotNull(task);task.setText("Buy milk");click(a,"Add task");
                assertNotNull(text(a.getWindow().getDecorView(),"Buy milk",TextView.class));click(a,"Delete task");assertNull(text(a.getWindow().getDecorView(),"Buy milk",TextView.class));});
        }
    }
}
