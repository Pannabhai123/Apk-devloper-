package com.ronny.assistant;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;
import org.json.JSONObject;

public class ReminderReceiver extends BroadcastReceiver {
    static boolean notificationsEnabled(Context context) {
        if(Build.VERSION.SDK_INT>=33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return false;
        NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        if(!manager.areNotificationsEnabled())return false;
        NotificationChannel channel=manager.getNotificationChannel("reminders");
        return channel==null || channel.getImportance()!=NotificationManager.IMPORTANCE_NONE;
    }
    @Override public void onReceive(Context context, Intent intent) {
        try {
            int id = intent.getIntExtra("id", -1); JSONObject item = Reminders.findPending(context, id); if (item == null) return;
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            manager.createNotificationChannel(new NotificationChannel("reminders", "Reminders", NotificationManager.IMPORTANCE_DEFAULT));
            if (!notificationsEnabled(context)) { Log.w("RONNY", "Reminder kept pending because notifications are disabled"); return; }
            PendingIntent open = PendingIntent.getActivity(context, 0, new Intent(context, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification notification = new Notification.Builder(context, "reminders").setSmallIcon(android.R.drawable.ic_dialog_info)
                    .setContentTitle("RONNY reminder").setContentText(item.optString("text")).setStyle(new Notification.BigTextStyle().bigText(item.optString("text")))
                    .setContentIntent(open).setAutoCancel(true).build();
            manager.notify(id, notification);
            Reminders.fired(context, id);
        } catch (Exception e) { Log.e("RONNY", "Could not deliver reminder", e); }
    }
}
