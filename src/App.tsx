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

const DEFAULT_CONFIG: KioskConfig = {
  mode: 'drive',
  rootFolderId: '1CXFm0VyVtSZIqONXJYMmIu0hJyxUqj2B',
  rootFolderName: 'תיקיית תורה דיליה הראשית',
  adminPin: '545454545',
  autoLogoutSeconds: 60,
  targetDriveLetter: 'D',
  targetFolderName: 'תורה דיליה',
  dDriveTargetPath: 'D:\\תורה דיליה',
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
      });
      if (res.success) {
        setCopiedFileIds((prev) => new Set(prev).add(file.id));
        addToast({
          type: 'success',
          title: 'הקובץ הועתק בהצלחה',
          message: `נשמר ב- ${res.path}`,
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

    for (const file of wordFiles) {
      try {
        const res = await KioskActionService.copyToDDrive(file, currentFolder.name, {
          driveLetter: config.targetDriveLetter || 'D',
          folderName: config.targetFolderName || 'תורה דיליה',
          fullPath: targetDrivePath,
        });
        if (res.success) {
          setCopiedFileIds((prev) => new Set(prev).add(file.id));
          successCount++;
        }
      } catch (err) {
        console.error('Bulk copy error for file:', file.name, err);
      }
    }

    setIsCopyingAll(false);
    addToast({
      type: successCount > 0 ? 'success' : 'error',
      title: 'העתקה מרוכזת',
      message: `${successCount} מתוך ${wordFiles.length} קבצים הועתקו ל- ${targetDrivePath}`,
      actionType: 'copy',
    });
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
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span className="font-semibold text-slate-700">תורה דיליה</span>
        </div>
        <div className="font-mono text-slate-600 font-medium" dir="ltr">
          {targetDrivePath}
        </div>
      </footer>
    </div>
  );
}
