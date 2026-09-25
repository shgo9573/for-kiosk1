import React, { useState, useEffect } from 'react';
import {
  LogOut,
  FolderOpen,
  Usb,
  Clock,
  Loader2,
  FileText,
} from 'lucide-react';
import { KioskFolder, KioskFile } from '../types';
import { FileCard } from './FileCard';

interface StudentFilesScreenProps {
  folder: KioskFolder;
  files: KioskFile[];
  onBack: () => void;
  onPrintFile: (file: KioskFile) => Promise<void>;
  onCopyFileToD: (file: KioskFile) => Promise<void>;
  onCopyAllToD: () => Promise<void>;
  autoLogoutSeconds: number;
  targetDriveLetter?: string;
  targetPath?: string;
  printingFileId: string | null;
  copyingFileId: string | null;
  copiedFileIds: Set<string>;
  printedFileIds: Set<string>;
  isCopyingAll: boolean;
}

export const StudentFilesScreen: React.FC<StudentFilesScreenProps> = ({
  folder,
  files,
  onBack,
  onPrintFile,
  onCopyFileToD,
  onCopyAllToD,
  autoLogoutSeconds,
  targetDriveLetter = 'D',
  targetPath = 'D:\\תורה דיליה',
  printingFileId,
  copyingFileId,
  copiedFileIds,
  printedFileIds,
  isCopyingAll,
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(autoLogoutSeconds);

  useEffect(() => {
    setTimeLeft(autoLogoutSeconds);
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onBack();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoLogoutSeconds, onBack]);

  const handleUserActivity = () => {
    setTimeLeft(autoLogoutSeconds);
  };

  const wordFiles = files.filter((f) => f.isWordDoc);

  return (
    <div
      onClick={handleUserActivity}
      onTouchStart={handleUserActivity}
      className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full select-none"
    >
      {/* Top Bar for Student Session */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Student Info */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[#0f1d38]">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 font-mono tracking-wide">
              תעודת זהות: {folder.name}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              נמצאו {wordFiles.length} קבצי מסמכים
            </p>
          </div>
        </div>

        {/* Actions & Auto-logout countdown */}
        <div className="flex items-center gap-3">
          {/* Bulk Copy All */}
          {wordFiles.length > 1 && (
            <button
              type="button"
              onClick={onCopyAllToD}
              disabled={isCopyingAll}
              style={{
                backgroundColor: '#047857',
                color: '#ffffff',
                borderColor: '#047857',
              }}
              className="px-4 py-2 rounded-lg text-white border text-xs font-bold shadow-sm flex items-center gap-2 transition disabled:opacity-50 cursor-pointer active:scale-95 hover:opacity-95"
            >
              {isCopyingAll ? (
                <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
              ) : (
                <Usb className="w-4 h-4 text-white shrink-0" />
              )}
              <span>העתק הכל לדיסק און קי (<strong className="font-mono text-white" dir="ltr">{targetPath}</strong>)</span>
            </button>
          )}

          {/* Countdown Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>איפוס בעוד {timeLeft} שניות</span>
          </div>

          {/* Finish & Exit Button */}
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 hover:text-slate-900 border border-slate-300 text-xs font-bold shadow-sm flex items-center gap-2 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>סיום ויציאה</span>
          </button>
        </div>
      </div>

      {/* Grid of Files */}
      {wordFiles.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {wordFiles.map((file) => (
            <FileCard
              key={file.id}
              file={file}
              onPrint={onPrintFile}
              onCopyToD={onCopyFileToD}
              targetDriveLetter={targetDriveLetter}
              isPrinting={printingFileId === file.id}
              isCopying={copyingFileId === file.id}
              isCopied={copiedFileIds.has(file.id)}
              isPrinted={printedFileIds.has(file.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center my-auto max-w-md mx-auto shadow-sm">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 mb-1 font-serif">
            לא נמצאו קבצים בתיקייה
          </h3>
          <p className="text-xs text-slate-500 mb-5">
            התיקייה קיימת אך אינה מכילה קבצי .docx או .doc עבור תעודת זהות זו.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 rounded-lg bg-[#0f1d38] hover:bg-[#182c53] text-white font-semibold text-xs shadow-sm transition cursor-pointer"
          >
            חזרה להקלדת תעודת זהות
          </button>
        </div>
      )}
    </div>
  );
};
