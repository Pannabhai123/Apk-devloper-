package com.ronny.assistant;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** City lookup and current weather from the public Open-Meteo APIs, with no location permission. */
final class WeatherClient {
    private static String get(String address) throws Exception {
        URL url=new URL(address);HttpURLConnection conn=(HttpURLConnection)url.openConnection();
        try {
            conn.setInstanceFollowRedirects(false);conn.setConnectTimeout(12000);conn.setReadTimeout(20000);
            conn.setRequestProperty("Accept","application/json");
            int code=conn.getResponseCode();if(code<200||code>=300)throw new Exception("HTTP "+code+(code==429?" (rate limited)":""));
            try(InputStream input=conn.getInputStream();ByteArrayOutputStream output=new ByteArrayOutputStream()){
                byte[] bytes=new byte[4096];int count,total=0;
                while((count=input.read(bytes))!=-1){total+=count;if(total>512*1024)throw new Exception("response too large");output.write(bytes,0,count);}
                return output.toString(StandardCharsets.UTF_8.name());
            }
        } finally {conn.disconnect();}
    }
    interface Transport { String get(String url) throws Exception; }
    private static double finite(JSONObject obj,String name) throws Exception {double value=obj.getDouble(name);if(!Double.isFinite(value))throw new Exception("Invalid weather data");return value;}
    static String fetch(String city) throws Exception { return fetch(city, WeatherClient::get); }
    static String fetch(String city, Transport transport) throws Exception {
        city=city.trim();if(city.isEmpty()||city.length()>100)throw new Exception("Enter a city name up to 100 characters");
        String geocode="https://geocoding-api.open-meteo.com/v1/search?count=1&language=en&format=json&name="+URLEncoder.encode(city,"UTF-8");
        JSONObject places=new JSONObject(transport.get(geocode));JSONArray results=places.optJSONArray("results");
        if(results==null||results.length()==0)throw new Exception("City not found; try its full name");
        JSONObject place=results.getJSONObject(0);double lat=place.getDouble("latitude"),lon=place.getDouble("longitude");
        if(!Double.isFinite(lat)||!Double.isFinite(lon)||lat < -90||lat > 90||lon < -180||lon > 180)throw new Exception("Invalid location returned");
        String url=String.format(Locale.ROOT,"https://api.open-meteo.com/v1/forecast?latitude=%.5f&longitude=%.5f&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto",lat,lon);
        JSONObject forecast=new JSONObject(transport.get(url));JSONObject current=forecast.getJSONObject("current");JSONObject units=forecast.getJSONObject("current_units");
        String location=place.getString("name");String region=place.optString("admin1","");String country=place.optString("country","");
        if(!region.isEmpty())location+=", "+region;if(!country.isEmpty())location+=", "+country;
        return "Current weather for "+location+"\nTemperature: "+finite(current,"temperature_2m")+" "+units.getString("temperature_2m")+
                " (feels like "+finite(current,"apparent_temperature")+" "+units.getString("apparent_temperature")+")\nHumidity: "+current.getInt("relative_humidity_2m")+" "+units.getString("relative_humidity_2m")+
                "\nWind: "+finite(current,"wind_speed_10m")+" "+units.getString("wind_speed_10m")+
                "\nWeather code: "+current.getInt("weather_code")+" (WMO)\nModel time: "+current.getString("time")+" ("+forecast.optString("timezone","local time")+")\nSource: https://open-meteo.com/";
    }
}
