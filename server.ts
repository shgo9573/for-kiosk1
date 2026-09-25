console.log('');
console.log('=====================================================');
console.log('       עמדת תורה דיליה - Kiosk Server');
console.log('=====================================================');
console.log('[1/4] טוען את המערכת...');

import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import vm from 'vm';
import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';

const currentFilename = typeof __filename !== 'undefined' ? __filename : '';
const currentDirname = typeof __dirname !== 'undefined' ? __dirname : (currentFilename ? path.dirname(currentFilename) : process.cwd());

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '100mb' }));

// Determine target drive path
function getDriveTargetPath(customPath?: string, driveLetter?: string, folderName?: string): string {
  if (customPath && customPath.trim()) {
    if (process.platform === 'win32') {
      return customPath.trim();
    }
    const sanitized = customPath.replace(/^[A-Za-z]:[\\\/]/, '').replace(/[\\\/]/g, '_');
    return path.join(process.cwd(), 'drive_d_sim', sanitized || 'target_drive');
  }

  const letter = (driveLetter || 'D').toUpperCase().replace(/[^A-Z]/g, '') || 'D';
  const folder = (folderName && folderName.trim()) || 'תורה דיליה';

  if (process.platform === 'win32') {
    return `${letter}:\\${folder}`;
  }
  return path.join(process.cwd(), 'drive_d_sim', `${letter}_${folder}`);
}

// System status check endpoint
app.get('/api/system-status', (req, res) => {
  const dPath = getDriveTargetPath();
  const isWindows = process.platform === 'win32';
  let dDriveAccessible = false;

  try {
    if (isWindows) {
      dDriveAccessible = fs.existsSync('D:\\');
    } else {
      dDriveAccessible = true; // simulated in development
    }
  } catch {
    dDriveAccessible = false;
  }

  res.json({
    platform: process.platform,
    isWindows,
    targetDirectory: dPath,
    dDriveAccessible,
    kioskMode: true,
  });
});

// Copy file directly to configured drive/path without prompting the user
app.post('/api/copy-to-d', async (req, res) => {
  try {
    const { fileName, fileBase64, studentId, targetPath, driveLetter, folderName } = req.body;
    if (!fileName || !fileBase64) {
      return res.status(400).json({ success: false, error: 'שם קובץ ותוכן נדרשים' });
    }

    const targetDir = getDriveTargetPath(targetPath, driveLetter, folderName);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const safeFileName = path.basename(fileName);
    const targetFilePath = path.join(targetDir, safeFileName);
    const buffer = Buffer.from(fileBase64, 'base64');

    fs.writeFileSync(targetFilePath, buffer);
    console.log(`[Kiosk] Copied file "${safeFileName}" (${buffer.length} bytes) to ${targetFilePath}`);

    return res.json({
      success: true,
      path: targetFilePath,
      targetDir,
      fileName: safeFileName,
      size: buffer.length,
      message: `הקובץ הועתק בהצלחה לנתיב ${targetDir}\\${safeFileName}`,
    });
  } catch (error: any) {
    console.error('Error copying file to drive:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'שגיאה במהלך העתקת הקובץ לכונן היעד',
    });
  }
});

// Decode Google Drive IVD state payload cleanly using VM context
function decodeDriveIvd(html: string): any[] {
  const match = html.match(/window\['_DRIVE_ivd'\]\s*=\s*'([^']+)'/);
  if (!match) return [];
  const raw = match[1];

  try {
    const innerJs = vm.runInNewContext('"' + raw.replace(/"/g, '\\"') + '"');
    const data = vm.runInNewContext('(' + innerJs + ')');
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data[0];
    }
    return [];
  } catch (e) {
    console.error('VM parse error in decodeDriveIvd:', e);
    return [];
  }
}

