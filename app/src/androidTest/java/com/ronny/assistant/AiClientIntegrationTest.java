package com.ronny.assistant;

import static org.junit.Assert.*;
import static androidx.test.espresso.intent.Intents.intending;
import static androidx.test.espresso.intent.matcher.IntentMatchers.hasAction;
import android.app.Activity;
import android.app.Instrumentation;
import android.content.Context;
import android.content.ContentValues;
import android.content.Intent;
import android.content.DialogInterface;
import android.net.Uri;
import android.os.SystemClock;
import android.provider.MediaStore;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.core.app.ActivityScenario;
import androidx.test.espresso.intent.Intents;
import androidx.test.filters.SdkSuppress;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.concurrent.TimeUnit;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLSocketFactory;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import okhttp3.tls.HandshakeCertificates;
import okhttp3.tls.HeldCertificate;

/** HTTPS integration tests with a local, test-only certificate and mock provider. */
@RunWith(AndroidJUnit4.class)
public class AiClientIntegrationTest {
    private Context app;
    private SSLSocketFactory originalFactory;
    private MockWebServer server;
    private Secrets secrets;
    @Before public void prepare() throws Exception {
        app=InstrumentationRegistry.getInstrumentation().getTargetContext();
        app.getSharedPreferences("settings",Context.MODE_PRIVATE).edit().clear().commit();
        app.getSharedPreferences("data",Context.MODE_PRIVATE).edit().clear().commit();
        secrets=new Secrets(app);secrets.put("key1","");secrets.put("key2","");
        HeldCertificate certificate=new HeldCertificate.Builder().addSubjectAlternativeName("localhost").build();
        HandshakeCertificates serverCerts=new HandshakeCertificates.Builder().heldCertificate(certificate).build();
        HandshakeCertificates clientCerts=new HandshakeCertificates.Builder().addTrustedCertificate(certificate.certificate()).build();
        server=new MockWebServer();server.useHttps(serverCerts.sslSocketFactory(),false);server.start();
        originalFactory=HttpsURLConnection.getDefaultSSLSocketFactory();
        HttpsURLConnection.setDefaultSSLSocketFactory(clientCerts.sslSocketFactory());
    }
    @After public void cleanup() throws Exception {
        if(originalFactory!=null)HttpsURLConnection.setDefaultSSLSocketFactory(originalFactory);
        if(server!=null)server.shutdown();
        if(secrets!=null){secrets.put("key1","");secrets.put("key2","");}
        if(app!=null)app.getSharedPreferences("settings",Context.MODE_PRIVATE).edit().clear().commit();
    }
    private void configure() throws Exception {
        String first=server.url("/one").toString(),second=server.url("/two").toString();
        app.getSharedPreferences("settings",Context.MODE_PRIVATE).edit().putString("url1",first).putString("model1","model-a").putString("url2",second).putString("model2","model-b").commit();
        secrets.put("key1",BoundSecret.encode(first,"first-fake-token"));secrets.put("key2",BoundSecret.encode(second,"second-fake-token"));
    }
    private JSONArray history() throws Exception {return new JSONArray().put(new JSONObject().put("role","user").put("content","Hello from a test"));}
    @Test public void rateLimitFallsBackAndKeepsKeysBoundToEndpoints() throws Exception {
        configure();server.enqueue(new MockResponse().setResponseCode(429));
        server.enqueue(new MockResponse().setResponseCode(200).setBody("{\"choices\":[{\"message\":{\"content\":\"Fallback answer\"}}]}"));
        assertEquals("Fallback answer",AiClient.ask(app,history(),"User likes astronomy"));
        RecordedRequest first=server.takeRequest(5,TimeUnit.SECONDS),second=server.takeRequest(5,TimeUnit.SECONDS);
        assertNotNull(first);assertNotNull(second);assertEquals("/one",first.getPath());assertEquals("/two",second.getPath());
        assertEquals("Bearer first-fake-token",first.getHeader("Authorization"));assertEquals("Bearer second-fake-token",second.getHeader("Authorization"));
        String body=second.getBody().readUtf8();assertTrue(body.contains("Hello from a test"));assertTrue(body.contains("User likes astronomy"));assertTrue(body.contains("model-b"));
    }
    @Test public void failingProvidersReturnAnErrorInsteadOfInventingAnAnswer() throws Exception {
        configure();server.enqueue(new MockResponse().setResponseCode(503));server.enqueue(new MockResponse().setResponseCode(429));
        try {AiClient.ask(app,history(),"");fail("Expected a provider error");}
        catch(Exception e){assertTrue(e.getMessage().contains("Provider 1: HTTP 503"));assertTrue(e.getMessage().contains("Provider 2: HTTP 429"));}
    }
    @Test @SdkSuppress(minSdkVersion=29) public void documentIsSentOnlyAfterConsentAndNotStoredInChat() throws Exception {
        configure();app.getSharedPreferences("settings",Context.MODE_PRIVATE).edit().putBoolean("speak",false).commit();
        server.enqueue(new MockResponse().setResponseCode(200).setBody("{\"choices\":[{\"message\":{\"content\":\"Summary from model\"}}]}"));
        String privateText="Unique private document contents";
        ContentValues values=new ContentValues();values.put(MediaStore.MediaColumns.DISPLAY_NAME,"ronny-ai-document.txt");values.put(MediaStore.MediaColumns.MIME_TYPE,"text/plain");
        Uri file=app.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI,values);assertNotNull(file);
        try {
            try(OutputStream out=app.getContentResolver().openOutputStream(file)){assertNotNull(out);out.write(privateText.getBytes(StandardCharsets.UTF_8));}
            Intents.init();
            try {
                intending(hasAction(Intent.ACTION_OPEN_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(file)));
                try(ActivityScenario<MainActivity> scenario=ActivityScenario.launch(MainActivity.class)) {
                    scenario.onActivity(a->{AssistantSmokeTest.click(a,"Documents");AssistantSmokeTest.click(a,"Choose text file");});
                    long deadline=SystemClock.elapsedRealtime()+15000;boolean[] loaded={false};
                    while(SystemClock.elapsedRealtime()<deadline&&!loaded[0]){scenario.onActivity(a->loaded[0]=AssistantSmokeTest.containsText(a.getWindow().getDecorView(),privateText));if(!loaded[0])SystemClock.sleep(200);}
                    assertTrue("File was not displayed",loaded[0]);
                    scenario.onActivity(a->{AssistantSmokeTest.click(a,"Summarize");AssistantSmokeTest.respondToDocumentConsent(a,DialogInterface.BUTTON_NEGATIVE);});
                    assertEquals("Cancellation must not send a provider request",0,server.getRequestCount());
                    scenario.onActivity(a->{AssistantSmokeTest.click(a,"Summarize");AssistantSmokeTest.respondToDocumentConsent(a,DialogInterface.BUTTON_POSITIVE);});
                    RecordedRequest request=server.takeRequest(15,TimeUnit.SECONDS);assertNotNull("No provider request",request);
                    assertTrue("Document excerpt not sent after consent",request.getBody().readUtf8().contains(privateText));
                    long until=SystemClock.elapsedRealtime()+15000;boolean[] answered={false};
                    while(SystemClock.elapsedRealtime()<until&&!answered[0]){scenario.onActivity(a->answered[0]=AssistantSmokeTest.containsText(a.getWindow().getDecorView(),"Summary from model"));if(!answered[0])SystemClock.sleep(200);}
                    assertTrue("AI summary not displayed",answered[0]);
                    String history=app.getSharedPreferences("data",Context.MODE_PRIVATE).getString("history","");
                    assertFalse("Original document should not be persisted to history",history.contains(privateText));
                    assertTrue("Summary should be persisted to history",history.contains("Summary from model"));
                }
            } finally {Intents.release();}
        } finally {app.getContentResolver().delete(file,null,null);}
    }
    @Test public void malformedPrimaryResponseFallsBack() throws Exception {
        configure();server.enqueue(new MockResponse().setResponseCode(200).setBody("{}"));
        server.enqueue(new MockResponse().setResponseCode(200).setBody("{\"choices\":[{\"message\":{\"content\":\"Second provider\"}}]}"));
        assertEquals("Second provider",AiClient.ask(app,history(),""));assertEquals(2,server.getRequestCount());
    }
}
