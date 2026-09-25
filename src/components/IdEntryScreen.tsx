import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { NumericKeypad } from './NumericKeypad';

interface IdEntryScreenProps {
  onSearch: (id: string) => Promise<boolean>;
  isLoading: boolean;
  errorMessage: string | null;
  onClearError: () => void;
  isDriveConnected?: boolean;
}

export const IdEntryScreen: React.FC<IdEntryScreenProps> = ({
  onSearch,
  isLoading,
  errorMessage,
  onClearError,
}) => {
  const [idInput, setIdInput] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleDigit = (digit: string) => {
    if (idInput.length < 12) {
      if (errorMessage) onClearError();
      setIdInput((prev) => prev + digit);
    }
  };

  const handleBackspace = () => {
    if (errorMessage) onClearError();
    setIdInput((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (errorMessage) onClearError();
    setIdInput('');
  };

  const handleSubmit = async () => {
    if (!idInput.trim() || isLoading) return;
    await onSearch(idInput.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-2xl mx-auto w-full select-none">
      {/* Main Card Container */}
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-xl p-8 shadow-sm">
        {/* Title */}
        <div className="text-center mb-6 pb-4 border-b border-slate-100">
          <h2 className="text-2xl font-bold text-slate-800 font-serif tracking-tight mb-1">
            הקש תעודת זהות
          </h2>
          <p className="text-slate-500 text-xs">
            הזן מספר זהות לפתיחת תיקיית המסמכים
          </p>
        </div>

        {/* Input Field */}
        <div className="mb-6">
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={idInput}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setIdInput(val);
                if (errorMessage) onClearError();
              }}
              onKeyDown={handleKeyDown}
              placeholder="000000000"
              maxLength={12}
              className="w-full h-16 bg-slate-50 border-2 border-slate-300 focus:border-[#0f1d38] focus:bg-white rounded-lg text-center text-3xl font-mono font-bold tracking-widest text-slate-900 placeholder-slate-300 outline-none transition"
            />
            {isLoading && (
              <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center text-[#0f1d38]">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            )}
          </div>

          {/* Error message */}
          {errorMessage && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
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
      </div>
    </div>
  );
};
