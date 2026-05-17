import os, sys

path = 'android/app/src/main/java/com/cinematicdirector/app/MainActivity.java'

if not os.path.exists(path):
    print(f'❌ File not found: {path}')
    sys.exit(1)

content = open(path).read()

if 'CineBrowserPlugin' in content:
    print('ℹ️  MainActivity already patched')
    sys.exit(0)

new_content = '''package com.cinematicdirector.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CineBrowserPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
'''

open(path, 'w').write(new_content)
print('✅ MainActivity patched with CineBrowserPlugin')
