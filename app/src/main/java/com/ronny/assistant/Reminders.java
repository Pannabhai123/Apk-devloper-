package com.ronny.assistant;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Calendar;

final class Reminders {
    static synchronized JSONArray load(Context c) {
        try { return new JSONArray(c.getSharedPreferences("data", 0).getString("reminders", "[]")); } catch (Exception e) { return new JSONArray(); }
    }
    static synchronized void save(Context c, JSONArray a) { c.getSharedPreferences("data", 0).edit().putString("reminders", a.toString()).apply(); }
    static PendingIntent pending(Context c, int id) {
        return PendingIntent.getBroadcast(c, id, new Intent(c, ReminderReceiver.class).putExtra("id", id), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static void schedule(Context c, JSONObject item) {
        AlarmManager alarm = (AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, item.optLong("time"), pending(c, item.optInt("id")));
    }
    static synchronized void add(Context c, String text, long time, boolean daily) throws Exception {
        JSONArray a = load(c); int id = c.getSharedPreferences("data", 0).getInt("nextId", 1);
        c.getSharedPreferences("data", 0).edit().putInt("nextId", id + 1).apply();
        JSONObject item = new JSONObject().put("id", id).put("text", text).put("time", time).put("daily", daily).put("done", false);
        schedule(c, item); a.put(item); save(c, a);
    }
    static synchronized void remove(Context c, int id, boolean complete) throws Exception {
        JSONArray a = load(c), result = new JSONArray();
        for (int i = 0; i < a.length(); i++) {
            JSONObject item = a.getJSONObject(i);
            if (item.optInt("id") == id) {
                ((AlarmManager)c.getSystemService(Context.ALARM_SERVICE)).cancel(pending(c, id));
                if (complete) { item.put("done", true); result.put(item); }
            } else result.put(item);
        }
        save(c, result);
    }
    static synchronized JSONObject findPending(Context c, int id) throws Exception {
        JSONArray a=load(c);
        for(int i=0;i<a.length();i++){JSONObject item=a.getJSONObject(i);if(item.optInt("id")==id&&!item.optBoolean("done"))return new JSONObject(item.toString());}
        return null;
    }
    static synchronized JSONObject fired(Context c, int id) throws Exception {
        JSONArray a = load(c); JSONObject found = null;
        for (int i = 0; i < a.length(); i++) {
            JSONObject item = a.getJSONObject(i);
            if (item.optInt("id") == id && !item.optBoolean("done")) {
                found = new JSONObject(item.toString());
                if (item.optBoolean("daily")) {
                    Calendar next = Calendar.getInstance(); next.setTimeInMillis(item.optLong("time"));
                    do { next.add(Calendar.DAY_OF_YEAR, 1); } while (next.getTimeInMillis() <= System.currentTimeMillis());
                    item.put("time", next.getTimeInMillis()); schedule(c, item);
                } else item.put("done", true);
                break;
            }
        }
        save(c, a); return found;
    }
    static synchronized void cancelAll(Context c) {
        JSONArray a = load(c);
        AlarmManager alarm = (AlarmManager)c.getSystemService(Context.ALARM_SERVICE);
        for (int i = 0; i < a.length(); i++) {
            JSONObject item = a.optJSONObject(i);
            if (item != null) alarm.cancel(pending(c, item.optInt("id")));
        }
    }
    static synchronized void restore(Context c) throws Exception {
        JSONArray a = load(c);
        for (int i = 0; i < a.length(); i++) {
            JSONObject item = a.getJSONObject(i); if (item.optBoolean("done")) continue;
            // A missed alarm is delivered shortly after reboot; daily repetition resumes from its original local time.
            schedule(c, item);
        }
    }
}
