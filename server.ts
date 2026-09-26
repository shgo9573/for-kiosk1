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
import { spawn, exec, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const currentFilename = typeof __filename !== 'undefined' ? __filename : '';
const currentDirname = typeof __dirname !== 'undefined' ? __dirname : (currentFilename ? path.dirname(currentFilename) : process.cwd());

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '100mb' }));

// Compute candidate drive letters sequence starting from primaryLetter
function getDriveSequence(primaryLetter: string = 'D', fallbackCount: number = 5): string[] {
  const cleanLetter = (primaryLetter || 'D').toUpperCase().replace(/[^A-Z]/g, '') || 'D';
  const startCode = cleanLetter.charCodeAt(0);
  const validStart = startCode >= 65 && startCode <= 90 ? startCode : 68;
  const count = Math.max(0, Math.min(20, typeof fallbackCount === 'number' ? fallbackCount : 5));

  const sequence: string[] = [];
  for (let i = 0; i <= count; i++) {
    const charCode = validStart + i;
    if (charCode <= 90) {
      sequence.push(String.fromCharCode(charCode));
    }
  }
  return sequence.length > 0 ? sequence : [cleanLetter];
}

// Removable USB flash drive detection for Windows
interface RemovableDriveInfo {
  letter: string;
  name: string;
  isRemovable: boolean;
}

let cachedRemovableDrives: { timestamp: number; drives: RemovableDriveInfo[] } = {
  timestamp: 0,
  drives: [],
};

function detectWindowsRemovableDrives(): RemovableDriveInfo[] {
  if (process.platform !== 'win32') {
    return [{ letter: 'D', name: 'דיסק און קי מדומה (פיתוח)', isRemovable: true }];
  }

  const now = Date.now();
  if (now - cachedRemovableDrives.timestamp < 3000) {
    return cachedRemovableDrives.drives;
  }

  const results: RemovableDriveInfo[] = [];

  try {
    // Query Windows for DriveType=2 (Removable Disk / USB Flash Drive)
    const psCmd = `powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 } | Select-Object -Property DeviceID, VolumeName | ConvertTo-Json -Compress"`;
    const output = execSync(psCmd, { encoding: 'utf8', timeout: 2500 }).trim();

    if (output) {
      const parsed = JSON.parse(output);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item && item.DeviceID) {
          const letter = String(item.DeviceID).replace(/[^A-Za-z]/g, '').toUpperCase();
          if (letter) {
            results.push({
              letter,
              name: item.VolumeName ? `${item.VolumeName} (${letter}:)` : `דיסק און קי (${letter}:)`,
              isRemovable: true,
            });
          }
        }
      }
    }
  } catch (err) {
    // Fallback if PowerShell query times out: check typical USB letters D, E, F, G, H, I
    const candidateLetters = ['E', 'F', 'G', 'H', 'D', 'I', 'J'];
    for (const d of candidateLetters) {
      try {
        if (fs.existsSync(`${d}:\\`)) {
          results.push({ letter: d, name: `כונן נשלף (${d}:)`, isRemovable: true });
        }
      } catch {}
    }
  }

  cachedRemovableDrives = { timestamp: now, drives: results };
  return results;
}

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

// Get detected removable USB drives
app.get('/api/removable-drives', (req, res) => {
  const drives = detectWindowsRemovableDrives();
  res.json({
    success: true,
    drives,
    count: drives.length,
  });
});

// System status check endpoint
app.get('/api/system-status', (req, res) => {
  const isWindows = process.platform === 'win32';
  const driveLetter = (String(req.query.driveLetter || 'D')).toUpperCase().replace(/[^A-Z]/g, '') || 'D';
  const fallbackCount = parseInt(String(req.query.fallbackCount || '5'), 10) || 5;
  const driveCandidates = getDriveSequence(driveLetter, fallbackCount);
  const removableDrives = detectWindowsRemovableDrives();

  let dDriveAccessible = false;
  const accessibleDrives: string[] = [];

  try {
    if (isWindows) {
      for (const d of driveCandidates) {
        try {
          if (fs.existsSync(`${d}:\\`)) {
            accessibleDrives.push(d);
            if (d === driveLetter) dDriveAccessible = true;
          }
        } catch {}
      }
      if (accessibleDrives.length > 0 && !dDriveAccessible) {
        dDriveAccessible = true; // Accessible via fallback
      }
      if (removableDrives.length > 0) {
        dDriveAccessible = true;
      }
    } else {
      dDriveAccessible = true; // simulated in development
      accessibleDrives.push(driveLetter);
    }
  } catch {
    dDriveAccessible = false;
  }

  const dPath = getDriveTargetPath(undefined, driveLetter);

  res.json({
    platform: process.platform,
    isWindows,
    targetDirectory: dPath,
    primaryDrive: driveLetter,
    dDriveAccessible,
    accessibleDrives,
    removableDrives,
    driveSequence: driveCandidates,
    kioskMode: true,
  });
});

