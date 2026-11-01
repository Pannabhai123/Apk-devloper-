package com.ronny.assistant;

import static org.junit.Assert.*;
import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import android.os.SystemClock;
import android.service.notification.StatusBarNotification;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONArray;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public class DeviceIntegrationTest {
    private Context app;
    @Before public void prepare() {
        app=InstrumentationRegistry.getInstrumentation().getTargetContext();
        Reminders.cancelAll(app);
        app.getSharedPreferences("data",Context.MODE_PRIVATE).edit().clear().commit();
        ((NotificationManager)app.getSystemService(Context.NOTIFICATION_SERVICE)).cancelAll();
    }
    @After public void cleanup() {
        Reminders.cancelAll(app);
        ((NotificationManager)app.getSystemService(Context.NOTIFICATION_SERVICE)).cancelAll();
    }
    @Test public void keystoreEncryptsAndBindsProviderKey() throws Exception {
        Secrets secrets=new Secrets(app);String slot="instrumentation-test-key", endpoint="https://example.invalid/v1/chat/completions";
        String sample="not-a-real-provider-key";
        try {
            secrets.put(slot,BoundSecret.encode(endpoint,sample));
            String stored=app.getSharedPreferences("secrets",Context.MODE_PRIVATE).getString(slot,"");
            assertFalse("plaintext must not be stored",stored.contains(sample));
            String decoded=secrets.get(slot);
            assertEquals(sample,BoundSecret.forEndpoint(decoded,endpoint));
            assertEquals("",BoundSecret.forEndpoint(decoded,"https://other.invalid/v1/chat/completions"));
        } finally {secrets.put(slot,"");}
    }
    @Test public void scheduledReminderPostsNotificationAndCompletes() throws Exception {
        if(Build.VERSION.SDK_INT>=33)InstrumentationRegistry.getInstrumentation().getUiAutomation().grantRuntimePermission(app.getPackageName(),Manifest.permission.POST_NOTIFICATIONS);
        assertTrue("Notifications should be enabled for this test",ReminderReceiver.notificationsEnabled(app));
        Reminders.add(app,"Instrumented reminder",System.currentTimeMillis()+3000,false);
        JSONArray all=Reminders.load(app);int id=all.getJSONObject(0).getInt("id");
        long deadline=SystemClock.elapsedRealtime()+45000;boolean finished=false,notified=false;
        NotificationManager manager=(NotificationManager)app.getSystemService(Context.NOTIFICATION_SERVICE);
        while(SystemClock.elapsedRealtime()<deadline) {
            JSONArray reminders=Reminders.load(app);finished=reminders.length()>0 && reminders.getJSONObject(0).optBoolean("done");
            for(StatusBarNotification notification:manager.getActiveNotifications())if(notification.getId()==id)notified=true;
            if(finished&&notified)break;
            SystemClock.sleep(250);
        }
        assertTrue("Reminder did not transition to complete after posting",finished);
        assertTrue("Reminder notification was not present",notified);
    }
}
