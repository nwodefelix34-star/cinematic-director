package com.cinematicdirector.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashSet;

public class CineBrowserActivity extends Activity {

    public static final String EXTRA_URL       = "cine_url";
    public static final String EXTRA_TITLE     = "cine_title";
    public static final String ACTION_EVENT    = "com.cinematicdirector.CINE_EVENT";
    public static final String EXTRA_EVENT     = "event";
    public static final String EXTRA_FILE_PATH = "file_path";
    public static final String EXTRA_MIME      = "mime_type";

    // ─────────────────────────────────────────────────────────────────────────
    // BLOB STORE INJECTION (injected via addDocumentStartJavaScript so it runs
    // BEFORE any page JS — bypasses ImageFX's connect-src CSP entirely).
    // ─────────────────────────────────────────────────────────────────────────
    private static final String BLOB_STORE_JS =
        "(function() {" +
        "  if (window.__CineBlobStoreInstalled) return;" +
        "  window.__CineBlobStoreInstalled = true;" +
        "  window.__cineBlobStore = {};" +
        "  var _orig = URL.createObjectURL.bind(URL);" +
        "  URL.createObjectURL = function(blob) {" +
        "    var url = _orig(blob);" +
        "    window.__cineBlobStore[url] = blob;" +
        "    return url;" +
        "  };" +
        "  var _rev = URL.revokeObjectURL.bind(URL);" +
        "  URL.revokeObjectURL = function(url) {" +
        "    delete window.__cineBlobStore[url];" +
        "    _rev(url);" +
        "  };" +
        "})();";

