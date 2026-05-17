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

    @PluginMethod
    public void open(PluginCall call) {
        String url   = call.getString("url",   "https://labs.google/fx/tools/image-fx");
        String title = call.getString("title", "Cinematic Director");

        // Clean up any previous receiver
        unregisterReceiver();

        // Register receiver for events from CineBrowserActivity
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                String event = intent.getStringExtra(CineBrowserActivity.EXTRA_EVENT);
                String path  = intent.getStringExtra(CineBrowserActivity.EXTRA_FILE_PATH);
                String mime  = intent.getStringExtra(CineBrowserActivity.EXTRA_MIME);

                if ("downloaded".equals(event) && path != null && !path.isEmpty()) {
                    // Read file → base64 → send to JS
                    try {
                        byte[] bytes = readFile(new File(path));
                        String b64   = Base64.encodeToString(bytes, Base64.NO_WRAP);
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
                } else {
                    // Browser closed without download
                    notifyListeners("browserClosed", new JSObject());
                }

                unregisterReceiver();
            }
        };

        IntentFilter filter = new IntentFilter(CineBrowserActivity.ACTION_EVENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getContext().registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            getContext().registerReceiver(receiver, filter);
        }

        // Launch the custom browser activity
        Intent i = new Intent(getContext(), CineBrowserActivity.class);
        i.putExtra(CineBrowserActivity.EXTRA_URL,   url);
        i.putExtra(CineBrowserActivity.EXTRA_TITLE, title);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);

        call.resolve();
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
