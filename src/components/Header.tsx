import React, { useState, useEffect } from 'react';
import { Clock, FolderCheck, Usb } from 'lucide-react';
import { KioskConfig } from '../types';
import { TorahLogo } from './TorahLogo';

interface HeaderProps {
  config: KioskConfig;
  isDriveConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({ config }) => {
  const [currentTime, setCurrentTime] = useState<string>('');

  const targetPath =
    config.dDriveTargetPath ||
    `${config.targetDriveLetter || 'D'}:\\${config.targetFolderName || 'תורה דיליה'}`;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('he-IL', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const dateStr = now.toLocaleDateString('he-IL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      setCurrentTime(`${dateStr}  •  ${timeStr}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="bg-[#0f1d38] border-b-2 border-[#c59b27] px-8 py-3.5 flex items-center justify-between text-white select-none shadow-md z-30">
      {/* Brand & Software Title */}
      <div className="flex items-center gap-3.5">
        <TorahLogo size="sm" />
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white font-serif leading-tight">
            תורה דיליה
          </h1>
          <p className="text-[11px] text-amber-200/90 font-medium">
            עמדת קליטה והדפסת מסמכים
          </p>
        </div>
      </div>

      {/* Real-time Clock & Target */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#16274a] border border-slate-700/80 text-slate-200">
          <Clock className="w-3.5 h-3.5 text-[#d4af37]" />
          <span className="font-mono tracking-wide">{currentTime}</span>
        </div>

        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded bg-[#16274a] border border-slate-700/80 text-slate-200">
          {config.autoDetectRemovableDrive !== false ? (
            <>
              <Usb className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300">
                יעד קבצים:{' '}
                <strong className="text-emerald-300 font-medium">
                  דיסק און קי אוטומטי ({config.targetFolderName || 'תורה דיליה'})
                </strong>
              </span>
            </>
          ) : (
            <>
              <FolderCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300">
                יעד קבצים: <strong className="font-mono text-white" dir="ltr">{targetPath}</strong>
              </span>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

