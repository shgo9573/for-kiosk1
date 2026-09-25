import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  HardDrive,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { KioskConfig } from '../types';
import { GoogleDriveService } from '../services/googleDrive';
import { googleSignIn, logout } from '../services/firebaseAuth';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: KioskConfig;
  onSaveConfig: (config: KioskConfig) => void;
  isDriveConnected: boolean;
  userEmail?: string | null;
  onDriveStateChanged: () => void;
}

const REQUIRED_PIN = '545454545';
const COMMON_DRIVES = ['C', 'D', 'E', 'F', 'G', 'H'];

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  isDriveConnected,
  userEmail,
  onDriveStateChanged,
}) => {
  const [pinInput, setPinInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinError, setPinError] = useState(false);

  // Settings state
  const [rootFolderId, setRootFolderId] = useState(config.rootFolderId);
  const [rootFolderName, setRootFolderName] = useState(config.rootFolderName);
  const [autoLogoutSeconds, setAutoLogoutSeconds] = useState(config.autoLogoutSeconds);
  const [mode, setMode] = useState<'drive' | 'demo'>(config.mode);

  // Target Drive and Folder settings
  const [targetDriveLetter, setTargetDriveLetter] = useState(config.targetDriveLetter || 'D');
  const [targetFolderName, setTargetFolderName] = useState(config.targetFolderName || 'תורה דיליה');

  const [, setDriveFolders] = useState<Array<{ id: string; name: string }>>([]);
  const [, setIsLoadingFolders] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPinInput('');
      setIsAuthenticated(false);
      setPinError(false);
      setRootFolderId(config.rootFolderId);
      setRootFolderName(config.rootFolderName);
      setAutoLogoutSeconds(config.autoLogoutSeconds);
      setMode(config.mode);
      setTargetDriveLetter(config.targetDriveLetter || 'D');
      setTargetFolderName(config.targetFolderName || 'תורה דיליה');
    }
  }, [isOpen, config]);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput.trim() === REQUIRED_PIN) {
      setIsAuthenticated(true);
      setPinError(false);
      if (isDriveConnected) {
        loadFolders();
      }
    } else {
      setPinError(true);
    }
  };

  const loadFolders = async () => {
    setIsLoadingFolders(true);
    try {
      const folders = await GoogleDriveService.listAdminFolders();
      setDriveFolders(folders);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsSigningIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        onDriveStateChanged();
        await loadFolders();
      }
    } catch (err) {
      console.error('Sign in failed:', err);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    onDriveStateChanged();
    setDriveFolders([]);
  };

  const computedTargetPath = `${targetDriveLetter.toUpperCase()}:\\${targetFolderName.trim() || 'תורה דיליה'}`;

  const handleSave = () => {
    onSaveConfig({
      ...config,
      adminPin: REQUIRED_PIN,
      rootFolderId,
      rootFolderName,
      autoLogoutSeconds,
      mode,
      targetDriveLetter: targetDriveLetter.toUpperCase(),
      targetFolderName: targetFolderName.trim() || 'תורה דיליה',
      dDriveTargetPath: computedTargetPath,
    });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm select-none">
      <div className="bg-white border border-slate-300 rounded-xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3.5 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-300">
              <Lock className="w-4 h-4 text-slate-700" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 font-serif">
                הגדרות מערכת וניהול
              </h3>
              <p className="text-xs text-slate-500">תצורת כונן יעד, גוגל דרייב ואיפוס</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Password Screen */}
        {!isAuthenticated ? (
          <form onSubmit={handlePinSubmit} className="space-y-5 py-4 text-center">
            <p className="text-sm text-slate-700 font-medium">
              הזן סיסמת מנהל מערכת לכניסה להגדרות
            </p>
            <div className="max-w-xs mx-auto">
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={12}
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError(false);
                }}
                placeholder="•••••••••"
                autoFocus
                className="w-full h-14 text-center text-2xl font-mono tracking-widest bg-slate-50 border-2 border-slate-300 focus:border-[#0f1d38] focus:bg-white rounded-lg text-slate-900 outline-none"
              />
              {pinError && (
                <p className="text-xs text-red-600 mt-2 font-medium flex items-center justify-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>סיסמה שגויה. נסה שוב</span>
                </p>
              )}
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition cursor-pointer"
              >
                ביטול
              </button>
              <button
                type="submit"
                className="px-7 py-2.5 rounded-lg bg-[#0f1d38] hover:bg-[#182c53] text-white font-semibold text-sm shadow transition cursor-pointer"
              >
                אישור
              </button>
            </div>
          </form>
        ) : (
          /* Authenticated Settings Form */
          <div className="space-y-4">
            {/* 1. Target Drive & Folder Selection (בחירת כונן ותיקייה) */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-700" />
                <span>כונן יעד להעתקת קבצים (דיסק מקומי)</span>
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                בחר את אות הכונן (C, D, E, F וכו') ואת שם התיקייה שאליה יועתקו הקבצים ישירות.
              </p>

              {/* Drive Letter Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  אות כונן במחשב:
                </label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_DRIVES.map((letter) => {
                    const isSelected = targetDriveLetter.toUpperCase() === letter;
                    return (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => setTargetDriveLetter(letter)}
                        className={`w-11 h-10 rounded-lg font-mono font-bold text-sm border transition cursor-pointer flex items-center justify-center ${
                          isSelected
                            ? 'bg-[#0f1d38] text-white border-[#0f1d38] shadow-sm'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {letter}:
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Target Folder Name Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  שם תיקיית היעד בכונן:
                </label>
                <input
                  type="text"
                  value={targetFolderName}
                  onChange={(e) => setTargetFolderName(e.target.value)}
                  placeholder="תורה דיליה"
                  className="w-full h-10 px-3 rounded bg-white border border-slate-300 text-xs font-medium text-slate-800 outline-none focus:border-[#0f1d38]"
                />
              </div>

              {/* Live Target Path Preview */}
              <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">נתיב שמירה מלא:</span>
                <span className="font-mono text-emerald-800 font-bold text-sm" dir="ltr">
                  {computedTargetPath}
                </span>
              </div>
            </div>

            {/* 2. Google Drive Account */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <h4 className="text-xs font-bold text-slate-900 mb-1 flex items-center gap-2">
                <FolderOpen className="w-3.5 h-3.5 text-[#0f1d38]" />
                <span>חיבור חשבון גוגל דרייב</span>
              </h4>
              <p className="text-xs text-slate-500 mb-3">
                המערכת פונה לתיקיית תורה דיליה הראשית שמכילה את כל תיקיות התלמידים.
              </p>

              {isDriveConnected ? (
                <div className="flex items-center justify-between p-3 rounded bg-white border border-slate-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="text-xs font-bold text-slate-800">מחובר לגוגל דרייב</div>
                      <div className="text-xs font-mono text-slate-500">{userEmail || 'חשבון מאומת'}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleLogout}
                    className="px-3 py-1 rounded bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700 text-xs font-medium border border-slate-300 transition cursor-pointer"
                  >
                    התנתק
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isSigningIn}
                    className="flex items-center gap-2.5 px-4 py-2.5 rounded bg-white hover:bg-slate-100 text-slate-800 font-semibold text-xs shadow-sm border border-slate-300 transition cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    <span>{isSigningIn ? 'מתחבר לחשבון...' : 'התחבר עם גוגל דרייב (Google Drive)'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* 3. Root Folder in Drive */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <h4 className="text-xs font-bold text-slate-900 mb-1">
                מזהה תיקיית השורש בדרייב
              </h4>
              <input
                type="text"
                value={rootFolderId}
                onChange={(e) => setRootFolderId(e.target.value)}
                placeholder="1CXFm0VyVtSZIqONXJYMmIu0hJyxUqj2B"
                className="w-full h-10 px-3 rounded bg-white border border-slate-300 text-xs font-mono text-slate-800 placeholder-slate-400 outline-none focus:border-[#0f1d38]"
              />
            </div>

            {/* 4. Inactivity Auto-Reset */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-slate-900">זמן איפוס אוטומטי</h4>
                <p className="text-[11px] text-slate-500">חזרה למסך הראשי בחוסר פעילות</p>
              </div>
              <select
                value={autoLogoutSeconds}
                onChange={(e) => setAutoLogoutSeconds(Number(e.target.value))}
                className="h-9 px-3 rounded bg-white border border-slate-300 text-slate-800 text-xs font-mono outline-none focus:border-[#0f1d38]"
              >
                <option value={30}>30 שניות</option>
                <option value={60}>60 שניות</option>
                <option value={90}>90 שניות</option>
                <option value={120}>120 שניות</option>
              </select>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition cursor-pointer"
              >
                סגור
              </button>

              <button
                type="button"
                onClick={handleSave}
                className="px-6 py-2 rounded bg-[#0f1d38] hover:bg-[#182c53] text-white font-semibold text-xs shadow flex items-center gap-1.5 transition cursor-pointer"
              >
                {saveSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>נשמר בהצלחה</span>
                  </>
                ) : (
                  <span>שמור הגדרות</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
