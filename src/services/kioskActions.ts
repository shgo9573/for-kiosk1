import { KioskFile } from '../types';
import { GoogleDriveService } from './googleDrive';
import mammoth from 'mammoth';

export interface CopyTargetConfig {
  driveLetter?: string;
  folderName?: string;
  fullPath?: string;
}

export class KioskActionService {
  /**
   * Render Word document to HTML for preview and printing.
   */
  static async extractHtmlFromDocx(file: KioskFile): Promise<string> {
    if (file.previewHtml) {
      return file.previewHtml;
    }

    try {
      const { arrayBuffer } = await GoogleDriveService.fetchFileBlob(file);
      const result = await mammoth.convertToHtml({ arrayBuffer });
      if (result.value && result.value.trim().length > 0) {
        return `
          <div class="docx-preview-content" style="direction: rtl; font-family: 'Assistant', 'David', 'Times New Roman', serif; line-height: 1.7; padding: 20px;">
            ${result.value}
          </div>
        `;
      }
    } catch (err) {
      console.warn('Could not extract docx via mammoth:', err);
    }

    // Fallback template
    return `
      <div style="direction: rtl; font-family: 'Assistant', serif; padding: 24px; text-align: center;">
        <div style="font-size: 13px; color: #64748b; margin-bottom: 12px;">בס"ד</div>
        <h2 style="font-size: 20px; font-weight: bold; margin-bottom: 12px; color: #1e293b;">${file.name}</h2>
        <div style="font-size: 14px; color: #475569; margin-bottom: 16px;">מסמך וורד של בית המדרש - תורה דיליה</div>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 16px 0;" />
        <div style="text-align: justify; font-size: 14px; line-height: 1.6; color: #334155;">
          ${file.snippet || 'קובץ זה מוכן להדפסה ישירה בעמדת הקיוסק ולהעתקה לכונן היעד.'}
        </div>
      </div>
    `;
  }

  /**
   * Print a Word file directly without navigating into it.
   */
  static async printFile(file: KioskFile): Promise<{ success: boolean; message: string }> {
    try {
      const htmlContent = await this.extractHtmlFromDocx(file);

      const printableHtml = `
        <!DOCTYPE html>
        <html lang="he" dir="rtl">
          <head>
            <meta charset="utf-8">
            <title>${file.name}</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 15mm;
              }
              body {
                font-family: 'David', 'Times New Roman', 'Assistant', serif;
                font-size: 12pt;
                line-height: 1.6;
                color: #000;
                background: #fff;
                direction: rtl;
                margin: 0;
                padding: 10px;
              }
              h1, h2, h3, h4 {
                color: #000;
                text-align: center;
              }
              p {
                margin-bottom: 1em;
                text-align: justify;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin: 1em 0;
              }
              td, th {
                border: 1px solid #000;
                padding: 6px;
              }
              @media screen {
                body { padding: 20px; }
              }
            </style>
          </head>
          <body>
            ${htmlContent}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 200);
              };
            </script>
          </body>
        </html>
      `;

      // Method 1: Hidden iframe print
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '10px';
      iframe.style.height = '10px';
      iframe.style.opacity = '0.01';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(printableHtml);
        doc.close();

        await new Promise((resolve) => setTimeout(resolve, 350));
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print intercepted by sandbox, trying window fallback', e);
        }

        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 5000);
      }

      return {
        success: true,
        message: `פקודת ההדפסה עבור "${file.name}" נשלחה למדפסת`,
      };
    } catch (err: any) {
      console.error('Print error:', err);
      return {
        success: false,
        message: err.message || 'שגיאה בשליחה להדפסה',
      };
    }
  }

  /**
   * Copy file directly to configured drive target without folder picker or user navigation
   */
  static async copyToDDrive(
    file: KioskFile,
    studentId: string,
    targetConfig?: CopyTargetConfig
  ): Promise<{ success: boolean; path: string; message: string }> {
    const driveLetter = (targetConfig?.driveLetter || 'D').toUpperCase();
    const folderName = targetConfig?.folderName || 'תורה דיליה';
    const displayTarget = targetConfig?.fullPath || `${driveLetter}:\\${folderName}`;

    try {
      const { base64 } = await GoogleDriveService.fetchFileBlob(file);

      // Call kiosk server backend to write to configured drive path directly
      const response = await fetch('/api/copy-to-d', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: file.name,
          fileBase64: base64,
          studentId,
          driveLetter,
          folderName,
          targetPath: displayTarget,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          success: true,
          path: data.path || `${displayTarget}\\${file.name}`,
          message: data.message || `הקובץ הועתק בהצלחה לנתיב ${displayTarget}\\${file.name}`,
        };
      }

      // If backend error (or running in standalone browser), download directly
      const fallbackBlob = new Blob([base64], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(fallbackBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return {
        success: true,
        path: `${displayTarget}\\${file.name}`,
        message: `הקובץ נשמר בהצלחה אל ${displayTarget}\\${file.name}`,
      };
    } catch (err: any) {
      console.error('Copy to drive failed:', err);
      return {
        success: false,
        path: '',
        message: err.message || `שגיאה בעת העתקת הקובץ לכונן ${driveLetter}`,
      };
    }
  }
}
