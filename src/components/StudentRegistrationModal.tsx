import React, { useState, useEffect } from 'react';
import {
  X,
  UserPlus,
  AlertCircle,
  CheckCircle2,
  Loader2,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { GoogleSheetsService, TARGET_SPREADSHEET_ID } from '../services/googleSheets';
import { getAccessToken } from '../services/firebaseAuth';

interface StudentRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRegisteredSuccess?: (studentId: string, studentName: string) => void;
  initialId?: string;
}

export const StudentRegistrationModal: React.FC<StudentRegistrationModalProps> = ({
  isOpen,
  onClose,
  onRegisteredSuccess,
  initialId = '',
}) => {
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [idNumber, setIdNumber] = useState<string>(initialId);
  const [vaad, setVaad] = useState<string>('1');

  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false);
  const [successInfo, setSuccessInfo] = useState<{
    firstName: string;
    lastName: string;
    id: string;
    vaad: string;
  } | null>(null);

  // Clean and reset all form fields
  const resetFormFields = (prefillId = '') => {
    setFirstName('');
    setLastName('');
    setIdNumber(prefillId ? prefillId.trim() : '');
    setVaad('1');
    setErrorMessage(null);
    setShowConfirmation(false);
    setSuccessInfo(null);
  };

  // Reset form whenever modal opens or closes
  useEffect(() => {
    if (isOpen) {
      resetFormFields(initialId);
      checkAuthState();
    } else {
      resetFormFields();
    }
  }, [isOpen, initialId]);

  const checkAuthState = async () => {
    const token = await getAccessToken();
    setHasToken(!!token);
  };

  const validateForm = (): boolean => {
    setErrorMessage(null);
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanId = idNumber.trim();
    const cleanVaad = vaad.trim();

    if (!cleanFirst || cleanFirst.length < 2) {
      setErrorMessage('נא להזין שם פרטי מדויק כפי שרשום בישיבה (לפחות 2 אותיות)');
      return false;
    }

    if (!cleanLast || cleanLast.length < 2) {
      setErrorMessage('נא להזין שם משפחה מדויק כפי שרשום בישיבה (לפחות 2 אותיות)');
      return false;
    }

    if (!cleanId || !/^\d{5,9}$/.test(cleanId)) {
      setErrorMessage('נא להזין תעודת זהות תקינה (ספרות בלבד, 5 עד 9 ספרות)');
      return false;
    }

    if (!cleanVaad || isNaN(Number(cleanVaad)) || Number(cleanVaad) < 1) {
      setErrorMessage('בוועד יש להכניס מספר תקין (לדוגמה: 1, 2, 3...)');
      return false;
    }

    return true;
  };

  const handleProceedToConfirm = async () => {
    if (!validateForm()) return;

    if (!hasToken) {
      setErrorMessage('העמדה טרם חוברה לחשבון Google ע"י מנהל המערכת. נא לפנות למנהל לחיבור ראשוני באזור הניהול.');
      return;
    }

    // Optional duplicate check in spreadsheet before asking confirmation
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const existing = await GoogleSheetsService.checkExistingRegistration(idNumber.trim());
      if (existing.exists) {
        const proceed = window.confirm(
          `לתשומת לבך: תעודת זהות ${idNumber.trim()} כבר רשומה בגיליון (שם קיים: "${existing.studentName || 'ללא שם'}").\n\nהאם ברצונך להמשיך ברישום בכל זאת?`
        );
        if (!proceed) {
          setIsLoading(false);
          return;
        }
      }
      setShowConfirmation(true);
    } catch {
      // Non-blocking, continue to confirm
      setShowConfirmation(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSubmit = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      await GoogleSheetsService.registerStudent({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        idNumber: idNumber.trim(),
        vaad: Number(vaad.trim()),
      });

      const registered = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        id: idNumber.trim(),
        vaad: vaad.trim(),
      };
      setSuccessInfo(registered);
      setShowConfirmation(false);
    } catch (err: any) {
      console.error('Registration error:', err);
      setErrorMessage(err.message || 'אירעה שגיאה בעת שמירת הנתונים בגיליון Google Sheets');
      setShowConfirmation(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetForm = () => {
    resetFormFields();
  };

  const handleCloseModal = () => {
    resetFormFields();
    onClose();
  };

  const handleSearchRegistered = () => {
    if (successInfo && onRegisteredSuccess) {
      const id = successInfo.id;
      const name = `${successInfo.firstName} ${successInfo.lastName}`;
      resetFormFields();
      onRegisteredSuccess(id, name);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs select-none">
      <div className="bg-white border-2 border-[#c59b27] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0f1d38] border border-[#c59b27]/60 flex items-center justify-center text-[#d4af37] shrink-0">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 font-serif leading-tight">
                רישום תלמיד חדש
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                הזנת פרטים לגיליון התלמידים המרכזי
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            aria-label="סגור"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto flex-1 py-4 space-y-4">
          {/* Success Screen */}
          {successInfo ? (
            <div className="py-4 px-2 space-y-5 text-center flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center text-emerald-600 shadow-inner">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1">
                <h4 className="text-xl font-bold text-slate-900 font-serif">
                  הרישום הושלם בהצלחה!
                </h4>
                <p className="text-xs text-slate-600 max-w-sm">
                  פרטי התלמיד נשמרו בגיליון: שם פרטי (A), שם משפחה (B), ת.ז. (C), ועד (D)
                </p>
              </div>

              {/* Summary Card */}
              <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-right space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200/80">
                  <span className="text-slate-500 font-medium">שם פרטי (עמודה A):</span>
                  <span className="text-slate-900 font-bold font-serif text-sm">{successInfo.firstName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/80">
                  <span className="text-slate-500 font-medium">שם משפחה (עמודה B):</span>
                  <span className="text-slate-900 font-bold font-serif text-sm">{successInfo.lastName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200/80">
                  <span className="text-slate-500 font-medium">תעודת זהות (עמודה C):</span>
                  <span className="text-slate-900 font-mono font-bold tracking-wider">{successInfo.id}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500 font-medium">ועד (עמודה D):</span>
                  <span className="text-slate-900 font-bold">{successInfo.vaad}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 w-full pt-2">
                <button
                  type="button"
                  onClick={handleSearchRegistered}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#0f1d38] hover:bg-[#16274a] text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer border border-[#c59b27]"
                >
                  <UserCheck className="w-4 h-4 text-[#d4af37]" />
                  <span>אתר תיקייה כעת עם ת.ז. זו</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition cursor-pointer"
                >
                  רישום תלמיד נוסף
                </button>
              </div>
            </div>
          ) : showConfirmation ? (
            /* Confirmation Step */
            <div className="space-y-4 py-2">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 space-y-1">
                  <div className="font-bold">אישור הוספת נתונים לגיליון הישיבה</div>
                  <div className="text-amber-800">
                    פעולה זו תוסיף שורה חדשה בגיליון התלמידים עם הפרטים שלהלן:
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs space-y-2.5">
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">שם פרטי (עמודה A):</span>
                  <span className="text-slate-900 font-bold font-serif text-sm">{firstName.trim()}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">שם משפחה (עמודה B):</span>
                  <span className="text-slate-900 font-bold font-serif text-sm">{lastName.trim()}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">תעודת זהות (עמודה C):</span>
                  <span className="text-slate-900 font-mono font-bold tracking-wider">{idNumber.trim()}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-200">
                  <span className="text-slate-500 font-medium">מספר ועד (עמודה D):</span>
                  <span className="text-slate-900 font-bold">{vaad.trim()}</span>
                </div>
                <div className="flex justify-between items-center py-1 text-[11px] text-slate-400">
                  <span>מזהה גיליון:</span>
                  <span className="font-mono" dir="ltr">{TARGET_SPREADSHEET_ID.slice(0, 12)}...</span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmation(false)}
                  disabled={isLoading}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition cursor-pointer"
                >
                  חזור לעריכה
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSubmit}
                  disabled={isLoading}
                  className="px-6 py-2.5 rounded-xl bg-[#0f1d38] hover:bg-[#16274a] text-white font-bold text-xs shadow-md transition flex items-center gap-2 cursor-pointer border border-[#c59b27] disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#d4af37]" />
                      <span>רושם בגיליון...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>אשר ורשום כעת בגיליון</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* Main Form - Simple & Clean without Google Login Button */
            <div className="space-y-4">
              {/* Note about accurate naming */}
              <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50/90 p-3 rounded-xl border border-amber-200/80">
                <HelpCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span className="font-medium">
                  נא להזין את השם המדויק כפי שרשום בישיבה
                </span>
              </div>

              {/* Grid: Field 1 (שם פרטי - A) & Field 2 (שם משפחה - B) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Field 1: שם פרטי */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    שם פרטי <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="לדוגמה: ישראל"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#0f1d38] focus:ring-2 focus:ring-[#0f1d38]/15 text-sm font-serif text-slate-900 transition outline-none"
                    autoFocus
                  />
                  <span className="text-[10px] text-slate-400 block">עמודה A בגיליון</span>
                </div>

                {/* Field 2: שם משפחה */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    שם משפחה <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="לדוגמה: כהן"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#0f1d38] focus:ring-2 focus:ring-[#0f1d38]/15 text-sm font-serif text-slate-900 transition outline-none"
                  />
                  <span className="text-[10px] text-slate-400 block">עמודה B בגיליון</span>
                </div>
              </div>

              {/* Field 3: תעודת זהות (עמודה C) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  תעודת זהות <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={9}
                    value={idNumber}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9]/g, '');
                      setIdNumber(clean);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="הזן 9 ספרות"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#0f1d38] focus:ring-2 focus:ring-[#0f1d38]/15 text-sm font-mono tracking-wider text-slate-900 transition outline-none"
                  />
                  {idNumber.length > 0 && (
                    <span className="absolute left-3 top-2.5 text-[11px] font-mono text-slate-400">
                      {idNumber.length}/9
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 block">עמודה C בגיליון</span>
              </div>

              {/* Field 4: ועד (להכניס מספר - עמודה D) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  ועד <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="20"
                    value={vaad}
                    onChange={(e) => {
                      setVaad(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="1"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-[#0f1d38] focus:ring-2 focus:ring-[#0f1d38]/15 text-sm font-semibold text-slate-900 transition outline-none"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-100/90 px-2.5 py-1.5 rounded-lg border border-slate-200">
                  <span>ועד - להכניס מספר (לדוגמה: 1, 2, 3...)</span>
                  <span className="text-[10px] text-slate-500 font-mono">עמודה D</span>
                </div>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition cursor-pointer"
                >
                  ביטול
                </button>

                <button
                  type="button"
                  onClick={handleProceedToConfirm}
                  disabled={isLoading}
                  className="px-6 py-2.5 rounded-xl bg-[#0f1d38] hover:bg-[#16274a] text-white font-bold text-xs shadow-md transition flex items-center gap-2 cursor-pointer border border-[#c59b27] disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-[#d4af37]" />
                      <span>בודק...</span>
                    </>
                  ) : (
                    <>
                      <span>המשך לרישום</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#d4af37]" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
