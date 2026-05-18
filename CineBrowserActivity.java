package com.cinematicdirector.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.DownloadListener;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class CineBrowserActivity extends Activity {

    public static final String EXTRA_URL       = "cine_url";
    public static final String EXTRA_TITLE     = "cine_title";
    public static final String ACTION_EVENT    = "com.cinematicdirector.CINE_EVENT";
    public static final String EXTRA_EVENT     = "event";       // "downloaded" | "closed"
    public static final String EXTRA_FILE_PATH = "file_path";
    public static final String EXTRA_MIME      = "mime_type";

    private WebView     webView;
    private ProgressBar progress;
    private TextView    urlLabel;
    private TextView    backBtn;
    private TextView    fwdBtn;

    // dp → px helper
    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, v,
            getResources().getDisplayMetrics()));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Full-screen, status bar matches toolbar
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                             WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().setStatusBarColor(Color.parseColor("#0a0a0f"));

        String startUrl = getIntent().getStringExtra(EXTRA_URL);

        /* ── ROOT ─────────────────────────────────────────────────── */
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#070709"));

        /* ── TOOLBAR ──────────────────────────────────────────────── */
        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setBackgroundColor(Color.parseColor("#0a0a0f"));
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(8), dp(6), dp(8), dp(6));
        toolbar.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(52)));

        // ← back
        backBtn = makeToolbarBtn("←");
        backBtn.setOnClickListener(v -> { if (webView.canGoBack()) webView.goBack(); });

        // → forward
        fwdBtn = makeToolbarBtn("→");
        fwdBtn.setOnClickListener(v -> { if (webView.canGoForward()) webView.goForward(); });

        // URL label (centre, flexible)
        urlLabel = new TextView(this);
        urlLabel.setTextColor(Color.parseColor("#64748b"));
        urlLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        urlLabel.setMaxLines(1);
        urlLabel.setPadding(dp(8), 0, dp(8), 0);
        urlLabel.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams urlLp =
            new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        urlLabel.setLayoutParams(urlLp);

        // ✓ Done
        TextView doneBtn = makeToolbarBtn("✓  Done");
        doneBtn.setTextColor(Color.parseColor("#22d3ee"));
        doneBtn.setOnClickListener(v -> finish());

        toolbar.addView(backBtn);
        toolbar.addView(fwdBtn);
        toolbar.addView(urlLabel);
        toolbar.addView(doneBtn);

        /* ── PROGRESS BAR ─────────────────────────────────────────── */
        progress = new ProgressBar(this, null,
            android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgressTintList(
            android.content.res.ColorStateList.valueOf(Color.parseColor("#22d3ee")));
        progress.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(3)));
        progress.setVisibility(View.INVISIBLE);

        /* ── WEBVIEW ──────────────────────────────────────────────── */
        webView = new WebView(this);
        webView.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f));
        webView.setBackgroundColor(Color.parseColor("#070709"));

        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setLoadWithOverviewMode(true);
        ws.setUseWideViewPort(true);
        ws.setSupportZoom(true);
        ws.setBuiltInZoomControls(true);
        ws.setDisplayZoomControls(false);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        ws.setAllowFileAccess(true);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        // Chrome UA — required for Google OAuth / ImageFX login
        ws.setUserAgentString(
            "Mozilla/5.0 (Linux; Android 10; Mobile) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/124.0.0.0 Mobile Safari/537.36");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int p) {
                progress.setProgress(p);
                progress.setVisibility(p == 100 ? View.INVISIBLE : View.VISIBLE);
            }
            @Override
            public void onReceivedTitle(WebView view, String title) {
                updateUrlLabel(view.getUrl());
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                updateUrlLabel(url);
                backBtn.setAlpha(view.canGoBack()    ? 1f : 0.3f);
                fwdBtn.setAlpha( view.canGoForward() ? 1f : 0.3f);
            }
        });

        /* ── DOWNLOAD INTERCEPTION ────────────────────────────────── */
        // JavaScript bridge so JS can send blob data back to Java
        webView.addJavascriptInterface(new Object() {
            @android.webkit.JavascriptInterface
            public void onBlobReady(String base64Data, String mimeType) {
                // Check for error signal
                if (mimeType != null && mimeType.startsWith("error:")) {
                    String msg = mimeType.substring(6);
                    runOnUiThread(() -> Toast.makeText(CineBrowserActivity.this,
                        "❌ Blob read failed: " + msg, Toast.LENGTH_LONG).show());
                    return;
                }
                if (base64Data == null || base64Data.isEmpty()) {
                    runOnUiThread(() -> Toast.makeText(CineBrowserActivity.this,
                        "❌ Empty data received", Toast.LENGTH_LONG).show());
                    return;
                }
                String safeMime = (mimeType != null && !mimeType.isEmpty()) ? mimeType : "image/jpeg";
                saveBase64ToFile(base64Data, safeMime);
            }
        }, "CineBridge");

        webView.setDownloadListener((dlUrl, ua, contentDisposition, mime, len) -> {
            // Detect mime type from URL if not provided
            String safeMime = guessMime(dlUrl, mime);
            Toast.makeText(this, "⬇  Saving to Cinematic Director…", Toast.LENGTH_SHORT).show();

            if (dlUrl.startsWith("blob:")) {
                // ── BLOB URL ─────────────────────────────────────────
                // Lives only in JS memory — inject XHR to read it and pass base64 back to Java
                String escapedUrl = dlUrl.replace("'", "\'");
                String escapedMime = safeMime.replace("'", "\'");
                String js = "(function() {" +
                    "try {" +
                    "  var xhr = new XMLHttpRequest();" +
                    "  xhr.open('GET', '" + escapedUrl + "', true);" +
                    "  xhr.responseType = 'blob';" +
                    "  xhr.onload = function() {" +
                    "    var reader = new FileReader();" +
                    "    reader.onloadend = function() {" +
                    "      var b64 = reader.result.split(',')[1];" +
                    "      var mt = xhr.response.type || '" + escapedMime + "';" +
                    "      CineBridge.onBlobReady(b64, mt);" +
                    "    };" +
                    "    reader.onerror = function() {" +
                    "      CineBridge.onBlobReady(null, 'error:FileReader failed');" +
                    "    };" +
                    "    reader.readAsDataURL(xhr.response);" +
                    "  };" +
                    "  xhr.onerror = function() {" +
                    "    CineBridge.onBlobReady(null, 'error:XHR failed');" +
                    "  };" +
                    "  xhr.send();" +
                    "} catch(e) {" +
                    "  CineBridge.onBlobReady(null, 'error:' + e.toString());" +
                    "}" +
                    "})();";
                webView.evaluateJavascript(js, null);

            } else if (dlUrl.startsWith("data:")) {
                // ── DATA URL ─────────────────────────────────────────
                // Already base64 encoded inline — extract and save directly
                new Thread(() -> {
                    try {
                        String[] parts = dlUrl.split(",", 2);
                        if (parts.length < 2) throw new Exception("Invalid data URL");
                        String header = parts[0]; // e.g. "data:image/png;base64"
                        String b64    = parts[1];
                        String detectedMime = header.contains(":") && header.contains(";")
                            ? header.split(":")[1].split(";")[0]
                            : safeMime;
                        saveBase64ToFile(b64, detectedMime);
                    } catch (Exception e) {
                        runOnUiThread(() -> Toast.makeText(this,
                            "❌ data: save failed: " + e.getMessage(), Toast.LENGTH_LONG).show());
                    }
                }).start();

            } else if (dlUrl.startsWith("http://") || dlUrl.startsWith("https://")) {
                // ── HTTP/HTTPS URL ───────────────────────────────────
                // Standard download — fetch with HttpURLConnection
                new Thread(() -> downloadFile(dlUrl, ua, safeMime)).start();

            } else if (dlUrl.startsWith("intent:")) {
                // ── ANDROID INTENT URL ───────────────────────────────
                // Extract fallback URL from intent and download that
                try {
                    String fallback = "";
                    for (String part : dlUrl.split(";")) {
                        if (part.startsWith("S.browser_fallback_url=")) {
                            fallback = java.net.URLDecoder.decode(
                                part.substring("S.browser_fallback_url=".length()), "UTF-8");
                            break;
                        }
                    }
                    if (!fallback.isEmpty()) {
                        final String fbUrl = fallback;
                        new Thread(() -> downloadFile(fbUrl, ua, safeMime)).start();
                    } else {
                        runOnUiThread(() -> Toast.makeText(this,
                            "⚠️ Cannot handle intent URL", Toast.LENGTH_SHORT).show());
                    }
                } catch (Exception e) {
                    runOnUiThread(() -> Toast.makeText(this,
                        "❌ intent: error: " + e.getMessage(), Toast.LENGTH_LONG).show());
                }

            } else {
                // ── UNKNOWN FORMAT ───────────────────────────────────
                // Try HTTP download anyway — some URLs use custom schemes
                // that resolve to HTTP redirects
                runOnUiThread(() -> Toast.makeText(this,
                    "⚠️ Unknown URL type, trying download…", Toast.LENGTH_SHORT).show());
                new Thread(() -> downloadFile(dlUrl, ua, safeMime)).start();
            }
        });

        /* ── ASSEMBLE ─────────────────────────────────────────────── */
        root.addView(toolbar);
        root.addView(progress);
        root.addView(webView);
        setContentView(root);

        if (startUrl != null) webView.loadUrl(startUrl);
    }

    /* ── HELPERS ────────────────────────────────────────────────────── */

    private TextView makeToolbarBtn(String label) {
        TextView tv = new TextView(this);
        tv.setText(label);
        tv.setTextColor(Color.parseColor("#94a3b8"));
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        tv.setPadding(dp(12), dp(8), dp(12), dp(8));
        tv.setGravity(Gravity.CENTER);
        return tv;
    }

    private void updateUrlLabel(String url) {
        if (url == null) return;
        try { urlLabel.setText(Uri.parse(url).getHost()); }
        catch (Exception ignored) { urlLabel.setText(url); }
    }

    // ── HELPERS ──────────────────────────────────────────────────────────────

    /** Guess mime type from URL extension when server doesn't provide one */
    private String guessMime(String url, String serverMime) {
        if (serverMime != null && !serverMime.isEmpty()
                && !serverMime.equals("application/octet-stream")) {
            return serverMime;
        }
        String u = url.toLowerCase().split("[?]")[0].split("#")[0];
        if (u.endsWith(".png"))  return "image/png";
        if (u.endsWith(".webp")) return "image/webp";
        if (u.endsWith(".gif"))  return "image/gif";
        if (u.endsWith(".mp4"))  return "video/mp4";
        if (u.endsWith(".webm")) return "video/webm";
        if (u.endsWith(".mov"))  return "video/quicktime";
        if (u.endsWith(".mp3"))  return "audio/mpeg";
        if (u.endsWith(".pdf"))  return "application/pdf";
        if (u.endsWith(".zip"))  return "application/zip";
        if (u.endsWith(".jpg") || u.endsWith(".jpeg")) return "image/jpeg";
        return serverMime != null ? serverMime : "application/octet-stream";
    }

    /** Get file extension from mime type */
    private String extFromMime(String mime) {
        if (mime == null) return ".bin";
        if (mime.contains("png"))       return ".png";
        if (mime.contains("webp"))      return ".webp";
        if (mime.contains("gif"))       return ".gif";
        if (mime.contains("mp4"))       return ".mp4";
        if (mime.contains("webm"))      return ".webm";
        if (mime.contains("quicktime")) return ".mov";
        if (mime.contains("mpeg"))      return ".mp3";
        if (mime.contains("pdf"))       return ".pdf";
        if (mime.contains("zip"))       return ".zip";
        if (mime.contains("jpeg") || mime.contains("jpg")) return ".jpg";
        return ".bin";
    }

    /** Decode base64 string, save to app-private cine_downloads folder, broadcast result */
    private void saveBase64ToFile(String base64Data, String mime) {
        new Thread(() -> {
            try {
                byte[] bytes = android.util.Base64.decode(
                    base64Data, android.util.Base64.DEFAULT);
                File dir = new File(getFilesDir(), "cine_downloads");
                if (!dir.exists()) dir.mkdirs();
                File out = new File(dir, "cine_" + System.currentTimeMillis() + extFromMime(mime));
                java.io.FileOutputStream fos = new java.io.FileOutputStream(out);
                fos.write(bytes);
                fos.close();
                runOnUiThread(() -> {
                    Toast.makeText(CineBrowserActivity.this,
                        "✅  Saved to Cinematic Director!", Toast.LENGTH_SHORT).show();
                    broadcast("downloaded", out.getAbsolutePath(), mime);
                    finish();
                });
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(CineBrowserActivity.this,
                    "❌ Save failed: " + e.getMessage(), Toast.LENGTH_LONG).show());
            }
        }).start();
    }

    private void downloadFile(String dlUrl, String ua, String mime) {
        try {
            URL fileUrl = new URL(dlUrl);
            HttpURLConnection conn = (HttpURLConnection) fileUrl.openConnection();
            conn.setRequestProperty("User-Agent", ua != null ? ua :
                "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 Chrome/124.0.0.0");
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            conn.connect();

            // Detect mime from Content-Type header if not already known
            String ct = conn.getContentType();
            String finalMime = (ct != null && !ct.isEmpty()) ? ct.split(";")[0].trim() : mime;
            finalMime = guessMime(dlUrl, finalMime);

            File dir = new File(getFilesDir(), "cine_downloads");
            if (!dir.exists()) dir.mkdirs();
            File out = new File(dir, "cine_" + System.currentTimeMillis() + extFromMime(finalMime));

            InputStream in = conn.getInputStream();
            FileOutputStream fos = new FileOutputStream(out);
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) fos.write(buf, 0, n);
            in.close();
            fos.close();
            conn.disconnect();

            final String savedMime = finalMime;
            runOnUiThread(() -> {
                Toast.makeText(this, "✅  Saved to Cinematic Director!", Toast.LENGTH_SHORT).show();
                broadcast("downloaded", out.getAbsolutePath(), savedMime);
                finish();
            });

        } catch (Exception e) {
            runOnUiThread(() -> Toast.makeText(this,
                "❌ Download failed: " + e.getMessage(), Toast.LENGTH_LONG).show());
        }
    }

    private void broadcast(String event, String path, String mime) {
        Intent i = new Intent(ACTION_EVENT);
        i.putExtra(EXTRA_EVENT,     event);
        i.putExtra(EXTRA_FILE_PATH, path != null ? path : "");
        i.putExtra(EXTRA_MIME,      mime  != null ? mime  : "");
        sendBroadcast(i);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else finish();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        // Always broadcast close so plugin can clean up
        broadcast("closed", "", "");
    }
}
