import { KioskFolder, KioskFile } from '../types';

export interface SearchResult {
  found: boolean;
  folder?: KioskFolder;
  files?: KioskFile[];
  error?: string;
  message?: string;
}

function decodeDriveIvd(html: string): any[] {
  const match = html.match(/window\['_DRIVE_ivd'\]\s*=\s*'([^']+)'/);
  if (!match) return [];
  const raw = match[1];

  try {
    const unescaped = raw.replace(/\\\\x([0-9a-fA-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
    const data = JSON.parse(unescaped);
    const items: any[] = [];
    if (Array.isArray(data)) {
      for (const entry of data) {
        if (Array.isArray(entry)) {
          for (const sub of entry) {
            if (Array.isArray(sub) && typeof sub[0] === 'string' && sub[0].length >= 25) {
              items.push(sub);
            }
          }
          if (typeof entry[0] === 'string' && entry[0].length >= 25) {
            items.push(entry);
          }
        }
      }
    }
    return items;
  } catch (e) {
    console.error('JSON parse error in decodeDriveIvd:', e);
    return [];
  }
}

export class GoogleDriveService {
  /**
   * Search for a folder whose name matches the student's ID.
   */
  static async findFolderById(
    studentId: string,
    rootFolderId?: string
  ): Promise<SearchResult> {
    const cleanId = studentId.trim();
    if (!cleanId) return { found: false };

    const rootId = rootFolderId || '1CXFm0VyVtSZIqONXJYMmIu0hJyxUqj2B';

    // 1. First query backend endpoint
    try {
      const proxyRes = await fetch('/api/drive-live-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: cleanId,
          rootFolderId: rootId,
        }),
      });

      if (proxyRes.ok) {
        const result = await proxyRes.json();
        if (result.found && result.folder) {
          return {
            found: true,
            folder: { id: result.folder.id, name: result.folder.name },
            files: result.files || [],
          };
        }
      }
    } catch (err) {
      console.warn('Backend drive-live-search call failed, trying direct:', err);
    }

    // 2. Direct client-side public drive parse
    try {
      const url = `https://drive.google.com/drive/folders/${rootId}`;
      const res = await fetch(url);
      if (res.ok) {
        const html = await res.text();
        const rawItems = decodeDriveIvd(html);
        const folders: Array<{ id: string; name: string }> = [];

        for (const item of rawItems) {
          if (!item || !Array.isArray(item) || item.length < 4) continue;
          const id = String(item[0] || '');
          const name = String(item[2] || '').trim();
          const mimeType = String(item[3] || '');
          if (mimeType === 'application/vnd.google-apps.folder') {
            folders.push({ id, name });
          }
        }

        const match =
          folders.find((f) => f.name.trim() === cleanId) ||
          folders.find((f) => f.name.trim().startsWith(cleanId)) ||
          folders.find((f) => f.name.includes(cleanId));

        if (match) {
          const files = await this.getFilesForFolder(match.id, match.name);
          return {
            found: true,
            folder: { id: match.id, name: match.name },
            files,
          };
        }
      }
    } catch (e) {
      console.error('Direct client drive query error:', e);
    }

    return {
      found: false,
      message: `לא נמצאה תיקייה עבור תעודת זהות "${cleanId}". ודא ששם התיקייה בדרייב תואם לתעודת הזהות.`,
    };
  }

  /**
   * List Word files (.docx, .doc) inside the student's folder.
   */
  static async getFilesForFolder(
    folderId: string,
    studentId: string
  ): Promise<KioskFile[]> {
    try {
      const url = `https://drive.google.com/drive/folders/${folderId}`;
      const res = await fetch(url);
      if (res.ok) {
        const html = await res.text();
        const rawItems = decodeDriveIvd(html);
        const files: KioskFile[] = [];

        for (const item of rawItems) {
          if (!item || !Array.isArray(item) || item.length < 4) continue;
          const id = String(item[0] || '');
          const name = String(item[2] || '').trim();
          const mimeType = String(item[3] || '');
          const size = typeof item[13] === 'number' ? item[13] : undefined;
          const modifiedTime = typeof item[10] === 'number' ? new Date(item[10]).toISOString() : undefined;

          if (mimeType !== 'application/vnd.google-apps.folder') {
            const lower = name.toLowerCase();
            const isWord =
              mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
              mimeType === 'application/msword' ||
              mimeType === 'application/vnd.google-apps.document' ||
              lower.endsWith('.docx') ||
              lower.endsWith('.doc');

            files.push({
              id,
              name,
              mimeType,
              size,
              modifiedTime,
              isWordDoc: isWord,
              thumbnailLink: `https://drive.google.com/thumbnail?id=${id}&sz=w800`,
              webContentLink: `https://drive.google.com/uc?export=download&id=${id}`,
            });
          }
        }
        return files;
      }
    } catch (err) {
      console.error('getFilesForFolder error:', err);
    }

    return [];
  }

  /**
   * Fetch binary content of a real file from Google Drive
   */
  static async fetchFileBlob(
    file: KioskFile
  ): Promise<{ base64: string; arrayBuffer: ArrayBuffer }> {
    // 0. Immediate local base64 cache if available
    if (file.base64Data && file.base64Data.length > 50) {
      try {
        const binary = atob(file.base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return { base64: file.base64Data, arrayBuffer: bytes.buffer };
      } catch (err) {
        console.warn('Failed to decode existing base64Data, will fetch fresh:', err);
      }
    }

    // 1. Try server-side proxy
    try {
      const proxyRes = await fetch('/api/fetch-drive-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: file.id, fileName: file.name }),
      });

      if (proxyRes.ok) {
        const data = await proxyRes.json();
        if (data.previewHtml && !file.previewHtml) {
          file.previewHtml = data.previewHtml;
        }
        if (data.base64) {
          file.base64Data = data.base64;
          const binary = atob(data.base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          return { base64: data.base64, arrayBuffer: bytes.buffer };
        }
      }
    } catch (e) {
      console.warn('Proxy file fetch failed, trying direct:', e);
    }

    // 2. Direct fetch from Google Drive
    const candidateUrls = [
      `https://docs.google.com/document/d/${file.id}/export?format=docx`,
      `https://drive.usercontent.google.com/download?id=${file.id}&export=download&authuser=0`,
      `https://drive.google.com/uc?export=download&id=${file.id}&confirm=t`,
    ];

    for (const fetchUrl of candidateUrls) {
      try {
        const res = await fetch(fetchUrl);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          if (arrayBuffer.byteLength > 100) {
            const bytes = new Uint8Array(arrayBuffer);
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              const chunk = bytes.subarray(i, i + chunkSize);
              binary += String.fromCharCode.apply(null, Array.from(chunk));
            }
            const base64 = btoa(binary);
            file.base64Data = base64;
            return { base64, arrayBuffer };
          }
        }
      } catch {}
    }

    throw new Error(`לא ניתן להוריד את הקובץ "${file.name}" כעת`);
  }

  /**
   * List folders in Google Drive for Admin configuration
   */
  static async listAdminFolders(rootFolderId?: string): Promise<Array<{ id: string; name: string }>> {
    const rootId = rootFolderId || '1CXFm0VyVtSZIqONXJYMmIu0hJyxUqj2B';
    try {
      const url = `https://drive.google.com/drive/folders/${rootId}`;
      const res = await fetch(url);
      if (res.ok) {
        const html = await res.text();
        const rawItems = decodeDriveIvd(html);
        const folders: Array<{ id: string; name: string }> = [];

        for (const item of rawItems) {
          if (!item || !Array.isArray(item) || item.length < 4) continue;
          const id = String(item[0] || '');
          const name = String(item[2] || '').trim();
          const mimeType = String(item[3] || '');
          if (mimeType === 'application/vnd.google-apps.folder') {
            folders.push({ id, name });
          }
        }
        return folders;
      }
    } catch {
      return [];
    }
    return [];
  }
}
