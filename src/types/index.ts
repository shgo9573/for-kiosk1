export interface KioskFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  thumbnailLink?: string;
  webContentLink?: string;
  isWordDoc: boolean;
  base64Data?: string;
  previewHtml?: string;
  snippet?: string;
}

export interface KioskFolder {
  id: string;
  name: string; // The Israeli ID / Teudat Zehut number
  studentName?: string;
  filesCount?: number;
}

export interface KioskConfig {
  mode: 'drive' | 'demo';
  rootFolderId: string;
  rootFolderName: string;
  adminPin: string;
  autoLogoutSeconds: number;
  targetDriveLetter: string; // e.g. 'D', 'C', 'E', 'F', 'G'
  targetFolderName: string;  // e.g. 'תורה דיליה'
  dDriveTargetPath: string;   // Full path e.g. 'D:\תורה דיליה'
  fallbackDriveCount: number; // Number of fallback drive letters to scan forward (default: 5)
  autoDetectRemovableDrive: boolean; // Auto-detect USB flash drive (DriveType=2)
  limitToDEOnly?: boolean; // Restrict scanning to drives D: and E: only, never F: or above
  kioskLockFullscreen: boolean;
}

export interface KioskStats {
  totalPrints: number;
  totalCopies: number;
  firstRunTimestamp?: string;
  lastUpdatedTimestamp?: string;
}

export interface PrintJobState {
  fileId: string;
  status: 'idle' | 'preparing' | 'printing' | 'success' | 'error';
  message?: string;
}

export interface CopyJobState {
  fileId: string;
  status: 'idle' | 'copying' | 'success' | 'error';
  message?: string;
  savedPath?: string;
}
