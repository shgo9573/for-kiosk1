import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  isModalOpen?: boolean;
}

export const IdEntryScreen: React.FC<IdEntryScreenProps> = ({
  onSearch,
  isLoading,
  errorMessage,
  onClearError,
  onOpenRegistration,
  isModalOpen = false,
}) => {
  const [idInput, setIdInput] = useState<string>('');
  const idInputRef = useRef<string>('');
  idInputRef.current = idInput;

  const triggerAutoSearch = useCallback((fullId: string) => {
    if (!isLoading && fullId.trim().length === 9) {
      setTimeout(() => {
        onSearch(fullId.trim());
      }, 80);
    }
  }, [isLoading, onSearch]);

  const handleDigit = useCallback((digit: string) => {
    if (isLoading) return;
    const current = idInputRef.current;
    if (current.length < 9) {
      if (errorMessage) onClearError();
      const next = current + digit;
      setIdInput(next);
      if (next.length === 9) {
        triggerAutoSearch(next);
      }
    }
  }, [isLoading, errorMessage, onClearError, triggerAutoSearch]);

  const handleBackspace = useCallback(() => {
    if (isLoading) return;
    if (errorMessage) onClearError();
    setIdInput((prev) => prev.slice(0, -1));
  }, [isLoading, errorMessage, onClearError]);

  const handleClear = useCallback(() => {
    if (isLoading) return;
    if (errorMessage) onClearError();
    setIdInput('');
  }, [isLoading, errorMessage, onClearError]);

  const handleSubmit = useCallback(async () => {
    const current = idInputRef.current;
    if (!current.trim() || isLoading) return;
    await onSearch(current.trim());
  }, [isLoading, onSearch]);

  const handleInputChange = useCallback((val: string) => {
    if (isLoading) return;
    setIdInput(val);
    if (errorMessage) onClearError();
    if (val.length === 9) {
      triggerAutoSearch(val);
    }
  }, [isLoading, errorMessage, onClearError, triggerAutoSearch]);

  // Global physical keyboard listener & automatic input focusing
  // Whenever the software is open on the home screen, typing a number immediately enters it into the ID field
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Do not intercept if a modal (registration, admin) is active or system is loading
      if (isModalOpen || isLoading) return;

      // If active element is an input/textarea outside the ID field, ignore
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT') &&
        !activeEl.classList.contains('segmented-id-hidden-input')
      ) {
        return;
      }

      // If Alt, Ctrl, or Meta (Command/Windows) keys are pressed (e.g. shortcuts), ignore
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      // Extract digit from key or code (supports standard numbers, Hebrew layout, and Numpad with NumLock ON or OFF)
      let digit: string | null = null;
      if (/^[0-9]$/.test(e.key)) {
        digit = e.key;
      } else if (e.code && /^Digit([0-9])$/.test(e.code)) {
        digit = e.code.replace('Digit', '');
      } else if (e.code && /^Numpad([0-9])$/.test(e.code)) {
        digit = e.code.replace('Numpad', '');
      }

      if (digit !== null) {
        e.preventDefault();
        const hiddenInput = document.querySelector<HTMLInputElement>('.segmented-id-hidden-input');
        if (hiddenInput && document.activeElement !== hiddenInput) {
          hiddenInput.focus();
        }
        handleDigit(digit);
        return;
      }

      if (e.key === 'Backspace' || e.code === 'Backspace') {
        e.preventDefault();
        handleBackspace();
        return;
      }

      if (e.key === 'Enter' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        handleSubmit();
        return;
      }

      if (e.key === 'Escape' || e.key === 'Delete' || e.code === 'Escape' || e.code === 'Delete') {
        e.preventDefault();
        handleClear();
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [isModalOpen, isLoading, handleDigit, handleBackspace, handleClear, handleSubmit]);

  // Keep ID input focused automatically whenever the home screen is active
  useEffect(() => {
    const focusIdInput = () => {
      if (!isModalOpen && !isLoading) {
        const hiddenInput = document.querySelector<HTMLInputElement>('.segmented-id-hidden-input');
        hiddenInput?.focus();
      }
    };

    const handleDocumentPointer = (e: Event) => {
      if (isModalOpen || isLoading) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (
        target.closest('button') ||
        target.closest('a') ||
        target.closest('textarea') ||
        target.closest('select') ||
        (target.closest('input') && !target.classList.contains('segmented-id-hidden-input'))
      ) {
        return;
      }
      focusIdInput();
    };

    window.addEventListener('focus', focusIdInput);
    document.addEventListener('pointerdown', handleDocumentPointer);
    
    // Focus immediately on mount and after a short tick
    focusIdInput();
    const timer = setTimeout(focusIdInput, 120);

    return () => {
      window.removeEventListener('focus', focusIdInput);
      document.removeEventListener('pointerdown', handleDocumentPointer);
      clearTimeout(timer);
    };
  }, [isModalOpen, isLoading]);

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
