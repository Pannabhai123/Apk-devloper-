package com.ronny.assistant;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/** OpenAI-compatible chat-completions endpoints. No provider or free tier is assumed. */
final class AiClient {
    static String ask(Context context, JSONArray history, String memory) throws Exception {
        SharedPreferences p=context.getSharedPreferences("settings",0);
        String[] endpoints=new String[2], models=new String[2]; boolean[] configured=new boolean[2];
        for(int i=0;i<2;i++) {
            endpoints[i]=p.getString("url"+(i+1),"").trim();models[i]=p.getString("model"+(i+1),"").trim();
            configured[i]=!endpoints[i].isEmpty()&&!models[i].isEmpty();
        }
        return ProviderFallback.run(configured, i->call(context,i+1,endpoints[i],models[i],history,memory));
    }
    private static String call(Context context,int index,String endpoint,String model,JSONArray history,String memory) throws Exception {
        URL url=new URL(endpoint);
        if(!"https".equalsIgnoreCase(url.getProtocol())||url.getHost().isEmpty()||url.getUserInfo()!=null)throw new Exception("HTTPS URL required");
        JSONArray messages=new JSONArray();
        String system="You are RONNY, a helpful personal assistant. Reply in the user's language, including Hindi or Hinglish. Do not claim you have performed phone actions or looked up current information when you have not.";
        if(!memory.trim().isEmpty())system+=" User-approved memory: "+memory.substring(0,Math.min(memory.length(),3000));
        messages.put(new JSONObject().put("role","system").put("content",system));
        for(int j=Math.max(0,history.length()-20);j<history.length();j++)messages.put(history.getJSONObject(j));
        JSONObject body=new JSONObject().put("model",model).put("messages",messages);
        HttpURLConnection conn=(HttpURLConnection)url.openConnection();
        try {
            conn.setInstanceFollowRedirects(false);conn.setConnectTimeout(15000);conn.setReadTimeout(45000);
            conn.setRequestMethod("POST");conn.setDoOutput(true);conn.setRequestProperty("Content-Type","application/json");
            String key=BoundSecret.forEndpoint(new Secrets(context).get("key"+index),endpoint);
            if(!key.isEmpty())conn.setRequestProperty("Authorization","Bearer "+key);
            byte[] bytes=body.toString().getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(bytes.length);
            try(java.io.OutputStream output=conn.getOutputStream()){output.write(bytes);}
            int code=conn.getResponseCode();
            if(code<200||code>=300)throw new Exception("HTTP "+code+(code==429?" (rate limited)":""));
            String result=read(conn.getInputStream());
            String answer=new JSONObject(result).getJSONArray("choices").getJSONObject(0).getJSONObject("message").getString("content").trim();
            if(answer.isEmpty()||answer.equals("null"))throw new Exception("empty response");
            return answer;
        } finally {conn.disconnect();}
    }
    private static String read(InputStream stream) throws Exception {
        try(InputStream in=stream;ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] buffer=new byte[4096];int n;int total=0;
            while((n=in.read(buffer))!=-1){total+=n;if(total>1024*1024)throw new Exception("response too large");out.write(buffer,0,n);}
            return out.toString("UTF-8");
        }
    }
}
