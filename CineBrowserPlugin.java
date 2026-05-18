package com.cinematicdirector.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

@CapacitorPlugin(name = "CineBrowser")
public class CineBrowserPlugin extends Plugin {

    private BroadcastReceiver receiver;
    private boolean browserAlive = false; // true while Activity is open or minimized

    @PluginMethod
    public void open(PluginCall call) {
        String url   = call.getString("url",   "https://labs.google/fx/tools/image-fx");
        String title = call.getString("title", "Cinematic Director");

        // Register a fresh receiver (unregister any stale one first)
        if (!browserAlive) {
            unregisterReceiver();
            registerEventReceiver();
        }

        // Launch (or bring-to-front if already minimized via singleTask + REORDER_TO_FRONT)
        Intent i = new Intent(getContext(), CineBrowserActivity.class);
        i.putExtra(CineBrowserActivity.EXTRA_URL,   url);
        i.putExtra(CineBrowserActivity.EXTRA_TITLE, title);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        getContext().startActivity(i);

        browserAlive = true;
        call.resolve();
    }

    /**
     * Bring a minimized browser back to front without reloading.
     * Call this instead of open() when browserAlive is true and you just
     * want to un-hide the browser (e.g., user taps "Generate Frame" again
     * for a scene that already has a session in progress).
     */
    @PluginMethod
    public void show(PluginCall call) {
        if (!browserAlive) {
            // Browser was closed — fall back to open()
            call.reject("browser_not_alive");
            return;
        }
        Intent i = new Intent(getContext(), CineBrowserActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        getContext().startActivity(i);
        call.resolve();
    }

    private void registerEventReceiver() {
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                String event = intent.getStringExtra(CineBrowserActivity.EXTRA_EVENT);
                String path  = intent.getStringExtra(CineBrowserActivity.EXTRA_FILE_PATH);
                String mime  = intent.getStringExtra(CineBrowserActivity.EXTRA_MIME);

                if ("downloaded".equals(event) && path != null && !path.isEmpty()) {
                    try {
                        byte[] bytes  = readFile(new File(path));
                        String b64    = Base64.encodeToString(bytes, Base64.NO_WRAP);
                        String dataUrl = "data:" + mime + ";base64," + b64;

                        JSObject result = new JSObject();
                        result.put("dataUrl",  dataUrl);
                        result.put("mimeType", mime);
                        result.put("path",     path);
                        notifyListeners("fileDownloaded", result);
                    } catch (IOException e) {
                        JSObject err = new JSObject();
                        err.put("message", e.getMessage());
                        notifyListeners("downloadError", err);
                    }
                    // After a successful download the Activity closes itself,
                    // so the browser is no longer alive.
                    browserAlive = false;
                    unregisterReceiver();

                } else if ("minimized".equals(event)) {
                    // Browser is hidden but WebView is still alive — keep receiver registered
                    // so we can catch a future download event.
                    JSObject payload = new JSObject();
                    notifyListeners("browserMinimized", payload);
                    // browserAlive stays true

                } else if ("closed".equals(event)) {
                    browserAlive = false;
                    notifyListeners("browserClosed", new JSObject());
                    unregisterReceiver();

                } else {
                    // Unexpected / unknown event — treat as closed
                    browserAlive = false;
                    notifyListeners("browserClosed", new JSObject());
                    unregisterReceiver();
                }
            }
        };

        IntentFilter filter = new IntentFilter(CineBrowserActivity.ACTION_EVENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(receiver, filter);
        }
    }

    private void unregisterReceiver() {
        if (receiver != null) {
            try { getContext().unregisterReceiver(receiver); } catch (Exception ignored) {}
            receiver = null;
        }
    }

    private byte[] readFile(File file) throws IOException {
        FileInputStream fis = new FileInputStream(file);
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = fis.read(buf)) != -1) bos.write(buf, 0, n);
        fis.close();
        return bos.toByteArray();
    }

    @Override
    protected void handleOnDestroy() {
        unregisterReceiver();
        super.handleOnDestroy();
    }
}
