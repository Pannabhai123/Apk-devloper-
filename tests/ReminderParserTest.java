package com.ronny.assistant;

import java.util.Calendar;
import java.util.TimeZone;

/** Standalone JVM tests; no Android runtime or third-party test library required. */
public final class ReminderParserTest {
    private static Calendar time(int year,int month,int day,int hour,int minute) {
        Calendar c=Calendar.getInstance(TimeZone.getTimeZone("Asia/Kolkata"));c.clear();c.set(year,month-1,day,hour,minute);return c;
    }
    private static void check(boolean b,String message) { if(!b)throw new AssertionError(message); }
    private static void expected(ReminderParser.Result r,String task,Calendar when,boolean daily) {
        check(r!=null,"Expected parsed reminder: "+task);check(r.text.equals(task),"task mismatch: "+r.text);check(r.time==when.getTimeInMillis(),"time mismatch for "+task);check(r.daily==daily,"repeat mismatch");
    }
    public static void main(String[] args) {
        Calendar now=time(2026,11,1,15,30);
        expected(ReminderParser.parse("remind me to run tomorrow at 6 am",now),"run",time(2026,11,2,6,0),false);
        expected(ReminderParser.parse("kal subah 6 baje running ke liye yaad dilana",now),"running",time(2026,11,2,6,0),false);
        expected(ReminderParser.parse("remind me to take medicine daily at 9:15 pm",now),"take medicine",time(2026,11,1,21,15),true);
        expected(ReminderParser.parse("roz subah 6 baje running ke liye yaad dilana",now),"running",time(2026,11,2,6,0),true);
        expected(ReminderParser.parse("remind me to sleep tomorrow at 12 am",now),"sleep",time(2026,11,2,0,0),false);
        expected(ReminderParser.parse("remind me to eat tomorrow at 12 pm",now),"eat",time(2026,11,2,12,0),false);
        check(ReminderParser.parse("remind me to run today at 2 pm",now)==null,"past reminder accepted");
        check(ReminderParser.parse("remind me to run tomorrow at 25:00",now)==null,"invalid hour accepted");
        check(ReminderParser.parse("remind me to run tomorrow at 8:99",now)==null,"invalid minute accepted");
        check(ReminderParser.parse("remind me to run tomorrow",now)==null,"ambiguous reminder accepted");
        check(ReminderParser.looksLikeReminder("remind me to run tomorrow"),"invalid reminder must be caught locally");
        check(!ReminderParser.looksLikeReminder("tell me a fact"),"non-reminder misclassified");
        System.out.println("ReminderParser: 12 cases passed");
    }
}
