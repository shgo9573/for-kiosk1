const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { fork } = require('child_process');

process.env['NODE_ENV'] = 'production';
process.env['KIOSK_NO_BROWSER'] = '1';

// Determine multiple candidate log directories to guarantee writing succeeds
const candidateLogDirs = [
  process.env.PORTABLE_EXECUTABLE_DIR,
  process.cwd(),
  path.dirname(process.execPath),
  process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'Desktop') : null,
  process.env.TEMP,
].filter(Boolean);

const logDir = candidateLogDirs[0] || process.cwd();
const logFilePath = path.join(logDir, 'kiosk-debug.log');

// Core multi-destination file logger
function writeLog(tag, ...args) {
  const timestamp = new Date().toISOString();
  const text = args.map((a) => {
    if (a instanceof Error) return `${a.message}\n${a.stack}`;
    if (typeof a === 'object') {
      try { return JSON.stringify(a, null, 2); } catch { return String(a); }
    }
    return String(a);
  }).join(' ');

  const line = `[${timestamp}] [${tag}] ${text}\n`;

  // Write to all accessible log destinations
  for (const dir of candidateLogDirs) {
    try {
      const target = path.join(dir, 'kiosk-debug.log');
      fs.appendFileSync(target, line, 'utf8');
    } catch (err) {}
  }

  // Also print to standard streams if running from terminal
  try {
    if (tag === 'ERROR' || tag === 'FATAL') {
      process.stderr.write(line);
    } else {
      process.stdout.write(line);
    }
  } catch {}
}

// Redirect console methods to writeLog
const origLog = console.log;
const origError = console.error;
const origWarn = console.warn;

console.log = (...args) => { writeLog('INFO', ...args); origLog(...args); };
console.error = (...args) => { writeLog('ERROR', ...args); origError(...args); };
console.warn = (...args) => { writeLog('WARN', ...args); origWarn(...args); };

writeLog('STARTUP', '=====================================================');
writeLog('STARTUP', '      תורה דיליה - עמדת בית המדרש (Kiosk Launcher)');
writeLog('STARTUP', '=====================================================');
writeLog('STARTUP', 'Log file initialized at:', logFilePath);
writeLog('STARTUP', 'Node version:', process.version);
writeLog('STARTUP', 'Electron version:', process.versions.electron);
writeLog('STARTUP', 'Platform:', process.platform, process.arch);
writeLog('STARTUP', 'Executable path:', process.execPath);
writeLog('STARTUP', 'Working directory:', process.cwd());
writeLog('STARTUP', 'PORTABLE_EXECUTABLE_DIR:', process.env.PORTABLE_EXECUTABLE_DIR || '(not set)');
writeLog('STARTUP', 'Process arguments:', JSON.stringify(process.argv));

// Global exception handling
process.on('uncaughtException', (err) => {
  writeLog('FATAL', 'Uncaught Exception in Electron main process:', err);
  try {
    dialog.showErrorBox(
      'שגיאה בהפעלת עמדת תורה דיליה',
      `התרחשה שגיאה בעת הפעלת התוכנה:\n\n${err ? (err.stack || err.message) : err}\n\nנשמר קובץ לוג: ${logFilePath}`
    );
  } catch {}
});

process.on('unhandledRejection', (reason) => {
  writeLog('FATAL', 'Unhandled Promise Rejection:', reason);
});

let mainWindow = null;
let serverProcess = null;
let activePort = 3000;
let activeServerUrl = `http://127.0.0.1:${activePort}`;

// Single instance lock
writeLog('INSTANCE', 'Checking SingleInstanceLock...');
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  writeLog('WARN', 'Another instance of ToraDelia-Kiosk is already running! Exiting duplicate process.');
  try {
    dialog.showMessageBoxSync({
      type: 'warning',
      title: 'תורה דיליה - התוכנה כבר פועלת',
      message: 'עמדת תורה דיליה כבר פועלת ברקע במחשב זה.\nאם החלון אינו מוצג, בדוק במנהל המשימות (Task Manager) וסגור תהליכים קודמים.',
    });
  } catch {}
  app.quit();
  process.exit(0);
}
writeLog('INSTANCE', 'SingleInstanceLock acquired successfully.');

