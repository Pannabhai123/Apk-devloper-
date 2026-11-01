package com.ronny.assistant;

import java.util.Calendar;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Deliberately small command grammar; unsupported/ambiguous phrases must not be scheduled. */
final class ReminderParser {
    private static final Pattern EN = Pattern.compile("^(?:please\\s+)?remind me to (.+?) (today|tomorrow|daily) at (\\d{1,2})(?::(\\d{2}))?\\s*(am|pm)?[.!]?$", Pattern.CASE_INSENSITIVE);
    private static final Pattern HI = Pattern.compile("^(?:mujhe\\s+)?(aaj|kal|roz)\\s+(?:(subah|shaam|raat)\\s+)?(\\d{1,2})(?::(\\d{2}))?\\s+baje\\s+(.+?)\\s+ke liye yaad dilana[.!]?$", Pattern.CASE_INSENSITIVE);
    static final class Result {
        final String text; final long time; final boolean daily;
        Result(String text, long time, boolean daily) { this.text=text;this.time=time;this.daily=daily; }
    }
    static boolean looksLikeReminder(String text) {
        String s=text.toLowerCase(Locale.ROOT);
        return s.startsWith("remind me") || s.startsWith("please remind me") || s.contains("yaad dilana");
    }
    static Result parse(String text, Calendar now) {
        String s=text.trim(); Matcher en=EN.matcher(s), hi=HI.matcher(s);
        String task, day, part, hourText, minuteText;
        if(en.matches()) { task=en.group(1); day=en.group(2); hourText=en.group(3); minuteText=en.group(4); part=en.group(5); }
        else if(hi.matches()) { day=hi.group(1); part=hi.group(2); hourText=hi.group(3); minuteText=hi.group(4); task=hi.group(5); }
        else return null;
        day=day.toLowerCase(Locale.ROOT); part=part==null?"":part.toLowerCase(Locale.ROOT); task=task.trim();
        if(task.isEmpty()) return null;
        int hour=Integer.parseInt(hourText), minute=minuteText==null?0:Integer.parseInt(minuteText);
        if(minute>59) return null;
        if(!part.isEmpty()) {
            if(hour<1 || hour>12) return null;
            hour%=12;
            if(part.equals("pm") || part.equals("shaam") || part.equals("raat")) hour+=12;
        } else if(hour>23) return null;
        Calendar at=(Calendar)now.clone();
        at.set(Calendar.HOUR_OF_DAY,hour);at.set(Calendar.MINUTE,minute);at.set(Calendar.SECOND,0);at.set(Calendar.MILLISECOND,0);
        if(day.equals("tomorrow") || day.equals("kal")) at.add(Calendar.DAY_OF_YEAR,1);
        boolean daily=day.equals("daily") || day.equals("roz");
        if(daily && at.getTimeInMillis()<=now.getTimeInMillis()) at.add(Calendar.DAY_OF_YEAR,1);
        if(at.getTimeInMillis()<=now.getTimeInMillis()) return null;
        // Some local times do not exist when clocks jump forward; do not silently change them.
        if(at.get(Calendar.HOUR_OF_DAY)!=hour || at.get(Calendar.MINUTE)!=minute) return null;
        return new Result(task,at.getTimeInMillis(),daily);
    }
}
