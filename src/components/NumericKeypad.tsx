import React from 'react';
import { Delete, RotateCcw, ArrowLeft } from 'lucide-react';

interface NumericKeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  onDigit,
  onBackspace,
  onClear,
  onSubmit,
  disabled = false,
}) => {
  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div className="w-full max-w-sm mx-auto grid grid-cols-3 gap-2.5 select-none">
      {/* 1 - 9 */}
      {digits.map((digit) => (
        <button
          key={digit}
          type="button"
          disabled={disabled}
          onClick={() => onDigit(digit)}
          className="h-16 rounded-lg bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-mono text-2xl font-bold border border-slate-300 shadow-sm active:translate-y-0.5 transition flex items-center justify-center disabled:opacity-40 cursor-pointer"
        >
          {digit}
        </button>
      ))}

      {/* Clear */}
      <button
        type="button"
        disabled={disabled}
        onClick={onClear}
        className="h-16 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 active:bg-slate-300 font-medium text-xs border border-slate-300 shadow-sm active:translate-y-0.5 transition flex flex-col items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
      >
        <RotateCcw className="w-4 h-4 text-slate-500" />
        <span>איפוס</span>
      </button>

      {/* 0 */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDigit('0')}
        className="h-16 rounded-lg bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 font-mono text-2xl font-bold border border-slate-300 shadow-sm active:translate-y-0.5 transition flex items-center justify-center disabled:opacity-40 cursor-pointer"
      >
        0
      </button>

      {/* Backspace */}
      <button
        type="button"
        disabled={disabled}
        onClick={onBackspace}
        className="h-16 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 active:bg-slate-300 font-medium text-xs border border-slate-300 shadow-sm active:translate-y-0.5 transition flex flex-col items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
      >
        <Delete className="w-4 h-4 text-slate-500" />
        <span>מחיקה</span>
      </button>

      {/* Submit button */}
      <div className="col-span-3 pt-2">
        <button
          type="button"
          disabled={disabled}
          onClick={onSubmit}
          className="w-full h-15 rounded-lg bg-[#0f1d38] hover:bg-[#162a52] active:scale-[0.99] text-white font-bold text-base shadow flex items-center justify-center gap-2 border border-[#0f1d38] transition disabled:opacity-50 cursor-pointer"
        >
          <span>איתור תיקייה ופתיחת קבצים</span>
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
