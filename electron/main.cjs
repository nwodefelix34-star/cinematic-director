// ═══════════════════════════════════════════════════════════
// CINEMATIC DIRECTOR — ELECTRON MAIN PROCESS
//
// What this file does:
// - Creates the main app window (your React app runs here)
// - Creates a WebContentsView = a REAL embedded Chromium browser
//   that lives INSIDE the app window on the right half
// - The embedded browser keeps cookies / sessions → user stays
//   logged into ImageFX and Hunyuan across every use
// - Downloads from the embedded browser are intercepted and
//   sent straight back to the React app via IPC — no manual
//   upload step needed
// ═══════════════════════════════════════════════════════════

'use strict';

const { app, BrowserWindow, ipcMain, WebContentsView, Menu } = require('electron');
const path  = require('path');
const fs    = require('fs');
const os    = require('os');

const isDev   = !app.isPackaged;
const VITE_PORT = 5000;

let mainWindow  = null;
let bridgeView  = null;   // the embedded real browser
let bridgeShown = false;

// ── Window creation ──────────────────────────────────────────
function createWindow () {
  mainWindow = new BrowserWindow({
    width:          1600,
    height:         960,
    minWidth:       1100,
    minHeight:      700,
    backgroundColor: '#0a0a0f',
    // Clean frameless look on macOS, native frame on Windows
    titleBarStyle:  process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload:          path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration:  false,
      sandbox:          false,         // needed so preload can use require
    }
  });

  // Remove default menu bar (keeps shortcuts like Ctrl+R working)
  Menu.setApplicationMenu(null);

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${VITE_PORT}`);
    // mainWindow.webContents.openDevTools({ mode: 'detach' }); // uncomment to debug
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Keep bridge view sized correctly when user resizes the window
  mainWindow.on('resize', () => {
    if (bridgeShown && bridgeView) repositionBridge();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Bridge panel positioning ─────────────────────────────────
// The bridge panel occupies the RIGHT 50% of the content area.
// The React app still renders full-width underneath — the right
// half is just covered by the real browser panel.
function repositionBridge () {
  if (!mainWindow || !bridgeView) return;
  const [w, h] = mainWindow.getContentSize();
  const panelW = Math.floor(w * 0.50);
  bridgeView.setBounds({ x: w - panelW, y: 0, width: panelW, height: h });
}

// ── Create / reuse the embedded browser view ─────────────────
function openBridgeView (url) {
  if (!mainWindow) return;

  if (!bridgeView) {
    bridgeView = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration:  false,
        sandbox:          true,        // safety: it's browsing external sites
        partition:        'persist:bridge', // ← SAME partition every time = stays logged in
      }
    });

    // ── Intercept downloads and send them to the React app ──
    bridgeView.webContents.session.on('will-download', (_event, item) => {
      const tmpPath = path.join(os.tmpdir(), `cd-bridge-${Date.now()}-${item.getFilename()}`);
      item.setSavePath(tmpPath);

      item.once('done', (_e, state) => {
        if (state !== 'completed') return;
        try {
          const buf    = fs.readFileSync(tmpPath);
          const base64 = buf.toString('base64');
          if (mainWindow) {
            mainWindow.webContents.send('bridge:download', {
              filename: item.getFilename(),
              mimeType: item.getMimeType() || guessMime(item.getFilename()),
              base64,
            });
          }
        } catch (err) {
          console.error('[Bridge] download intercept error:', err.message);
        } finally {
          try { fs.unlinkSync(tmpPath); } catch (_) {}
        }
      });
    });

    // Tell the React app when the embedded browser navigates
    bridgeView.webContents.on('did-navigate', (_e, navUrl) => {
      mainWindow?.webContents.send('bridge:navigated', navUrl);
    });
    bridgeView.webContents.on('did-navigate-in-page', (_e, navUrl) => {
      mainWindow?.webContents.send('bridge:navigated', navUrl);
    });
  }

  // Navigate to the requested URL
  bridgeView.webContents.loadURL(url);

  if (!bridgeShown) {
    mainWindow.contentView.addChildView(bridgeView);
    bridgeShown = true;
  }

  repositionBridge();

  // Focus the embedded browser so the user can interact immediately
  bridgeView.webContents.focus();
}

// ── IPC handlers (called from preload → renderer) ────────────

// Open (or navigate) the bridge panel
ipcMain.handle('bridge:open', (_e, { url }) => {
  openBridgeView(url);
  return { ok: true };
});

// Hide the bridge panel (does NOT destroy it — session stays alive)
ipcMain.handle('bridge:hide', () => {
  if (bridgeView && bridgeShown) {
    mainWindow?.contentView.removeChildView(bridgeView);
    bridgeShown = false;
  }
  return { ok: true };
});

// Navigate within the same bridge panel
ipcMain.handle('bridge:navigate', (_e, url) => {
  bridgeView?.webContents.loadURL(url);
  return { ok: true };
});

// Browser controls
ipcMain.handle('bridge:back',    () => { if (bridgeView?.webContents.canGoBack())    bridgeView.webContents.goBack(); });
ipcMain.handle('bridge:forward', () => { if (bridgeView?.webContents.canGoForward()) bridgeView.webContents.goForward(); });
ipcMain.handle('bridge:reload',  () => { bridgeView?.webContents.reload(); });

// ── App lifecycle ─────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── Helpers ───────────────────────────────────────────────────
function guessMime (filename) {
  if (!filename) return 'application/octet-stream';
  const ext = filename.split('.').pop()?.toLowerCase();
  const map = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
                webp: 'image/webp', gif: 'image/gif',
                mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
  return map[ext] || 'application/octet-stream';
}