    private WebView     webView;
    private ProgressBar progress;
    private TextView    urlLabel;
    private TextView    backBtn;
    private TextView    fwdBtn;

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP, v,
            getResources().getDisplayMetrics()));
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN,
                             WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().setStatusBarColor(Color.parseColor("#0a0a0f"));

        String startUrl = getIntent().getStringExtra(EXTRA_URL);

        /* ── ROOT ──────────────────────────────────────────────── */
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#070709"));

        /* ── TOOLBAR ───────────────────────────────────────────── */
        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setBackgroundColor(Color.parseColor("#0a0a0f"));
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(8), dp(6), dp(8), dp(6));
        toolbar.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(52)));

        backBtn = makeToolbarBtn("←");
        backBtn.setOnClickListener(v -> { if (webView.canGoBack()) webView.goBack(); });

        fwdBtn = makeToolbarBtn("→");
        fwdBtn.setOnClickListener(v -> { if (webView.canGoForward()) webView.goForward(); });

        // Reload
        TextView reloadBtn = makeToolbarBtn("↻");
        reloadBtn.setOnClickListener(v -> webView.reload());

        urlLabel = new TextView(this);
        urlLabel.setTextColor(Color.parseColor("#64748b"));
        urlLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        urlLabel.setMaxLines(1);
        urlLabel.setPadding(dp(6), 0, dp(6), 0);
        urlLabel.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams urlLp =
            new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f);
        urlLabel.setLayoutParams(urlLp);

        // Hide — minimizes browser, keeps WebView alive in its own task
        TextView minBtn = makeToolbarBtn("⊟");
        minBtn.setTextColor(Color.parseColor("#94a3b8"));
        minBtn.setOnClickListener(v -> minimizeBrowser());

        // Done — fully closes this browser Activity
        TextView doneBtn = makeToolbarBtn("✓");
        doneBtn.setTextColor(Color.parseColor("#22d3ee"));
        doneBtn.setOnClickListener(v -> finish());

        toolbar.addView(backBtn);
        toolbar.addView(fwdBtn);
        toolbar.addView(reloadBtn);
        toolbar.addView(urlLabel);
        toolbar.addView(minBtn);
        toolbar.addView(doneBtn);

        /* ── PROGRESS BAR ──────────────────────────────────────── */
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setProgressTintList(
            android.content.res.ColorStateList.valueOf(Color.parseColor("#22d3ee")));
        progress.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(3)));
        progress.setVisibility(View.INVISIBLE);

        /* ── WEBVIEW ───────────────────────────────────────────── */
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
        // Chrome UA — required for Google OAuth and ImageFX
        ws.setUserAgentString(
            "Mozilla/5.0 (Linux; Android 10; Mobile) " +
            "AppleWebKit/537.36 (KHTML, like Gecko) " +
            "Chrome/124.0.0.0 Mobile Safari/537.36");

        // ── TRUE DOCUMENT-START INJECTION via androidx.webkit ──────────────
        // WebViewCompat.addDocumentStartJavaScript() runs our script
        // synchronously BEFORE any page JS, so the createObjectURL override
        // is always in place before ImageFX's code runs.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            WebViewCompat.addDocumentStartJavaScript(webView, BLOB_STORE_JS,
                new HashSet<>(java.util.Arrays.asList("*")));
        }

        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int p) {
                progress.setProgress(p);
                progress.setVisibility(p == 100 ? View.INVISIBLE : View.VISIBLE);
            }
            @Override public void onReceivedTitle(WebView view, String title) {
                updateUrlLabel(view.getUrl());
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap fav) {
                // Fallback injection for older WebView versions that don't support
                // addDocumentStartJavaScript (evaluateJavascript is still async but
                // better than nothing on older devices).
                if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
                    view.evaluateJavascript(BLOB_STORE_JS, null);
                }
            }
            @Override
            public void onPageFinished(WebView view, String url) {
                // Re-apply on SPA navigation (pushState doesn't trigger onPageStarted)
                view.evaluateJavascript(BLOB_STORE_JS, null);
                updateUrlLabel(url);
                backBtn.setAlpha(view.canGoBack()    ? 1f : 0.3f);
                fwdBtn.setAlpha( view.canGoForward() ? 1f : 0.3f);
            }
        });

        /* ── JAVASCRIPT BRIDGE ─────────────────────────────────── */
        webView.addJavascriptInterface(new Object() {
            @android.webkit.JavascriptInterface
            public void onBlobReady(String base64Data, String mimeType) {
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

        /* ── DOWNLOAD INTERCEPTION ─────────────────────────────── */
        webView.setDownloadListener((dlUrl, ua, contentDisposition, mime, len) -> {
            String safeMime = guessMime(dlUrl, mime);
            Toast.makeText(this, "⬇  Saving to Cinematic Director…", Toast.LENGTH_SHORT).show();

            if (dlUrl.startsWith("blob:")) {
                String esc  = dlUrl.replace("\\", "\\\\").replace("'", "\\'");
                String escM = safeMime.replace("'", "\\'");
                // Primary: read from our blob store (no network, no CSP issue)
                // Fallback: fetch() in case store was missed
                String js =
                    "(function() {" +
                    "  try {" +
                    "    var b = window.__cineBlobStore && window.__cineBlobStore['" + esc + "'];" +
                    "    if (b) {" +
                    "      var r = new FileReader();" +
                    "      r.onloadend = function() { CineBridge.onBlobReady(r.result.split(',')[1], b.type || '" + escM + "'); };" +
                    "      r.onerror   = function() { CineBridge.onBlobReady(null, 'error:FileReader failed'); };" +
                    "      r.readAsDataURL(b);" +
                    "    } else {" +
                    "      fetch('" + esc + "')" +
                    "        .then(function(res) { return res.blob(); })" +
                    "        .then(function(b2) {" +
                    "          var r2 = new FileReader();" +
                    "          r2.onloadend = function() { CineBridge.onBlobReady(r2.result.split(',')[1], b2.type || '" + escM + "'); };" +
                    "          r2.onerror   = function() { CineBridge.onBlobReady(null, 'error:FileReader(fetch) failed'); };" +
                    "          r2.readAsDataURL(b2);" +
                    "        })" +
                    "        .catch(function(e) { CineBridge.onBlobReady(null, 'error:fetch: ' + e.message); });" +
                    "    }" +
                    "  } catch(e) { CineBridge.onBlobReady(null, 'error:' + e.toString()); }" +
                    "})();";
                webView.evaluateJavascript(js, null);

            } else if (dlUrl.startsWith("data:")) {
                new Thread(() -> {
                    try {
                        String[] parts = dlUrl.split(",", 2);
                        if (parts.length < 2) throw new Exception("Invalid data URL");
                        String header = parts[0];
                        String b64    = parts[1];
                        String detectedMime = header.contains(":") && header.contains(";")
                            ? header.split(":")[1].split(";")[0] : safeMime;
                        saveBase64ToFile(b64, detectedMime);
                    } catch (Exception e) {
                        runOnUiThread(() -> Toast.makeText(this,
                            "❌ data: save failed: " + e.getMessage(), Toast.LENGTH_LONG).show());
                    }
                }).start();

            } else if (dlUrl.startsWith("http://") || dlUrl.startsWith("https://")) {
                new Thread(() -> downloadFile(dlUrl, ua, safeMime)).start();

            } else if (dlUrl.startsWith("intent:")) {
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
                        final String fb = fallback;
                        new Thread(() -> downloadFile(fb, ua, safeMime)).start();
                    } else {
                        runOnUiThread(() -> Toast.makeText(this,
                            "⚠️ Cannot handle intent URL", Toast.LENGTH_SHORT).show());
                    }
                } catch (Exception e) {
                    runOnUiThread(() -> Toast.makeText(this,
                        "❌ intent: error: " + e.getMessage(), Toast.LENGTH_LONG).show());
                }
            } else {
                new Thread(() -> downloadFile(dlUrl, ua, safeMime)).start();
            }
        });

        /* ── ASSEMBLE ──────────────────────────────────────────── */
        root.addView(toolbar);
        root.addView(progress);
        root.addView(webView);
        setContentView(root);

        if (startUrl != null) webView.loadUrl(startUrl);
    }

    /** Called when the Activity is re-launched via REORDER_TO_FRONT (singleTask). */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String newUrl = intent.getStringExtra(EXTRA_URL);
        if (newUrl != null && !newUrl.isEmpty() && webView != null) {
            String current = webView.getUrl();
            if (!newUrl.equals(current)) {
                webView.loadUrl(newUrl);
            }
            // If same URL — just bring to front, don't reload. Session preserved.
        }
    }

    /**
     * Hides this Activity WITHOUT destroying the WebView.
     * Because taskAffinity="" puts us in a separate task, moveTaskToBack(true)
     * only backgrounds the BROWSER task — the main app stays fully active.
     */
    private void minimizeBrowser() {
        broadcast("minimized", "", "");
        moveTaskToBack(true);
    }

    /* ── PRIVATE HELPERS ─────────────────────────────────────────── */

    private TextView makeToolbarBtn(String label) {
        TextView tv = new TextView(this);
        tv.setText(label);
        tv.setTextColor(Color.parseColor("#94a3b8"));
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        tv.setPadding(dp(10), dp(8), dp(10), dp(8));
        tv.setGravity(Gravity.CENTER);
        return tv;
    }

    private void updateUrlLabel(String url) {
        if (url == null) return;
        try { urlLabel.setText(Uri.parse(url).getHost()); }
        catch (Exception ignored) { urlLabel.setText(url); }
    }

    private String guessMime(String url, String serverMime) {
        if (serverMime != null && !serverMime.isEmpty()
                && !serverMime.equals("application/octet-stream")) return serverMime;
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

    private void saveBase64ToFile(String base64Data, String mime) {
        new Thread(() -> {
            try {
                byte[] bytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
                File dir = new File(getFilesDir(), "cine_downloads");
                if (!dir.exists()) dir.mkdirs();
                File out = new File(dir, "cine_" + System.currentTimeMillis() + extFromMime(mime));
                FileOutputStream fos = new FileOutputStream(out);
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
            in.close(); fos.close();
            conn.disconnect();

            final String savedMime = finalMime;
            runOnUiThread(() -> {
                Toast.makeText(this, "✅  Saved!", Toast.LENGTH_SHORT).show();
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
        else minimizeBrowser(); // back = minimize, preserves session
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        broadcast("closed", "", "");
    }
}
