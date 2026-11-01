package com.ronny.assistant;

import static org.junit.Assert.*;
import android.content.Context;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Real-device/emulator smoke checks; not a substitute for full release QA. */
@RunWith(AndroidJUnit4.class)
public class AssistantSmokeTest {
    @Before public void clearData() {
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
    private static void click(MainActivity a,String label){TextView button=text(a.getWindow().getDecorView(),label,Button.class);assertNotNull("Missing button: "+label,button);button.performClick();}
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
    @Test public void taskCanBeAddedAndDeleted() {
        try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
            scenario.onActivity(a->{click(a,"Tasks");EditText task=field(a.getWindow().getDecorView(),"Add a task");assertNotNull(task);task.setText("Buy milk");click(a,"Add task");
                assertNotNull(text(a.getWindow().getDecorView(),"Buy milk",TextView.class));click(a,"Delete task");assertNull(text(a.getWindow().getDecorView(),"Buy milk",TextView.class));});
        }
    }
}
