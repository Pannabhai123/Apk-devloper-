package com.ronny.assistant;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;
public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) try { Reminders.restore(c); } catch (Exception e) { Log.e("RONNY", "Could not restore reminders", e); }
    }
}
