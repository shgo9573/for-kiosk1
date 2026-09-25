import React from 'react';
import {
  Printer,
  Usb,
  CheckCircle2,
  Loader2,
  FileText,
} from 'lucide-react';
import { KioskFile } from '../types';
import { RealDocxThumbnail } from './RealDocxThumbnail';

interface FileCardProps {
  file: KioskFile;
  onPrint: (file: KioskFile) => void;
  onCopyToD: (file: KioskFile) => void;
  targetDriveLetter?: string;
  isPrinting?: boolean;
  isCopying?: boolean;
  isCopied?: boolean;
  isPrinted?: boolean;
}

export const FileCard: React.FC<FileCardProps> = ({
  file,
  onPrint,
  onCopyToD,
  targetDriveLetter = 'D',
  isPrinting = false,
  isCopying = false,
  isCopied = false,
  isPrinted = false,
}) => {
  const driveLabel = (targetDriveLetter || 'D').toUpperCase();

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('he-IL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between select-none">
      {/* Top File Title & Meta */}
      <div className="mb-3">
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded bg-slate-100 border border-slate-200 shrink-0 text-[#0f1d38]">
            <FileText className="w-5 h-5 text-blue-800" />
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="text-sm font-bold text-slate-900 truncate leading-snug"
              title={file.name}
            >
              {file.name}
            </h3>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 font-medium">
              {file.size && <span>{formatFileSize(file.size)}</span>}
              {file.size && file.modifiedTime && <span>•</span>}
              {file.modifiedTime && <span>עודכן: {formatDate(file.modifiedTime)}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* First Page Visual Thumbnail */}
      <div className="w-full h-64 bg-slate-50 border border-slate-200 rounded-lg overflow-hidden relative flex items-center justify-center mb-3.5 cursor-default">
        <RealDocxThumbnail file={file} />

        {/* Status Overlay Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {isCopied && (
            <span
              style={{ backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#6ee7b7' }}
              className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>הועתק לדיסק און קי</span>
            </span>
          )}
          {isPrinted && (
            <span
              style={{ backgroundColor: '#dbeafe', color: '#1e40af', borderColor: '#93c5fd' }}
              className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              <span>הודפס</span>
            </span>
          )}
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="grid grid-cols-2 gap-2 mt-auto">
        {/* Print Button */}
        <button
          type="button"
          disabled={isPrinting}
          onClick={() => onPrint(file)}
          style={{
            backgroundColor: isPrinted ? '#f1f5f9' : '#0f1d38',
            color: isPrinted ? '#334155' : '#ffffff',
            borderColor: isPrinted ? '#cbd5e1' : '#0f1d38',
          }}
          className="py-2.5 px-2 rounded-lg text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition border cursor-pointer active:scale-95 disabled:opacity-50 hover:opacity-95"
        >
          {isPrinting ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : (
            <Printer className="w-4 h-4 shrink-0" />
          )}
          <span className="truncate">{isPrinting ? 'שולח...' : isPrinted ? 'הדפס שוב' : 'הדפסה'}</span>
        </button>

        {/* Copy to USB Flash Drive Button */}
        <button
          type="button"
          disabled={isCopying}
          onClick={() => onCopyToD(file)}
          style={{
            backgroundColor: isCopied ? '#ecfdf5' : '#047857',
            color: isCopied ? '#065f46' : '#ffffff',
            borderColor: isCopied ? '#6ee7b7' : '#047857',
          }}
          className="py-2.5 px-2 rounded-lg text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition border cursor-pointer active:scale-95 disabled:opacity-50 hover:opacity-95"
          title={`העתק לדיסק און קי (כונן ${driveLabel}:)`}
        >
          {isCopying ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : (
            <Usb className="w-4 h-4 shrink-0" />
          )}
          <span className="truncate">
            {isCopying ? 'מעתיק...' : isCopied ? 'הועתק לדיסק און קי' : 'העתק לדיסק און קי'}
          </span>
        </button>
      </div>
    </div>
  );
};
