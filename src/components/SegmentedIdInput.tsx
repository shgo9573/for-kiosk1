import React, { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface SegmentedIdInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
}

export const SegmentedIdInput: React.FC<SegmentedIdInputProps> = ({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  disabled = false,
  maxLength = 9,
  autoFocus = true,
}) => {
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && !disabled) {
      hiddenInputRef.current?.focus();
    }
  }, [autoFocus, disabled]);

  const handleContainerClick = () => {
    if (!disabled) {
      hiddenInputRef.current?.focus();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, maxLength);
    onChange(raw);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
  };

  // 3 Groups of 3 digits = 9 digits total
  const groups = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
  ];

  const activeIndex = value.length < maxLength ? value.length : -1;

  return (
    <div
      onClick={handleContainerClick}
      className="relative w-full cursor-text select-none py-1 px-1"
      dir="ltr"
    >
      {/* Hidden real input for accessibility, paste, and physical keyboard */}
      <input
        ref={hiddenInputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        disabled={disabled || isLoading}
        maxLength={maxLength}
        className="absolute inset-0 w-full h-full opacity-0 cursor-text pointer-events-auto z-10"
        aria-label="מספר תעודת זהות"
        autoComplete="off"
      />

      {/* Visual 3x3 Segmented Container - Perfectly fitted & responsive */}
      <div className="w-full flex items-center justify-between gap-1.5 sm:gap-2">
        {groups.map((groupIndices, groupIdx) => (
          <React.Fragment key={groupIdx}>
            {/* 3-Digit Block */}
            <div className="flex-1 flex items-center justify-between gap-1 p-1 sm:p-1.5 rounded-xl bg-slate-100/90 border border-slate-200/90 shadow-inner min-w-0">
              {groupIndices.map((slotIdx) => {
                const digit = value[slotIdx] || '';
                const isFilled = digit !== '';
                const isActive = slotIdx === activeIndex && !isLoading;

                return (
                  <div
                    key={slotIdx}
                    className={`flex-1 h-12 sm:h-14 rounded-lg flex items-center justify-center text-center transition-all duration-150 min-w-0 ${
                      isActive
                        ? 'bg-amber-50/90 border-2 border-[#c59b27] ring-2 ring-[#c59b27]/30 shadow-md scale-[1.03]'
                        : isFilled
                        ? 'bg-white border border-slate-300 shadow-xs'
                        : 'bg-white/80 border border-slate-200/80 text-slate-300'
                    }`}
                  >
                    {isFilled ? (
                      <span className="font-mono text-xl sm:text-2xl font-black text-slate-900 leading-none">
                        {digit}
                      </span>
                    ) : isActive ? (
                      <span className="w-0.5 h-5 sm:h-6 bg-[#c59b27] animate-pulse rounded-full" />
                    ) : (
                      <span className="text-slate-300 text-xs sm:text-sm font-bold select-none">
                        ·
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Separator dash between blocks */}
            {groupIdx < groups.length - 1 && (
              <div className="shrink-0 flex items-center justify-center text-slate-400 font-bold px-0.5 select-none">
                <span className="w-2 sm:w-2.5 h-1 bg-slate-300 rounded-full" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] rounded-xl flex items-center justify-center gap-2 z-20">
          <Loader2 className="w-5 h-5 animate-spin text-[#0f1d38]" />
          <span className="text-xs font-bold text-[#0f1d38] font-sans" dir="rtl">
            מחפש תיקייה...
          </span>
        </div>
      )}
    </div>
  );
};