// Copy file directly to configured drive/path with automatic fallback scanning
app.post('/api/copy-to-d', async (req, res) => {
  try {
    const { fileName, fileBase64, studentId, targetPath, driveLetter, folderName, fallbackDriveCount, autoDetectRemovable } = req.body;
    if (!fileName || !fileBase64) {
      return res.status(400).json({ success: false, error: 'שם קובץ ותוכן נדרשים' });
    }

    const safeFileName = path.basename(fileName);
    const buffer = Buffer.from(fileBase64, 'base64');
    const folder = (folderName && folderName.trim()) || 'תורה דיליה';
    const primaryLetter = (driveLetter || 'D').toUpperCase().replace(/[^A-Z]/g, '') || 'D';
    const fallbackCount = typeof fallbackDriveCount === 'number' ? fallbackDriveCount : 5;
    const shouldAutoDetect = autoDetectRemovable !== false;

    // In Windows: first check for any connected Removable USB drives (if auto-detect enabled),
    // then check primary drive and fallback sequence
    if (process.platform === 'win32') {
      const driveCandidates: string[] = [];

      // 1. If autoDetect is enabled, prioritize all detected USB removable drives
      if (shouldAutoDetect) {
        const removables = detectWindowsRemovableDrives();
        for (const rem of removables) {
          if (!driveCandidates.includes(rem.letter)) {
            driveCandidates.push(rem.letter);
          }
        }
      }

      // 2. Add primary drive and standard forward sequence
      const forwardSeq = getDriveSequence(primaryLetter, fallbackCount);
      for (const d of forwardSeq) {
        if (!driveCandidates.includes(d)) {
          driveCandidates.push(d);
        }
      }

      let savedPath = '';
      let savedDrive = '';
      let savedDir = '';
      let isRemovableDrive = false;
      const attemptedDrives: string[] = [];

      for (const letter of driveCandidates) {
        attemptedDrives.push(letter);
        const driveRoot = `${letter}:\\`;
        const targetDir = `${letter}:\\${folder}`;
        const targetFilePath = path.join(targetDir, safeFileName);

        try {
          if (fs.existsSync(driveRoot) || driveCandidates.length === 1) {
            if (!fs.existsSync(targetDir)) {
              fs.mkdirSync(targetDir, { recursive: true });
            }
            fs.writeFileSync(targetFilePath, buffer);
            savedPath = targetFilePath;
            savedDrive = letter;
            savedDir = targetDir;
            
            const removables = detectWindowsRemovableDrives();
            isRemovableDrive = removables.some((r) => r.letter === letter);

            console.log(`[Kiosk] Copied "${safeFileName}" (${buffer.length} bytes) to ${targetFilePath} (Drive ${letter}:, Removable: ${isRemovableDrive})`);
            break;
          }
        } catch (driveErr) {
          console.warn(`[Kiosk] Could not write to drive ${letter}:`, driveErr);
        }
      }

      if (savedPath) {
        const isFallback = savedDrive !== primaryLetter;
        let message = `הקובץ הועתק בהצלחה לדיסק און קי (${savedPath})`;
        if (isRemovableDrive) {
          message = `הקובץ נשמר בהצלחה בדיסק און קי (כונן ${savedDrive}:)`;
        } else if (isFallback) {
          message = `הקובץ הועתק בהצלחה לכונן ${savedDrive}: (${savedPath})`;
        } else {
          message = `הקובץ הועתק בהצלחה לנתיב ${savedPath}`;
        }

        return res.json({
          success: true,
          path: savedPath,
          targetDir: savedDir,
          driveLetter: savedDrive,
          primaryDrive: primaryLetter,
          isFallback,
          isRemovable: isRemovableDrive,
          fileName: safeFileName,
          size: buffer.length,
          message,
        });
      }

      // If all candidate drives failed
      return res.status(400).json({
        success: false,
        error: `לא נמצא דיסק און קי או כונן זמין לכתיבה. נבדקו הכוננים: ${attemptedDrives.map((d) => d + ':').join(', ')}. אנא חבר דיסק און קי למחשב ונסה שוב.`,
      });
    }

    // Dev / non-windows fallback
    const targetDir = getDriveTargetPath(targetPath, primaryLetter, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const targetFilePath = path.join(targetDir, safeFileName);
    fs.writeFileSync(targetFilePath, buffer);

    return res.json({
      success: true,
      path: targetFilePath,
      targetDir,
      driveLetter: primaryLetter,
      primaryDrive: primaryLetter,
      isFallback: false,
      isRemovable: true,
      fileName: safeFileName,
      size: buffer.length,
      message: `הקובץ הועתק בהצלחה לדיסק און קי (${targetDir}\\${safeFileName})`,
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
      `https://docs.google.com/document/d/${fileId}/export?format=docx`,
      `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0`,
      `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
      `https://drive.google.com/uc?id=${fileId}&export=download`,
      `https://docs.google.com/document/d/${fileId}/export?format=pdf`,
    ];

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    };

    for (const url of candidateUrls) {
      try {
        const fileRes = await fetch(url, { headers });
        if (fileRes.ok) {
          const contentType = fileRes.headers.get('content-type') || '';
          // Avoid returning html login/error pages as file content
          if (contentType.includes('text/html') && !url.includes('format=docx')) {
            continue;
          }
          const arrayBuffer = await fileRes.arrayBuffer();
          if (arrayBuffer.byteLength > 100) {
            const buffer = Buffer.from(arrayBuffer);
            const base64 = buffer.toString('base64');
            let previewHtml: string | undefined;
            try {
              const mammoth = await import('mammoth');
              const mRes = await mammoth.convertToHtml({ buffer });
              if (mRes.value && mRes.value.trim().length > 0) {
                previewHtml = mRes.value;
              }
            } catch {}
            return res.json({ base64, size: arrayBuffer.byteLength, previewHtml });
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

// Proxy for Google Drive thumbnails
app.get('/api/drive-thumbnail', async (req, res) => {
  try {
    const fileId = req.query.fileId as string;
    if (!fileId) return res.status(400).send('fileId is required');

    const urls = [
      `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`,
      `https://lh3.googleusercontent.com/d/${fileId}=w800`,
    ];

    for (const u of urls) {
      try {
        const tRes = await fetch(u, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          },
        });
        if (tRes.ok) {
          const cType = tRes.headers.get('content-type') || 'image/jpeg';
          if (cType.startsWith('image/')) {
            const buf = await tRes.arrayBuffer();
            res.setHeader('Content-Type', cType);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            return res.send(Buffer.from(buf));
          }
        }
      } catch {}
    }
    return res.status(404).send('Not found');
  } catch {
    return res.status(500).send('Error');
  }
});

// Local or Synced folder search with fallback drive scanning
app.post('/api/local-folder-search', async (req, res) => {
  try {
    const { studentId, rootPath, driveLetter, folderName, fallbackDriveCount } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }

    const cleanId = String(studentId).trim();
    const folder = (folderName && String(folderName).trim()) || 'תורה דיליה';
    const primaryLetter = (driveLetter || 'D').toUpperCase().replace(/[^A-Z]/g, '') || 'D';
    const fallbackCount = typeof fallbackDriveCount === 'number' ? fallbackDriveCount : 5;

    const candidatePaths: string[] = [];
    if (rootPath && typeof rootPath === 'string' && rootPath.trim()) {
      candidatePaths.push(rootPath.trim());
    }

    if (process.platform === 'win32') {
      const driveCandidates = getDriveSequence(primaryLetter, fallbackCount);
      for (const d of driveCandidates) {
        candidatePaths.push(`${d}:\\${folder}`);
        candidatePaths.push(`${d}:\\`);
      }
    } else {
      candidatePaths.push(path.join(process.cwd(), 'drive_d_sim', `${primaryLetter}_${folder}`));
      candidatePaths.push(path.join(process.cwd(), 'drive_d_sim'));
    }

    // Filter existing directories
    const existingSearchPaths = candidatePaths.filter((p) => {
      try {
        return fs.existsSync(p) && fs.statSync(p).isDirectory();
      } catch {
        return false;
      }
    });

    const mammoth = await import('mammoth').catch(() => null);

    for (const searchPath of existingSearchPaths) {
      try {
        const entries = fs.readdirSync(searchPath, { withFileTypes: true });
        const matchingDir = entries.find(
          (e) =>
            e.isDirectory() &&
            (e.name.trim() === cleanId ||
              e.name.trim().startsWith(cleanId) ||
              e.name.includes(cleanId))
        );

        if (matchingDir) {
          const dirPath = path.join(searchPath, matchingDir.name);
          const fileEntries = fs.readdirSync(dirPath, { withFileTypes: true });

          const files = await Promise.all(
            fileEntries
              .filter((f) => f.isFile())
              .map(async (f) => {
                const filePath = path.join(dirPath, f.name);
                const stats = fs.statSync(filePath);
                const buffer = fs.readFileSync(filePath);
                const base64 = buffer.toString('base64');
                const lower = f.name.toLowerCase();
                const isWord = lower.endsWith('.docx') || lower.endsWith('.doc');
                let previewHtml: string | undefined;
                let snippet: string | undefined;

                if (lower.endsWith('.docx') && mammoth) {
                  try {
                    const mRes = await mammoth.convertToHtml({ buffer });
                    if (mRes.value && mRes.value.trim().length > 0) {
                      previewHtml = mRes.value;
                      const tRes = await mammoth.extractRawText({ buffer });
                      snippet = tRes.value.slice(0, 200);
                    }
                  } catch (mErr) {
                    console.warn('Mammoth preview extraction error:', mErr);
                  }
                }

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
                  previewHtml,
                  snippet,
                };
              })
          );

          return res.json({
            found: true,
            folder: { id: matchingDir.name, name: matchingDir.name },
            files,
            searchPath,
          });
        }
      } catch (searchErr) {
        console.warn(`Error searching in ${searchPath}:`, searchErr);
      }
    }

    return res.json({ found: false, files: [] });
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
