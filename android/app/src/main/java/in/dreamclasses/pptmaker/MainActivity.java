package in.dreamclasses.pptmaker;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.MimeTypeMap;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;
import java.util.Locale;

/**
 * Dependency-free native Android host for the Dream Classes web workspace.
 *
 * Local assets are served through the secure appassets.androidplatform.net
 * origin. PDF processing stays on the configured backend; no secret is stored
 * in this APK. The native file chooser and DownloadManager make uploads and
 * exports work like a normal Android application.
 */
public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 4101;
    private static final int STORAGE_PERMISSION_REQUEST = 4102;
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final String HOME_URL = "https://" + ASSET_HOST + "/";

    private WebView webView;
    private ValueCallback<Uri[]> fileChooserCallback;
    private DownloadItem pendingDownload;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        webView.setBackgroundColor(Color.rgb(244, 246, 242));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setDefaultTextEncodingName("UTF-8");
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setBuiltInZoomControls(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        // HTTPS is recommended. Compatibility mode also permits an explicitly
        // configured same-Wi-Fi HTTP backend during local classroom use.
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);

        webView.setWebViewClient(new LocalAssetClient());
        webView.setWebChromeClient(new DreamChromeClient());
        webView.setDownloadListener(new DreamDownloadListener());
        CookieManager.getInstance().setAcceptCookie(true);

        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(HOME_URL);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) webView.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        if (fileChooserCallback != null) {
            fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.setWebChromeClient(null);
            webView.setWebViewClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private final class DreamChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(
                WebView view,
                ValueCallback<Uri[]> callback,
                FileChooserParams params) {
            if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
            fileChooserCallback = callback;

            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/pdf");
            intent.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/pdf"});
            try {
                startActivityForResult(Intent.createChooser(intent, "Select question PDF"), FILE_CHOOSER_REQUEST);
                return true;
            } catch (ActivityNotFoundException firstError) {
                try {
                    Intent fallback = new Intent(Intent.ACTION_GET_CONTENT);
                    fallback.addCategory(Intent.CATEGORY_OPENABLE);
                    fallback.setType("application/pdf");
                    startActivityForResult(Intent.createChooser(fallback, "Select question PDF"), FILE_CHOOSER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException error) {
                    fileChooserCallback.onReceiveValue(null);
                    fileChooserCallback = null;
                    Toast.makeText(MainActivity.this, "No document picker is available.", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (fileChooserCallback != null) {
                Uri[] result = null;
                if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                    result = new Uri[]{data.getData()};
                }
                fileChooserCallback.onReceiveValue(result);
                fileChooserCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    private final class DreamDownloadListener implements DownloadListener {
        @Override
        public void onDownloadStart(
                String url,
                String userAgent,
                String contentDisposition,
                String mimeType,
                long contentLength) {
            DownloadItem item = new DownloadItem(url, userAgent, contentDisposition, mimeType);
            if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P
                    && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                pendingDownload = item;
                requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, STORAGE_PERMISSION_REQUEST);
                return;
            }
            enqueueDownload(item);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == STORAGE_PERMISSION_REQUEST) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED && pendingDownload != null) {
                enqueueDownload(pendingDownload);
            } else {
                Toast.makeText(this, "Storage permission is needed to save this file.", Toast.LENGTH_LONG).show();
            }
            pendingDownload = null;
        }
    }

    private void enqueueDownload(DownloadItem item) {
        try {
            String fileName = URLUtil.guessFileName(item.url, item.contentDisposition, item.mimeType);
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(item.url));
            request.setTitle(fileName);
            request.setDescription("Dream Classes classroom export");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.addRequestHeader("User-Agent", item.userAgent);
            String cookie = CookieManager.getInstance().getCookie(item.url);
            if (cookie != null) request.addRequestHeader("Cookie", cookie);
            if (item.mimeType != null && !item.mimeType.isEmpty()) request.setMimeType(item.mimeType);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            request.allowScanningByMediaScanner();
            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager == null) throw new IllegalStateException("Download service unavailable");
            manager.enqueue(request);
            Toast.makeText(this, "Downloading " + fileName + " to Downloads", Toast.LENGTH_LONG).show();
        } catch (Exception error) {
            Toast.makeText(this, "Could not download: " + error.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    private static final class DownloadItem {
        final String url;
        final String userAgent;
        final String contentDisposition;
        final String mimeType;

        DownloadItem(String url, String userAgent, String contentDisposition, String mimeType) {
            this.url = url;
            this.userAgent = userAgent == null ? "DreamClassesAndroid" : userAgent;
            this.contentDisposition = contentDisposition;
            this.mimeType = mimeType;
        }
    }

    private final class LocalAssetClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (uri == null || !ASSET_HOST.equals(uri.getHost())) return null;
            String path = uri.getPath();
            if (path == null || path.isEmpty()) path = "/";
            if (path.contains("..")) return emptyResponse(400, "Bad path");

            if (path.startsWith("/api/")) {
                String message = "{\"detail\":\"Backend not connected. Open Settings and set your server URL.\"}";
                return new WebResourceResponse(
                        "application/json", "UTF-8", 503, "Service Unavailable",
                        Collections.singletonMap("Cache-Control", "no-store"),
                        new ByteArrayInputStream(message.getBytes()));
            }

            // Extensionless paths are React Router routes and use the SPA shell.
            String lastSegment = uri.getLastPathSegment();
            if (path.equals("/") || lastSegment == null || !lastSegment.contains(".")) path = "/index.html";
            String assetPath = "public" + path;
            try {
                InputStream stream = getAssets().open(assetPath);
                String mime = mimeFor(path);
                boolean textual = mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") || mime.contains("xml");
                return new WebResourceResponse(
                        mime, textual ? "UTF-8" : null, 200, "OK",
                        Collections.singletonMap("Cache-Control", "no-cache"), stream);
            } catch (IOException error) {
                return emptyResponse(404, "Not found");
            }
        }

        private WebResourceResponse emptyResponse(int status, String message) {
            return new WebResourceResponse(
                    "text/plain", "UTF-8", status, message,
                    Collections.singletonMap("Cache-Control", "no-store"),
                    new ByteArrayInputStream(new byte[0]));
        }

        private String mimeFor(String path) {
            String extension = MimeTypeMap.getFileExtensionFromUrl(path).toLowerCase(Locale.ROOT);
            if (extension.equals("js")) return "application/javascript";
            if (extension.equals("woff")) return "font/woff";
            if (extension.equals("woff2")) return "font/woff2";
            if (extension.equals("html")) return "text/html";
            String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
            return mime == null ? "application/octet-stream" : mime;
        }
    }
}
