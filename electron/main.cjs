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
  const fs = require('fs');
  const candidatePaths = [
    path.join(app.getAppPath(), 'dist', 'server.cjs'),
    path.join(__dirname, '..', 'dist', 'server.cjs'),
    path.join(process.resourcesPath || '', 'app', 'dist', 'server.cjs'),
    path.join(process.resourcesPath || '', 'dist', 'server.cjs'),
    path.join(__dirname, 'server.cjs'),
  ];

  const serverScript = candidatePaths.find((p) => {
    try { return fs.existsSync(p); } catch { return false; }
  });

  process.env['PORT'] = String(PORT);
  process.env['KIOSK_NO_BROWSER'] = '1';

  if (serverScript) {
    console.log('[Electron] Loading bundled server:', serverScript);
    try {
      require(serverScript);
      return;
    } catch (requireErr) {
      console.warn('[Electron] Failed in-process require, trying child process:', requireErr);
    }
  }

  const fallbackScript = path.join(__dirname, '..', 'server.ts');
  let scriptToRun = serverScript || fallbackScript;
  let execArgv = [];

  if (!serverScript && fs.existsSync(fallbackScript)) {
    scriptToRun = fallbackScript;
    execArgv = ['--import', 'tsx'];
  }

  console.log('[Electron] Starting fallback server process:', scriptToRun);

  try {
    serverProcess = fork(scriptToRun, ['--no-browser', '--safer'], {
      env: { ...process.env, PORT: String(PORT), KIOSK_NO_BROWSER: '1' },
      stdio: 'inherit',
      execArgv,
    });

    serverProcess.on('error', (err) => {
      console.error('[Electron] Server process error:', err);
    });
  } catch (err) {
    console.error('[Electron] Could not fork server process:', err);
  }
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
