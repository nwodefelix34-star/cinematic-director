// ═══════════════════════════════════════════════════════════
// CINEMATIC DIRECTOR — ELECTRON PRELOAD
//
// This file runs in a privileged context and exposes a safe
// set of functions to the React app via window.electronAPI.
//
// React app never gets raw Node/Electron access — only the
// specific functions listed here.
// ═══════════════════════════════════════════════════════════

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

  // ── Flag so the React app knows it's inside Electron ──────
  isElectron: true,

  // ── Bridge panel controls ──────────────────────────────────
  // Open the embedded browser at a specific URL
  openBridge:     (url)  => ipcRenderer.invoke('bridge:open',    { url }),
  hideBridge:     ()     => ipcRenderer.invoke('bridge:hide'),
  navigateBridge: (url)  => ipcRenderer.invoke('bridge:navigate', url),
  goBack:         ()     => ipcRenderer.invoke('bridge:back'),
  goForward:      ()     => ipcRenderer.invoke('bridge:forward'),
  reload:         ()     => ipcRenderer.invoke('bridge:reload'),

  // ── Download interception ─────────────────────────────────
  // Called when the embedded browser downloads a file.
  // data = { filename, mimeType, base64 }
  onDownload: (callback) => {
    ipcRenderer.on('bridge:download', (_event, data) => callback(data));
  },

  // Called whenever the embedded browser navigates to a new URL
  onNavigated: (callback) => {
    ipcRenderer.on('bridge:navigated', (_event, url) => callback(url));
  },

  // Clean up listeners when component unmounts
  removeAllBridgeListeners: () => {
    ipcRenderer.removeAllListeners('bridge:download');
    ipcRenderer.removeAllListeners('bridge:navigated');
  },
});
