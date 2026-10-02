const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const http = require('http');
const { fork } = require('child_process');

let mainWindow = null;
let serverProcess = null;
const PORT = 3000;
const SERVER_URL = `http://127.0.0.1:${PORT}`;

// 1. Start backend server in background with --no-browser and --safer
function startServerProcess() {
  const serverScript = path.join(__dirname, '..', 'dist', 'server.cjs');
  const fallbackScript = path.join(__dirname, '..', 'server.ts');
  const fs = require('fs');

  let scriptToRun = serverScript;
  let execArgv = [];

  if (!fs.existsSync(serverScript) && fs.existsSync(fallbackScript)) {
    // Development mode fallback
    scriptToRun = fallbackScript;
    execArgv = ['--import', 'tsx'];
  }

  console.log('[Electron] Starting background Kiosk server:', scriptToRun);

  serverProcess = fork(scriptToRun, ['--no-browser', '--safer'], {
    env: { ...process.env, PORT: String(PORT), KIOSK_NO_BROWSER: '1' },
    stdio: 'inherit',
    execArgv,
  });

  serverProcess.on('error', (err) => {
    console.error('[Electron] Server process error:', err);
  });
}

// 2. Poll server until ready
function waitForServer(callback, maxAttempts = 50) {
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    const req = http.get(SERVER_URL, (res) => {
      clearInterval(interval);
      callback();
    });

    req.on('error', () => {
      if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.warn('[Electron] Server timed out, opening window anyway...');
        callback();
      }
    });

    req.end();
  }, 200);
}

// 3. Create native standalone kiosk window (independent of Edge or any OS browser)
function createWindow() {
  Menu.setApplicationMenu(null); // Hide default menu

  const isKiosk = !process.argv.includes('--windowed');

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    kiosk: isKiosk,
    fullscreen: isKiosk,
    autoHideMenuBar: true,
    title: 'תורה דיליה - עמדת בית המדרש',
    backgroundColor: '#f8fafc',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: process.argv.includes('--debug'),
    },
  });

  // Airtight security: prevent any navigation away from the local kiosk
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://127.0.0.1') && !url.startsWith('http://localhost')) {
      console.warn('[Electron] Blocked external navigation to:', url);
      event.preventDefault();
    }
  });

  // Block popup windows / target="_blank"
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Load the kiosk application
  mainWindow.loadURL(SERVER_URL);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startServerProcess();
  waitForServer(() => {
    createWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {}
  }
});
