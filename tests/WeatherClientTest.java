package com.ronny.assistant;
public final class WeatherClientTest {
    private static void check(boolean ok,String reason){if(!ok)throw new AssertionError(reason);}
    public static void main(String[] args) throws Exception {
        String places="{\"results\":[{\"name\":\"Bhagalpur\",\"admin1\":\"Bihar\",\"country\":\"India\",\"latitude\":25.25,\"longitude\":86.98}]}";
        String current="{\"timezone\":\"Asia/Kolkata\",\"current\":{\"temperature_2m\":29.2,\"apparent_temperature\":31.2,\"relative_humidity_2m\":65,\"wind_speed_10m\":10.2,\"weather_code\":2,\"time\":\"2026-11-01T08:00\"},\"current_units\":{\"temperature_2m\":\"°C\",\"apparent_temperature\":\"°C\",\"relative_humidity_2m\":\"%\",\"wind_speed_10m\":\"km/h\"}}";
        int[] calls={0};
        String answer=WeatherClient.fetch("Bhagalpur",url->{calls[0]++;return calls[0]==1?places:current;});
        check(calls[0]==2&&answer.contains("Bhagalpur, Bihar, India")&&answer.contains("29.2 °C")&&answer.contains("Asia/Kolkata")&&answer.contains("https://open-meteo.com/"),"valid weather response");
        try{WeatherClient.fetch("No city",url->"{}");throw new AssertionError("missing location accepted");}catch(Exception e){check(e.getMessage().contains("City not found"),"missing city error");}
        try{WeatherClient.fetch("City",url->{throw new Exception("offline");});throw new AssertionError("offline returned success");}catch(Exception e){check(e.getMessage().contains("offline"),"offline error propagated");}
        try{int[] n={0};WeatherClient.fetch("City",url->++n[0]==1?places:"{}");throw new AssertionError("invalid forecast accepted");}catch(org.json.JSONException expected){}
        try{WeatherClient.fetch("",url->"{}");throw new AssertionError("empty city accepted");}catch(Exception e){check(e.getMessage().contains("Enter a city"),"empty city error");}
        System.out.println("WeatherClient: 5 mocked cases passed");
    }
}
