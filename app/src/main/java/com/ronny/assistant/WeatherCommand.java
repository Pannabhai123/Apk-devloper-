package com.ronny.assistant;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
final class WeatherCommand {
    private static final Pattern COMMAND=Pattern.compile("^(?:(?:current )?weather (?:in|for)|(?:aaj ka )?mausam (?:in|of)|(?:आज का )?मौसम (?:in|में))\\s+(.+?)[?.! ]*$",Pattern.CASE_INSENSITIVE);
    static String city(String message) {
        String input=message.trim().replaceFirst("(?i)^[, ]*(?:(?:hey|hello|ok) )?ronny[, ]+","").trim();
        Matcher match=COMMAND.matcher(input);if(!match.matches())return null;
        String city=match.group(1).trim();return city.isEmpty()?null:city;
    }
}
