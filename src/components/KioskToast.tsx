import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Info,
  X,
  Printer,
  FolderDown,
} from 'lucide-react';

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
  actionType?: 'print' | 'copy';
}

interface KioskToastProps {
  toasts: ToastNotification[];
  onDismiss: (id: string) => void;
}

export const KioskToast: React.FC<KioskToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none select-none">
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto p-4 rounded-xl shadow-lg border flex items-start gap-3 transition ${
              isSuccess
                ? 'bg-white border-emerald-300 text-slate-800'
                : isError
                ? 'bg-white border-red-300 text-slate-800'
                : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            {/* Icon */}
            <div className="shrink-0 mt-0.5">
              {t.actionType === 'print' ? (
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                  <Printer className="w-5 h-5" />
                </div>
              ) : t.actionType === 'copy' ? (
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                  <FolderDown className="w-5 h-5" />
                </div>
              ) : isSuccess ? (
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : isError ? (
                <div className="p-1.5 rounded-lg bg-red-50 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                </div>
              ) : (
                <div className="p-1.5 rounded-lg bg-slate-50 text-slate-700">
                  <Info className="w-5 h-5" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-900 leading-tight">
                {t.title}
              </h4>
              {t.message && (
                <p className="text-xs text-slate-600 mt-1 font-medium leading-normal break-words">
                  {t.message}
                </p>
              )}
            </div>

            {/* Close */}
            <button
              onClick={() => onDismiss(t.id)}
              className="text-slate-400 hover:text-slate-600 p-1 shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
