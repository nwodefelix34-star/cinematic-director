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
        webView.setDownloadListener((dlUrl, ua, contentDisposition, mime, len) -> {
            Toast.makeText(this, "⬇  Saving to Cinematic Director…", Toast.LENGTH_SHORT).show();
            String finalMime = mime != null && !mime.isEmpty() ? mime : "image/jpeg";
            new Thread(() -> downloadFile(dlUrl, ua, finalMime)).start();
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

    private void downloadFile(String dlUrl, String ua, String mime) {
        try {
            URL fileUrl = new URL(dlUrl);
            HttpURLConnection conn = (HttpURLConnection) fileUrl.openConnection();
            conn.setRequestProperty("User-Agent", ua);
            conn.setInstanceFollowRedirects(true);
            conn.connect();

            // Choose extension from mime type
            String ext = ".jpg";
            if      (mime.contains("png"))  ext = ".png";
            else if (mime.contains("webp")) ext = ".webp";
            else if (mime.contains("mp4"))  ext = ".mp4";
            else if (mime.contains("webm")) ext = ".webm";
            else if (mime.contains("mov"))  ext = ".mov";

            // Save to app-private folder — invisible to file managers
            File dir = new File(getFilesDir(), "cine_downloads");
            if (!dir.exists()) dir.mkdirs();
            File out = new File(dir, "cine_" + System.currentTimeMillis() + ext);

            InputStream in = conn.getInputStream();
            FileOutputStream fos = new FileOutputStream(out);
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) fos.write(buf, 0, n);
            in.close();
            fos.close();
            conn.disconnect();

            // Notify plugin and close browser
            runOnUiThread(() -> {
                Toast.makeText(this, "✅  Imported!", Toast.LENGTH_SHORT).show();
                broadcast("downloaded", out.getAbsolutePath(), mime);
                finish();
            });

        } catch (Exception e) {
            runOnUiThread(() -> {
                Toast.makeText(this, "❌  Download failed: " + e.getMessage(),
                    Toast.LENGTH_LONG).show();
            });
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