// Scrape public Google Drive folders using Google's native state payload
async function scrapePublicDrive(folderId: string): Promise<{
  folders: Array<{ id: string; name: string }>;
  files: Array<{ id: string; name: string; mimeType: string; size?: number; modifiedTime?: string }>;
}> {
  const folders: Array<{ id: string; name: string }> = [];
  const files: Array<{ id: string; name: string; mimeType: string; size?: number; modifiedTime?: string }> = [];
  const seenIds = new Set<string>();

  try {
    const url = `https://drive.google.com/drive/folders/${folderId}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'he,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!res.ok) {
      console.warn(`Drive fetch returned status ${res.status} for folder ${folderId}`);
      return { folders, files };
    }

    const html = await res.text();
    const rawItems = decodeDriveIvd(html);

    for (const item of rawItems) {
      if (!item || !Array.isArray(item) || item.length < 4) continue;
      const id = String(item[0] || '');
      const name = String(item[2] || '').trim();
      const mimeType = String(item[3] || '');
      const size = typeof item[13] === 'number' ? item[13] : undefined;
      const modifiedTime = typeof item[10] === 'number' ? new Date(item[10]).toISOString() : undefined;

      if (!id || seenIds.has(id) || id === folderId) continue;
      seenIds.add(id);

      if (mimeType === 'application/vnd.google-apps.folder') {
        folders.push({ id, name });
      } else {
        files.push({
          id,
          name,
          mimeType,
          size,
          modifiedTime,
        });
      }
    }
  } catch (err) {
    console.error('Error scraping public Drive folder:', err);
  }

  return { folders, files };
}

// Live Google Drive Search & Public/Token Search Proxy
app.post('/api/drive-live-search', async (req, res) => {
  try {
    const { studentId, rootFolderId } = req.body;
    const cleanId = String(studentId || '').trim();
    if (!cleanId) {
      return res.status(400).json({ error: 'studentId is required' });
    }

    const rootId = rootFolderId || '1CXFm0VyVtSZIqONXJYMmIu0hJyxUqj2B';

    // 1. Scrape root folder directly
    const scraped = await scrapePublicDrive(rootId);
    console.log(`[Drive Scraper] Root "${rootId}" subfolders:`, scraped.folders.map(f => f.name));

    // Find student folder (exact match, starts with, or contains)
    const matchFolder =
      scraped.folders.find((f) => f.name.trim() === cleanId) ||
      scraped.folders.find((f) => f.name.trim().startsWith(cleanId)) ||
      scraped.folders.find((f) => f.name.includes(cleanId));

    if (matchFolder) {
      console.log(`[Drive Scraper] Found matching folder for "${cleanId}": "${matchFolder.name}" (${matchFolder.id})`);
      const subScraped = await scrapePublicDrive(matchFolder.id);
      console.log(`[Drive Scraper] Student folder contains ${subScraped.files.length} files:`, subScraped.files.map(f => f.name));

      return res.json({
        found: true,
        folder: matchFolder,
        files: subScraped.files.map((f) => {
          const lower = f.name.toLowerCase();
          const isWord =
            f.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
            f.mimeType === 'application/msword' ||
            f.mimeType === 'application/vnd.google-apps.document' ||
            lower.endsWith('.docx') ||
            lower.endsWith('.doc');

          return {
            id: f.id,
            name: f.name,
            mimeType: f.mimeType,
            size: f.size,
            modifiedTime: f.modifiedTime,
            isWordDoc: isWord,
            thumbnailLink: `https://drive.google.com/thumbnail?id=${f.id}&sz=w800`,
            webContentLink: `https://drive.google.com/uc?export=download&id=${f.id}`,
          };
        }),
      });
    }

    // Check if files in root folder itself match
    const matchFile = scraped.files.find(
      (f) => f.name.includes(cleanId) || f.name.toLowerCase().endsWith('.docx')
    );
    if (matchFile) {
      return res.json({
        found: true,
        folder: { id: rootId, name: cleanId },
        files: [
          {
            id: matchFile.id,
            name: matchFile.name,
            mimeType: matchFile.mimeType,
            size: matchFile.size,
            modifiedTime: matchFile.modifiedTime,
            isWordDoc: true,
            thumbnailLink: `https://drive.google.com/thumbnail?id=${matchFile.id}&sz=w800`,
            webContentLink: `https://drive.google.com/uc?export=download&id=${matchFile.id}`,
          },
        ],
      });
    }

    return res.json({
      found: false,
      error: 'FOLDER_NOT_FOUND',
      message: `לא נמצאה תיקייה עבור תעודת זהות "${cleanId}". ודא ששם התיקייה בדרייב תואם לתעודת הזהות.`,
    });
  } catch (err: any) {
    console.error('drive-live-search error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Proxy route to fetch Google Drive file binary content
app.post('/api/fetch-drive-file', async (req, res) => {
  try {
    const { fileId } = req.body;
    if (!fileId) {
      return res.status(400).json({ error: 'fileId is required' });
    }

    const candidateUrls = [
      `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`,
      `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
      `https://drive.google.com/uc?id=${fileId}&export=download`,
    ];

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };

    for (const url of candidateUrls) {
      try {
        const fileRes = await fetch(url, { headers });
        if (fileRes.ok) {
          const arrayBuffer = await fileRes.arrayBuffer();
          if (arrayBuffer.byteLength > 0) {
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            return res.json({ base64, size: arrayBuffer.byteLength });
          }
        }
      } catch (e) {
        console.warn('Failed download attempt for url:', url, e);
      }
    }

    return res.status(404).json({ error: 'Could not fetch file from Google Drive' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Local or Synced folder search
app.post('/api/local-folder-search', async (req, res) => {
  try {
    const { studentId, rootPath } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }

    const searchPath = rootPath && fs.existsSync(rootPath) ? rootPath : null;
    if (!searchPath) {
      return res.json({ found: false, files: [] });
    }

    const entries = fs.readdirSync(searchPath, { withFileTypes: true });
    const matchingDir = entries.find(
      (e) => e.isDirectory() && (e.name.trim() === studentId.trim() || e.name.includes(studentId.trim()))
    );

    if (!matchingDir) {
      return res.json({ found: false, files: [] });
    }

    const dirPath = path.join(searchPath, matchingDir.name);
    const fileEntries = fs.readdirSync(dirPath, { withFileTypes: true });

    const files = fileEntries
      .filter((f) => f.isFile())
      .map((f) => {
        const filePath = path.join(dirPath, f.name);
        const stats = fs.statSync(filePath);
        const buffer = fs.readFileSync(filePath);
        const base64 = buffer.toString('base64');
        const lower = f.name.toLowerCase();
        const isWord = lower.endsWith('.docx') || lower.endsWith('.doc');

        return {
          id: 'local_' + f.name,
          name: f.name,
          mimeType: isWord
            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            : 'application/octet-stream',
          size: stats.size,
          modifiedTime: stats.mtime.toISOString(),
          isWordDoc: isWord,
          base64Data: base64,
        };
      });

    return res.json({
      found: true,
      folder: { id: matchingDir.name, name: matchingDir.name },
      files,
    });
  } catch (err: any) {
    console.error('Local folder search error:', err);
    return res.status(500).json({ error: err.message });
  }
});

process.on('uncaughtException', (err) => {
  console.error('[שגיאה קריטית בתוכנה]:', err);
  try {
    fs.appendFileSync(path.join(process.cwd(), 'kiosk-error.log'), `[${new Date().toISOString()}] Uncaught: ${err.stack || err}\n`);
  } catch {}
});

process.on('unhandledRejection', (err: any) => {
  console.error('[שגיאת מערכת בלתי צפויה]:', err);
  try {
    fs.appendFileSync(path.join(process.cwd(), 'kiosk-error.log'), `[${new Date().toISOString()}] Rejection: ${err?.stack || err}\n`);
  } catch {}
});

let lastHeartbeat = Date.now();
let hasConnected = false;

app.post('/api/heartbeat', (req, res) => {
  lastHeartbeat = Date.now();
  hasConnected = true;
  res.json({ ok: true });
});

// Auto-exit when standalone kiosk window is closed (with safe initial grace period)
if ((process as any).pkg) {
  setInterval(() => {
    if (hasConnected && Date.now() - lastHeartbeat > 12000) {
      console.log('[Kiosk Server] Client window closed, exiting.');
      process.exit(0);
    }
  }, 3000);
}

function launchKioskApp(listenPort: number) {
  const url = `http://localhost:${listenPort}`;
  console.log(`[3/4] מאתר דפדפן לפתיחת חלון העמדה...`);

  try {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env['LOCALAPPDATA'] || '';

    // Direct path candidates for Microsoft Edge (installed on 99%+ of Windows 10/11)
    const edgeCandidates = [
      path.join(programFilesX86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      path.join(localAppData, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ];

    // Direct path candidates for Google Chrome
    const chromeCandidates = [
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    ];

    const edgePath = edgeCandidates.find((p) => {
      try { return fs.existsSync(p); } catch { return false; }
    });

    const appArgs = [
      `--app=${url}`,
      '--new-window',
      '--window-size=1366,768',
      '--disable-extensions',
      '--no-first-run',
      '--disable-features=Translate',
      '--disable-default-apps',
    ];

    if (edgePath) {
      console.log(`[+] נמצא Microsoft Edge בנתיב: ${edgePath}`);
      console.log(`[4/4] פותח את חלון העמדה (Edge App Mode)...`);
      try {
        const edgeProc = spawn(edgePath, appArgs, {
          detached: true,
          stdio: 'ignore',
        });
        edgeProc.unref();
        console.log(`[V] חלון העמדה נפתח בהצלחה!`);
        return;
      } catch (e) {
        console.error(`[-] שגיאה בפתיחת Edge:`, e);
      }
    }

    const chromePath = chromeCandidates.find((p) => {
      try { return fs.existsSync(p); } catch { return false; }
    });

    if (chromePath) {
      console.log(`[+] נמצא Google Chrome בנתיב: ${chromePath}`);
      console.log(`[4/4] פותח את חלון העמדה (Chrome App Mode)...`);
      try {
        const chromeProc = spawn(chromePath, appArgs, {
          detached: true,
          stdio: 'ignore',
        });
        chromeProc.unref();
        console.log(`[V] חלון העמדה נפתח בהצלחה!`);
        return;
      } catch (e) {
        console.error(`[-] שגיאה בפתיחת Chrome:`, e);
      }
    }

    console.log(`[4/4] פותח באמצעות דפדפן ברירת המחדל...`);
    exec(`cmd /c start "" "${url}"`, (cmdErr) => {
      if (cmdErr) {
        console.log(`[גיבוי] פותח באמצעות explorer "${url}"...`);
        exec(`explorer "${url}"`);
      } else {
        console.log(`[V] דפדפן ברירת המחדל נפתח בהצלחה!`);
      }
    });
  } catch (err) {
    console.error(`[-] שגיאה בפונקציית פתיחת הדפדפן:`, err);
  }
}

function startListening(startPort: number, maxAttempts = 30) {
  console.log(`[2/4] בודק זמינות ומאזין בפורט ${startPort}...`);

  const server = http.createServer(app);

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[!] פורט ${startPort} תפוס ע"י הפעלה קודמת ברקע. עובר אוטומטית לפורט ${startPort + 1}...`);
      server.close();
      if (maxAttempts > 0) {
        setTimeout(() => startListening(startPort + 1, maxAttempts - 1), 50);
      } else {
        console.error('[X] לא נמצא פורט פנוי מתוך 30 נסיונות.');
      }
    } else {
      console.error('[X] שגיאה ברשת:', err);
    }
  });

  server.listen(startPort, '127.0.0.1', () => {
    console.log(`[V] השרת המקומי פועל בהצלחה בכתובת: http://localhost:${startPort}`);
    launchKioskApp(startPort);
  });
}

async function startServer() {
  let staticDir = '';
  if (!isProd && !(process as any).pkg) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const candidates = [
      path.resolve(currentDirname, 'dist'),
      path.resolve(currentDirname),
      path.join(process.cwd(), 'dist'),
      path.join(process.cwd()),
    ];
    staticDir = candidates.find((dir) => {
      try { return fs.existsSync(path.join(dir, 'index.html')); } catch { return false; }
    }) || path.resolve(currentDirname, 'dist');

    console.log(`[info] נתיב קבצי ממשק: ${staticDir}`);
    app.use(express.static(staticDir));
    app.get('*', (req, res) => {
      const indexPath = path.join(staticDir, 'index.html');
      try {
        if (fs.existsSync(indexPath)) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.send(fs.readFileSync(indexPath, 'utf-8'));
          return;
        }
      } catch {}
      res.sendFile(indexPath);
    });
  }

  startListening(port);
}

startServer();