app.on('second-instance', () => {
  writeLog('INSTANCE', 'Second instance attempted to launch. Focusing existing main window.');
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// 1. Start backend server safely
function startServerProcess() {
  const candidatePaths = [
    path.join(app.getAppPath(), 'dist', 'server.cjs'),
    path.join(__dirname, '..', 'dist', 'server.cjs'),
    path.join(process.resourcesPath || '', 'app', 'dist', 'server.cjs'),
    path.join(process.resourcesPath || '', 'app.asar', 'dist', 'server.cjs'),
    path.join(process.resourcesPath || '', 'dist', 'server.cjs'),
    path.join(__dirname, 'server.cjs'),
  ];

  writeLog('SERVER', 'Searching for server script in candidates:');
  candidatePaths.forEach((p) => {
    let exists = false;
    try { exists = fs.existsSync(p); } catch {}
    writeLog('SERVER', `  [${exists ? 'V' : 'X'}] ${p}`);
  });

  const serverScript = candidatePaths.find((p) => {
    try { return fs.existsSync(p); } catch { return false; }
  });

  if (!serverScript) {
    writeLog('FATAL', 'No valid server script found in any candidate path!');
    dialog.showErrorBox(
      'שגיאת קובץ שרת',
      `לא נמצא קובץ השרת dist/server.cjs באף נתיב.\nעיין בקובץ הלוג: ${logFilePath}`
    );
    return;
  }

  writeLog('SERVER', 'Loading server script:', serverScript);

  process.env['PORT'] = '3000';
  process.env['KIOSK_NO_BROWSER'] = '1';
  process.env['NODE_ENV'] = 'production';
  process.env['PORTABLE_EXECUTABLE_DIR'] = logDir;

  try {
    writeLog('SERVER', 'Requiring server script in-process...');
    require(serverScript);
    writeLog('SERVER', 'In-process server required successfully.');
    return;
  } catch (requireErr) {
    writeLog('WARN', 'In-process server require threw error:', requireErr);
  }

  // Fallback: fork child process
  try {
    writeLog('SERVER', 'Forking server child process as fallback...');
    serverProcess = fork(serverScript, ['--no-browser', '--safer'], {
      env: {
        ...process.env,
        PORT: '3000',
        KIOSK_NO_BROWSER: '1',
        NODE_ENV: 'production',
        PORTABLE_EXECUTABLE_DIR: logDir,
      },
      stdio: 'inherit',
    });

    serverProcess.on('error', (err) => {
      writeLog('ERROR', 'Server child process error:', err);
    });

    serverProcess.on('exit', (code, signal) => {
      writeLog('WARN', `Server child process exited (code=${code}, signal=${signal})`);
    });
  } catch (forkErr) {
    writeLog('FATAL', 'Could not fork server child process:', forkErr);
  }
}

// 2. Poll server until active
function waitForServer(callback, maxAttempts = 60) {
  let attempts = 0;
  const candidatePorts = [3000, 3001, 3002];

  const checkPort = (portIdx) => {
    const port = candidatePorts[portIdx];
    const testUrl = `http://127.0.0.1:${port}`;
    const req = http.get(testUrl, (res) => {
      activePort = port;
      activeServerUrl = testUrl;
      writeLog('SERVER', `Server is up and responding at: ${activeServerUrl} (HTTP ${res.statusCode})`);
      callback();
    });

    req.on('error', () => {
      if (portIdx + 1 < candidatePorts.length) {
        checkPort(portIdx + 1);
      } else {
        attempts++;
        if (attempts % 5 === 0) {
          writeLog('SERVER', `Polling server (attempt ${attempts}/${maxAttempts})...`);
        }
        if (attempts >= maxAttempts) {
          writeLog('WARN', `Server poll timed out after ${attempts} attempts. Opening window anyway with ${activeServerUrl}`);
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
  writeLog('WINDOW', 'Creating application window...');
  Menu.setApplicationMenu(null);

  const isKiosk = !process.argv.includes('--windowed');
  writeLog('WINDOW', `Window mode: ${isKiosk ? 'Kiosk (Fullscreen)' : 'Windowed'}`);

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

  mainWindow.webContents.on('did-finish-load', () => {
    writeLog('WINDOW', 'Window finished loading successfully.');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    writeLog('WARN', `Window failed to load (${errorCode}: ${errorDescription}) at URL: ${validatedURL}. Retrying in 1s...`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(activeServerUrl).catch(() => {});
      }
    }, 1000);
  });

  // Prevent navigation away from the local kiosk application
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://127.0.0.1') && !url.startsWith('http://localhost')) {
      writeLog('SECURITY', `Blocked external navigation attempt to: ${url}`);
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Allow Esc key to exit fullscreen in windowed mode
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape' && input.type === 'keyDown') {
      if (mainWindow.isFullScreen() && process.argv.includes('--windowed')) {
        mainWindow.setFullScreen(false);
      }
    }
  });

  writeLog('WINDOW', `Loading application URL: ${activeServerUrl}`);
  mainWindow.loadURL(activeServerUrl).catch((err) => {
    writeLog('ERROR', 'Initial loadURL caught error:', err);
  });

  mainWindow.on('closed', () => {
    writeLog('WINDOW', 'Main window closed by user.');
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  writeLog('APP', 'Electron app ready event fired.');
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
  writeLog('APP', 'All windows closed. Terminating application.');
  if (serverProcess) {
    try { serverProcess.kill(); } catch {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  writeLog('APP', 'Application shutting down.');
  if (serverProcess) {
    try { serverProcess.kill(); } catch {}
  }
});
