/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { IdEntryScreen } from './components/IdEntryScreen';
import { StudentFilesScreen } from './components/StudentFilesScreen';
import { AdminModal } from './components/AdminModal';
import { KioskToast, ToastNotification } from './components/KioskToast';
import { KioskConfig, KioskFolder, KioskFile } from './types';
import { GoogleDriveService } from './services/googleDrive';
import { KioskActionService } from './services/kioskActions';
import { initAuth, getAccessToken, auth } from './services/firebaseAuth';
import { User } from 'firebase/auth';
import { Power } from 'lucide-react';

const DEFAULT_CONFIG: KioskConfig = {
  mode: 'drive',
  rootFolderId: '1CXFm0VyVtSZIqONXJYMmIu0hJyxUqj2B',
  rootFolderName: 'תיקיית תורה דיליה הראשית',
  adminPin: '545454545',
  autoLogoutSeconds: 60,
  targetDriveLetter: 'D',
  targetFolderName: 'תורה דיליה',
  dDriveTargetPath: 'D:\\תורה דיליה',
  fallbackDriveCount: 5,
  autoDetectRemovableDrive: true,
  limitToDEOnly: false,
  kioskLockFullscreen: true,
};

export default function App() {
  const [config, setConfig] = useState<KioskConfig>(() => {
    try {
      const saved = localStorage.getItem('kiosk_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          adminPin: '545454545',
          targetDriveLetter: parsed.targetDriveLetter || 'D',
          targetFolderName: parsed.targetFolderName || 'תורה דיליה',
          fallbackDriveCount: typeof parsed.fallbackDriveCount === 'number' ? parsed.fallbackDriveCount : 5,
          autoDetectRemovableDrive: parsed.autoDetectRemovableDrive !== false,
          limitToDEOnly: parsed.limitToDEOnly ?? false,
          dDriveTargetPath:
            parsed.dDriveTargetPath ||
            `${parsed.targetDriveLetter || 'D'}:\\${parsed.targetFolderName || 'תורה דיליה'}`,
        };
      }
      return DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const [currentView, setCurrentView] = useState<'id-entry' | 'student-files'>('id-entry');
  const [currentFolder, setCurrentFolder] = useState<KioskFolder | null>(null);
  const [files, setFiles] = useState<KioskFile[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auth and Drive status
  const [isDriveConnected, setIsDriveConnected] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Admin Modal state
  const [isAdminOpen, setIsAdminOpen] = useState<boolean>(false);

  // Exit & Shutdown Modal state
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState<boolean>(false);
  const [isShuttingDown, setIsShuttingDown] = useState<boolean>(false);

  // Toast notifications
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Action states
  const [printingFileId, setPrintingFileId] = useState<string | null>(null);
  const [copyingFileId, setCopyingFileId] = useState<string | null>(null);
  const [copiedFileIds, setCopiedFileIds] = useState<Set<string>>(new Set());
  const [printedFileIds, setPrintedFileIds] = useState<Set<string>>(new Set());
  const [isCopyingAll, setIsCopyingAll] = useState<boolean>(false);

  const targetDrivePath =
    config.dDriveTargetPath ||
    `${config.targetDriveLetter || 'D'}:\\${config.targetFolderName || 'תורה דיליה'}`;

  // Keep standalone kiosk server alive and sync close lifecycle
  useEffect(() => {
    fetch('/api/heartbeat', { method: 'POST' }).catch(() => {});
    const interval = setInterval(() => {
      fetch('/api/heartbeat', { method: 'POST' }).catch(() => {});
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setIsDriveConnected(!!token);
        setCurrentUser(user);
      },
      () => {
        setIsDriveConnected(false);
        setCurrentUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const addToast = (toast: Omit<ToastNotification, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Search folder by ID
  const handleSearchId = async (id: string): Promise<boolean> => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await GoogleDriveService.findFolderById(id, config.rootFolderId);

      if (!result || !result.found || !result.folder) {
        setErrorMessage(
          result?.message ||
            `לא נמצאה תיקייה עבור תעודת זהות "${id}". אנא בדוק את המספר שהוקלד או ודא שהתיקייה קיימת בדרייב.`
        );
        setIsLoading(false);
        return false;
      }

      setCurrentFolder(result.folder);
      setFiles(result.files || []);
      setCopiedFileIds(new Set());
      setPrintedFileIds(new Set());
      setCurrentView('student-files');
      setIsLoading(false);
      return true;
    } catch (err: any) {
      console.error('Search error:', err);
      setErrorMessage('שגיאה במהלך החיפוש בדרייב. אנא נסה שוב.');
      setIsLoading(false);
      return false;
    }
  };

  // Print single file
  const handlePrintFile = async (file: KioskFile) => {
    setPrintingFileId(file.id);
    try {
      const res = await KioskActionService.printFile(file);
      if (res.success) {
        setPrintedFileIds((prev) => new Set(prev).add(file.id));
        addToast({
          type: 'success',
          title: 'הדפסה נשלחה למדפסת',
          message: `המסמך "${file.name}" נשלח להדפסה בהצלחה`,
          actionType: 'print',
        });
      } else {
        addToast({
          type: 'error',
          title: 'שגיאה בהדפסה',
          message: res.message,
          actionType: 'print',
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'שגיאה בהדפסה',
        message: err.message || 'לא ניתן היה להדפיס את הקובץ',
        actionType: 'print',
      });
    } finally {
      setPrintingFileId(null);
    }
  };

  // Copy single file to configured drive/target
  const handleCopyFileToD = async (file: KioskFile) => {
    if (!currentFolder) return;
    setCopyingFileId(file.id);

    try {
      const res = await KioskActionService.copyToDDrive(file, currentFolder.name, {
        driveLetter: config.targetDriveLetter || 'D',
        folderName: config.targetFolderName || 'תורה דיליה',
        fullPath: targetDrivePath,
        fallbackDriveCount: config.fallbackDriveCount ?? 5,
        autoDetectRemovable: config.autoDetectRemovableDrive ?? true,
        limitToDEOnly: config.limitToDEOnly ?? false,
      });
      if (res.success) {
        setCopiedFileIds((prev) => new Set(prev).add(file.id));
        addToast({
          type: 'success',
          title: 'הקובץ הועתק בהצלחה',
          message: res.message || `נשמר ב- ${res.path}`,
          actionType: 'copy',
        });
      } else {
        addToast({
          type: 'error',
          title: 'שגיאה בהעתקה',
          message: res.message,
          actionType: 'copy',
        });
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'שגיאה בהעתקה',
        message: err.message || 'העתקת הקובץ לכונן היעד נכשלה',
        actionType: 'copy',
      });
    } finally {
      setCopyingFileId(null);
    }
  };

  // Copy all files to configured drive/target
  const handleCopyAllToD = async () => {
    if (!currentFolder || files.length === 0) return;
    setIsCopyingAll(true);

    const wordFiles = files.filter((f) => f.isWordDoc);
    let successCount = 0;
    let lastSavedPath = targetDrivePath;

    for (const file of wordFiles) {
      try {
        const res = await KioskActionService.copyToDDrive(file, currentFolder.name, {
          driveLetter: config.targetDriveLetter || 'D',
          folderName: config.targetFolderName || 'תורה דיליה',
          fullPath: targetDrivePath,
          fallbackDriveCount: config.fallbackDriveCount ?? 5,
          autoDetectRemovable: config.autoDetectRemovableDrive ?? true,
          limitToDEOnly: config.limitToDEOnly ?? false,
        });
        if (res.success) {
          setCopiedFileIds((prev) => new Set(prev).add(file.id));
          successCount++;
          if (res.path) lastSavedPath = res.path;
        }
      } catch (err) {
        console.error('Bulk copy error for file:', file.name, err);
      }
    }

    setIsCopyingAll(false);
    addToast({
      type: successCount > 0 ? 'success' : 'error',
      title: 'העתקה מרוכזת',
      message: `${successCount} מתוך ${wordFiles.length} קבצים הועתקו בהצלחה`,
      actionType: 'copy',
    });
  };

  const handleConfirmExit = async () => {
    setIsShuttingDown(true);
    try {
      await KioskActionService.shutdownSystem();
    } catch {}
    setTimeout(() => {
      try {
        window.close();
      } catch {}
    }, 600);
  };

  const handleBackToEntry = () => {
    setCurrentView('id-entry');
    setCurrentFolder(null);
    setFiles([]);
    setErrorMessage(null);
  };

  const handleSaveConfig = (newConfig: KioskConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem('kiosk_config', JSON.stringify(newConfig));
    } catch (e) {
      console.warn('Could not save config to localStorage', e);
    }
  };

  const handleDriveStateChanged = async () => {
    const token = await getAccessToken();
    setIsDriveConnected(!!token);
    if (auth.currentUser) {
      setCurrentUser(auth.currentUser);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f2ee] text-slate-900 flex flex-col justify-between selection:bg-[#0f1d38] selection:text-white relative">
      {/* Invisible secret pixel at the top-leftmost corner for admin access */}
      <button
        type="button"
        onClick={() => setIsAdminOpen(true)}
        aria-label="Admin"
        className="fixed top-0 left-0 w-3 h-3 z-50 opacity-0 cursor-default"
      />

      {/* Header */}
      <Header
        config={config}
        isDriveConnected={isDriveConnected}
        onExit={() => setIsExitConfirmOpen(true)}
      />

      {/* Main Workstation Screen */}
      <main className="flex-1 flex flex-col justify-center items-center py-6 px-4">
        {currentView === 'id-entry' ? (
          <IdEntryScreen
            onSearch={handleSearchId}
            isLoading={isLoading}
            errorMessage={errorMessage}
            onClearError={() => setErrorMessage(null)}
            isDriveConnected={isDriveConnected}
          />
        ) : (
          currentFolder && (
            <StudentFilesScreen
              folder={currentFolder}
              files={files}
              onBack={handleBackToEntry}
              onPrintFile={handlePrintFile}
              onCopyFileToD={handleCopyFileToD}
              onCopyAllToD={handleCopyAllToD}
              autoLogoutSeconds={config.autoLogoutSeconds}
              targetDriveLetter={config.targetDriveLetter || 'D'}
              targetPath={targetDrivePath}
              printingFileId={printingFileId}
              copyingFileId={copyingFileId}
              copiedFileIds={copiedFileIds}
              printedFileIds={printedFileIds}
              isCopyingAll={isCopyingAll}
            />
          )
        )}
      </main>

      {/* Admin Settings Modal */}
      <AdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
        isDriveConnected={isDriveConnected}
        userEmail={currentUser?.email}
        onDriveStateChanged={handleDriveStateChanged}
      />

      {/* Toast Notifications */}
      <KioskToast toasts={toasts} onDismiss={removeToast} />

      {/* Bottom Status Bar */}
      <footer className="bg-white border-t border-slate-200 px-8 py-2 flex items-center justify-between text-xs text-slate-500 select-none shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span className="font-semibold text-slate-700">תורה דיליה</span>
          </div>
          <button
            type="button"
            onClick={() => setIsExitConfirmOpen(true)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-900 border border-red-200 text-[11px] font-bold transition cursor-pointer"
            title="סגירת התוכנה וכיבוי כל השירותים"
          >
            <Power className="w-3 h-3 text-red-600" />
            <span>יציאה וכיבוי</span>
          </button>
        </div>
        <div className="font-mono text-slate-600 font-medium" dir="ltr">
          {targetDrivePath}
        </div>
      </footer>

      {/* Exit & Shutdown Confirmation Modal */}
      {isExitConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs select-none">
          <div className="bg-white border-2 border-red-400 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center shrink-0">
                <Power className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-serif">
                  יציאה וכיבוי מלא של המערכת
                </h3>
                <p className="text-xs text-slate-500">
                  סגירת התוכנה וכיבוי כל שירותי הרקע
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-red-50/70 border border-red-200/80 rounded-xl text-xs text-slate-700 leading-relaxed space-y-1.5">
              <p className="font-semibold text-red-900">
                האם אתה בטוח שברצונך לצאת מהתוכנה ולכבות את כל השירות?
              </p>
              <p className="text-slate-600 text-[11px]">
                פעולה זו תכבה לחלוטין את שרת העמדה ברקע, תסגור את חלון התוכנה ותפסיק את כל הפעילות עד להפעלה הבאה.
              </p>
            </div>

            {isShuttingDown ? (
              <div className="py-3 flex flex-col items-center justify-center gap-2 text-center text-slate-700">
                <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-bold text-red-700">
                  מכבה את כל שירותי העמדה וסוגר את התוכנה...
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsExitConfirmOpen(false)}
                  className="px-5 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition cursor-pointer"
                >
                  ביטול
                </button>
                <button
                  type="button"
                  onClick={handleConfirmExit}
                  className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs shadow-md transition flex items-center gap-2 cursor-pointer border border-red-700"
                >
                  <Power className="w-4 h-4" />
                  <span>כן, כבה את המערכת כעת</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
