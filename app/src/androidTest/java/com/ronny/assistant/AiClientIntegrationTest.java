package com.ronny.assistant;

import static org.junit.Assert.*;
import android.content.Context;
import androidx.test.ext.junit.runners.AndroidJUnit4;
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
    @Test public void malformedPrimaryResponseFallsBack() throws Exception {
        configure();server.enqueue(new MockResponse().setResponseCode(200).setBody("{}"));
        server.enqueue(new MockResponse().setResponseCode(200).setBody("{\"choices\":[{\"message\":{\"content\":\"Second provider\"}}]}"));
        assertEquals("Second provider",AiClient.ask(app,history(),""));assertEquals(2,server.getRequestCount());
    }
}
