const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const http = require('http');
const { fork } = require('child_process');

process.env['NODE_ENV'] = 'production';
process.env['KIOSK_NO_BROWSER'] = '1';

// Global error logger & visual alert so it never fails silently
process.on('uncaughtException', (err) => {
  console.error('[Electron Uncaught Exception]:', err);
  try {
    dialog.showErrorBox('שגיאה בהפעלת עמדת תורה דיליה', String(err && err.stack ? err.stack : err));
  } catch {}
});

process.on('unhandledRejection', (reason) => {
  console.error('[Electron Unhandled Rejection]:', reason);
});

let mainWindow = null;
let serverProcess = null;
let activePort = 3000;
let activeServerUrl = `http://127.0.0.1:${activePort}`;

// Single instance lock to prevent duplicate conflicting processes
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// 1. Start backend server safely
function startServerProcess() {
  const fs = require('fs');
  const candidatePaths = [
    path.join(app.getAppPath(), 'dist', 'server.cjs'),
    path.join(__dirname, '..', 'dist', 'server.cjs'),
    path.join(process.resourcesPath || '', 'app', 'dist', 'server.cjs'),
    path.join(process.resourcesPath || '', 'app.asar', 'dist', 'server.cjs'),
    path.join(process.resourcesPath || '', 'dist', 'server.cjs'),
    path.join(__dirname, 'server.cjs'),
  ];

  const serverScript = candidatePaths.find((p) => {
    try { return fs.existsSync(p); } catch { return false; }
  });

  process.env['PORT'] = '3000';

  if (serverScript) {
    console.log('[Electron] Running bundled server from:', serverScript);
    try {
      require(serverScript);
      return;
    } catch (requireErr) {
      console.warn('[Electron] In-process server require failed, attempting fork:', requireErr);
    }
  }

  const fallbackScript = path.join(__dirname, '..', 'server.ts');
  let scriptToRun = serverScript || fallbackScript;
  let execArgv = [];

  if (!serverScript && fs.existsSync(fallbackScript)) {
    scriptToRun = fallbackScript;
    execArgv = ['--import', 'tsx'];
  }

  console.log('[Electron] Starting background server process:', scriptToRun);

  try {
    serverProcess = fork(scriptToRun, ['--no-browser', '--safer'], {
      env: { ...process.env, PORT: '3000', KIOSK_NO_BROWSER: '1', NODE_ENV: 'production' },
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

// 2. Poll server ports (checks 3000, 3001, 3002...) until response is ready
function waitForServer(callback, maxAttempts = 60) {
  let attempts = 0;
  const candidatePorts = [3000, 3001, 3002];

  const checkPort = (portIdx) => {
    const port = candidatePorts[portIdx];
    const testUrl = `http://127.0.0.1:${port}`;
    const req = http.get(testUrl, (res) => {
      activePort = port;
      activeServerUrl = testUrl;
      console.log(`[Electron] Server is responding at: ${activeServerUrl}`);
      callback();
    });

    req.on('error', () => {
      if (portIdx + 1 < candidatePorts.length) {
        checkPort(portIdx + 1);
      } else {
        attempts++;
        if (attempts >= maxAttempts) {
          console.warn('[Electron] Server poll reached timeout, opening window with default port...');
          callback();
        } else {
          setTimeout(() => checkPort(0), 200);
        }
      }
    });

    req.setTimeout(800, () => {
      req.destroy();
    });

    req.end();
  };

  checkPort(0);
}

// 3. Create native kiosk window
function createWindow() {
  Menu.setApplicationMenu(null);

  const isKiosk = !process.argv.includes('--windowed');

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    kiosk: isKiosk,
    fullscreen: isKiosk,
    center: true,
    show: true,
    autoHideMenuBar: true,
    title: 'תורה דיליה - עמדת בית המדרש',
    backgroundColor: '#f8fafc',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      devTools: process.argv.includes('--debug'),
    },
  });

  // Prevent navigation away from the local kiosk application
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

  // Automatically retry loading if connection refused during startup
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.warn(`[Electron] Page load attempt failed (${errorCode}: ${errorDescription}), retrying...`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(activeServerUrl).catch(() => {});
      }
    }, 1000);
  });

  // Allow Esc key to exit fullscreen in windowed/test mode
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') {
      if (mainWindow.isFullScreen() && process.argv.includes('--windowed')) {
        mainWindow.setFullScreen(false);
      }
    }
  });

  // Load the active local server URL
  console.log('[Electron] Loading application URL:', activeServerUrl);
  mainWindow.loadURL(activeServerUrl).catch((err) => {
    console.warn('[Electron] Initial loadURL caught error:', err);
  });

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
