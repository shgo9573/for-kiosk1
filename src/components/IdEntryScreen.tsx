import React, { useState } from 'react';
import { AlertCircle, UserPlus, ArrowLeft } from 'lucide-react';
import { NumericKeypad } from './NumericKeypad';
import { SegmentedIdInput } from './SegmentedIdInput';
import { TorahLogo } from './TorahLogo';

interface IdEntryScreenProps {
  onSearch: (id: string) => Promise<boolean>;
  isLoading: boolean;
  errorMessage: string | null;
  onClearError: () => void;
  isDriveConnected?: boolean;
  onOpenRegistration?: (currentId?: string) => void;
}

export const IdEntryScreen: React.FC<IdEntryScreenProps> = ({
  onSearch,
  isLoading,
  errorMessage,
  onClearError,
  onOpenRegistration,
}) => {
  const [idInput, setIdInput] = useState<string>('');

  const triggerAutoSearch = (fullId: string) => {
    if (!isLoading && fullId.trim().length === 9) {
      setTimeout(() => {
        onSearch(fullId.trim());
      }, 80);
    }
  };

  const handleDigit = (digit: string) => {
    if (isLoading) return;
    if (idInput.length < 9) {
      if (errorMessage) onClearError();
      const next = idInput + digit;
      setIdInput(next);
      if (next.length === 9) {
        triggerAutoSearch(next);
      }
    }
  };

  const handleBackspace = () => {
    if (isLoading) return;
    if (errorMessage) onClearError();
    setIdInput((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isLoading) return;
    if (errorMessage) onClearError();
    setIdInput('');
  };

  const handleSubmit = async () => {
    if (!idInput.trim() || isLoading) return;
    await onSearch(idInput.trim());
  };

  const handleInputChange = (val: string) => {
    if (isLoading) return;
    setIdInput(val);
    if (errorMessage) onClearError();
    if (val.length === 9) {
      triggerAutoSearch(val);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 max-w-xl mx-auto w-full select-none">
      {/* Main Card Container */}
      <div className="w-full max-w-[440px] bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-md">
        {/* Emblem & Title */}
        <div className="text-center mb-4 pb-3 border-b border-slate-100 flex flex-col items-center">
          <div className="mb-1.5">
            <TorahLogo size="md" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 font-serif tracking-tight mb-0.5">
            הקש תעודת זהות
          </h2>
          <p className="text-slate-500 text-xs font-medium">
            הזן 9 ספרות ת.ז. לפתיחה אוטומטית של התיקייה
          </p>
        </div>

        {/* 3x3 Segmented Input Field on Single Line - Perfectly Contained */}
        <div className="mb-4">
          <SegmentedIdInput
            value={idInput}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            disabled={isLoading}
            maxLength={9}
            autoFocus={true}
          />

          {/* Error message */}
          {errorMessage && (
            <div className="mt-2.5 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="font-medium">{errorMessage}</span>
              </div>
              {onOpenRegistration && (
                <button
                  type="button"
                  onClick={() => onOpenRegistration(idInput)}
                  className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-red-300 text-red-800 hover:bg-red-50 text-[11px] font-bold shadow-2xs transition cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 text-red-600" />
                  <span>לא רשום עדיין בישיבה? לחץ כאן לרישום תלמיד</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Touch Numeric Keypad */}
        <NumericKeypad
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          onClear={handleClear}
          onSubmit={handleSubmit}
          disabled={isLoading}
        />

        {/* Dedicated Registration Button */}
        {onOpenRegistration && (
          <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col items-center">
            <button
              type="button"
              onClick={() => onOpenRegistration(idInput)}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-emerald-50 active:bg-emerald-100 border border-slate-200 hover:border-emerald-300 text-slate-800 hover:text-emerald-900 text-xs font-bold transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer group"
            >
              <UserPlus className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
              <span>רישום תלמיד חדש בגיליון הישיבה</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
