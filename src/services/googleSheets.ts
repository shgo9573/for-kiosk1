import { getAccessToken } from './firebaseAuth';

export const DEFAULT_SPREADSHEET_ID = '1Mh8zGnHK-3PXq8uCP2Rbse7l2TId2F7rxc-wtYyGBkE';

export const getTargetSpreadsheetId = (): string => {
  try {
    const saved = localStorage.getItem('kiosk_spreadsheet_id');
    if (
      saved &&
      saved.trim() &&
      saved !== '1r9zeC2KAulaMFbCkL7aDgv4c8sCdzXnhYsCWWDiiXwI' &&
      saved !== '12M7Hr3q6tuPOjKfgyfCog6vD__3-AC1_5YWCaypCEGg'
    ) {
      return saved.trim();
    }
  } catch {}
  return DEFAULT_SPREADSHEET_ID;
};

export const TARGET_SPREADSHEET_ID = DEFAULT_SPREADSHEET_ID;

export interface StudentRegistrationPayload {
  firstName: string;
  lastName: string;
  idNumber: string;
  vaad: number | string;
}

export interface SheetAppendResult {
  success: boolean;
  message: string;
  updatedRange?: string;
  updatedRows?: number;
}

export class GoogleSheetsService {
  /**
   * Retrieves authorization headers with the current user's Google OAuth access token.
   */
  private static async getAuthHeaders(): Promise<HeadersInit> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('נדרש חיבור לחשבון Google כדי לבצע רישום בגיליון. אנא התחבר תחילה.');
    }
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Fetch spreadsheet metadata to get the active sheet name.
   */
  static async getSpreadsheetInfo(spreadsheetId: string = getTargetSpreadsheetId()): Promise<{
    title: string;
    firstSheetTitle: string;
    sheets: string[];
  }> {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=properties.title,sheets.properties.title`, {
      headers,
    });

    if (!res.ok) {
      const errText = await res.text();
      let parsedMessage = errText;
      try {
        const json = JSON.parse(errText);
        parsedMessage = json.error?.message || errText;
      } catch {}

      if (res.status === 403) {
        throw new Error(`אין הרשאת עריכה לגיליון (403): יש לוודא שהחשבון המחובר מורשה לערוך את הגיליון ${spreadsheetId}.`);
      } else if (res.status === 404) {
        throw new Error(`הגיליון לא נמצא (404): בדוק את מזהה הגיליון ${spreadsheetId}.`);
      } else if (res.status === 401) {
        throw new Error('פג תוקף החיבור לחשבון Google. אנא התחבר מחדש.');
      }
      throw new Error(`שגיאה בגישה לגיליון Google Sheets (${res.status}): ${parsedMessage}`);
    }

    const data = await res.json();
    const sheets = (data.sheets || []).map((s: any) => s?.properties?.title).filter(Boolean);
    const firstSheetTitle = sheets[0] || 'גיליון1';

    return {
      title: data.properties?.title || 'גיליון רישום',
      firstSheetTitle,
      sheets,
    };
  }

  /**
   * Checks if an ID is already registered in the spreadsheet.
   */
  static async checkExistingRegistration(
    idNumber: string,
    spreadsheetId: string = getTargetSpreadsheetId()
  ): Promise<{ exists: boolean; studentName?: string; rowNumber?: number }> {
    try {
      const info = await this.getSpreadsheetInfo(spreadsheetId);
      const headers = await this.getAuthHeaders();
      const cleanId = String(idNumber).trim();

      const range = encodeURIComponent(`${info.firstSheetTitle}!A1:D5000`);
      const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
        headers,
      });

      if (!res.ok) return { exists: false };
      const data = await res.json();
      const rows = data.values || [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        // Check column C (index 2) for ID, or fallback column B (index 1)
        const idInColC = String(row[2] || '').trim();
        const idInColB = String(row[1] || '').trim();

        if (idInColC === cleanId) {
          const first = String(row[0] || '').trim();
          const last = String(row[1] || '').trim();
          return {
            exists: true,
            studentName: `${first} ${last}`.trim() || undefined,
            rowNumber: i + 1,
          };
        } else if (idInColB === cleanId) {
          return {
            exists: true,
            studentName: String(row[0] || '').trim() || undefined,
            rowNumber: i + 1,
          };
        }
      }
      return { exists: false };
    } catch {
      return { exists: false };
    }
  }

  /**
   * Ensures header row exists in the first sheet if the sheet is empty.
   */
  private static async ensureHeaders(
    spreadsheetId: string,
    sheetTitle: string
  ): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      const range = encodeURIComponent(`${sheetTitle}!A1:E1`);
      const checkRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
        headers,
      });

      if (!checkRes.ok) return;
      const data = await checkRes.json();
      const rows = data.values || [];

      if (rows.length === 0 || !rows[0] || rows[0].length === 0) {
        // Sheet is empty, write header row with A=שם פרטי, B=שם משפחה, C=תעודת זהות, D=ועד, E=תאריך רישום
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            range: `${sheetTitle}!A1:E1`,
            majorDimension: 'ROWS',
            values: [['שם פרטי', 'שם משפחה', 'תעודת זהות', 'ועד', 'תאריך רישום']],
          }),
        });
      }
    } catch (err) {
      console.warn('Could not verify/write headers to sheet:', err);
    }
  }

  /**
   * Registers a student by appending their details to the spreadsheet.
   * Column A: שם פרטי (First Name)
   * Column B: שם משפחה (Last Name)
   * Column C: תעודת זהות (ID Number)
   * Column D: ועד (Va'ad - Number)
   * Column E: תאריך ושעת רישום
   */
  static async registerStudent(
    payload: StudentRegistrationPayload,
    spreadsheetId: string = getTargetSpreadsheetId()
  ): Promise<SheetAppendResult> {
    const firstName = payload.firstName.trim();
    const lastName = payload.lastName.trim();
    const idNumber = payload.idNumber.trim();
    const vaad = String(payload.vaad).trim();

    if (!firstName) {
      throw new Error('יש להזין שם פרטי מדויק כפי שרשום בישיבה');
    }
    if (!lastName) {
      throw new Error('יש להזין שם משפחה מדויק כפי שרשום בישיבה');
    }
    if (!idNumber) {
      throw new Error('יש להזין מספר תעודת זהות');
    }
    if (!vaad || isNaN(Number(vaad))) {
      throw new Error('יש להזין מספר ועד תקין (ספרות בלבד)');
    }

    const info = await this.getSpreadsheetInfo(spreadsheetId);
    const sheetTitle = info.firstSheetTitle;

    // Ensure header row exists if sheet is fresh
    await this.ensureHeaders(spreadsheetId, sheetTitle);

    const headers = await this.getAuthHeaders();
    const range = encodeURIComponent(`${sheetTitle}!A:E`);
    const nowIsrael = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });

    // Exact requested columns: A=First Name, B=Last Name, C=ID Number, D=Va'ad, E=Timestamp
    const newRow = [
      firstName,
      lastName,
      idNumber,
      Number(vaad),
      nowIsrael,
    ];

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        range: `${sheetTitle}!A:E`,
        majorDimension: 'ROWS',
        values: [newRow],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      let errorDesc = errText;
      try {
        const json = JSON.parse(errText);
        errorDesc = json.error?.message || errText;
      } catch {}

      if (res.status === 403) {
        throw new Error('אין הרשאת כתיבה לגיליון זה. ודא שהחשבון המחובר מורשה לערוך את הגיליון.');
      }
      throw new Error(`שגיאה ברישום לגיליון (${res.status}): ${errorDesc}`);
    }

    const resultData = await res.json();
    return {
      success: true,
      message: `התלמיד "${firstName} ${lastName}" נרשם בהצלחה בגיליון Google Sheets`,
      updatedRange: resultData.updates?.updatedRange,
      updatedRows: resultData.updates?.updatedRows || 1,
    };
  }
}
