import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { Loader2, FileText, CheckCircle2 } from 'lucide-react';
import { KioskFile } from '../types';
import { GoogleDriveService } from '../services/googleDrive';
import mammoth from 'mammoth';

interface RealDocxThumbnailProps {
  file: KioskFile;
}

export const RealDocxThumbnail: React.FC<RealDocxThumbnailProps> = ({ file }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rawHtml, setRawHtml] = useState<string | null>(file.previewHtml || null);
  const [loading, setLoading] = useState<boolean>(!file.previewHtml);
  const [rendered, setRendered] = useState<boolean>(!!file.previewHtml);
  const [imageError, setImageError] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;

    // If we already have preview HTML from server, use it immediately
    if (file.previewHtml && file.previewHtml.trim().length > 0) {
      setRawHtml(file.previewHtml);
      setRendered(true);
      setLoading(false);
      return;
    }

    const loadRealDocx = async () => {
      setLoading(true);
      setImageError(false);
      try {
        const { arrayBuffer } = await GoogleDriveService.fetchFileBlob(file);
        if (isCancelled) return;

        // 1. Convert real docx to HTML using mammoth to enable authentic text preview
        const mammothResult = await mammoth.convertToHtml({ arrayBuffer });
        if (!isCancelled && mammothResult.value && mammothResult.value.trim().length > 0) {
          setRawHtml(mammothResult.value);
          setRendered(true);
          setLoading(false);
          return;
        }

        // 2. Try docx-preview as fallback
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          try {
            await renderAsync(arrayBuffer, containerRef.current, undefined, {
              inWrapper: false,
              ignoreWidth: true,
              breakPages: false,
              experimental: false,
              trimXml: true,
            });
            if (!isCancelled) {
              setRendered(true);
              setLoading(false);
              return;
            }
          } catch (docxErr) {
            console.warn('docx-preview error:', docxErr);
          }
        }

        if (file.previewHtml && !isCancelled) {
          setRawHtml(file.previewHtml);
          setRendered(true);
        }
      } catch (err) {
        console.warn('Could not render docx text:', err);
        if (file.previewHtml && !isCancelled) {
          setRawHtml(file.previewHtml);
          setRendered(true);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    loadRealDocx();

    return () => {
      isCancelled = true;
    };
  }, [file]);

  // Clean document page view for when raw text is empty/unparseable
  const renderDocumentPagePlaceholder = () => (
    <div className="w-full h-full bg-white flex flex-col justify-between p-3.5 text-center relative select-none" dir="rtl">
      {/* Top Header of Simulated Document Page */}
      <div className="w-full flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-[#185abd] text-white font-bold text-[11px] flex items-center justify-center shadow-xs">
            W
          </div>
          <span className="text-[11px] font-bold text-slate-700">Word .docx</span>
        </div>
        <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          עמוד 1
        </span>
      </div>

      {/* Sheet Content Simulation */}
      <div className="flex-1 flex flex-col items-center justify-center py-2 px-1">
        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center mb-2 border border-blue-100">
          <FileText className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-extrabold text-slate-900 leading-snug line-clamp-2 mb-2 font-serif">
          {file.name}
        </h4>

        {/* Decorative document lines indicating text content */}
        <div className="w-full max-w-[180px] space-y-1.5 opacity-60">
          <div className="h-1.5 bg-slate-300 rounded-full w-full" />
          <div className="h-1.5 bg-slate-200 rounded-full w-5/6 mx-auto" />
          <div className="h-1.5 bg-slate-200 rounded-full w-4/6 mx-auto" />
          <div className="h-1.5 bg-slate-100 rounded-full w-3/6 mx-auto" />
        </div>
      </div>

      {/* Bottom Footer Ribbon */}
      <div className="w-full pt-2 border-t border-slate-100 flex items-center justify-center gap-1 text-[11px] font-medium text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>מוכן להדפסה ישירה ולהעתקה</span>
      </div>
    </div>
  );

  return (
    <div className="w-full h-full relative overflow-hidden bg-white rounded shadow-inner select-none pointer-events-none flex items-start justify-center">
      {loading ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
          <span className="text-xs font-semibold">טוען עמוד ראשון...</span>
        </div>
      ) : rawHtml ? (
        /* Real HTML from document with authentic Hebrew typography */
        <div className="w-full h-full bg-white text-slate-950 p-3 text-right overflow-hidden relative select-none flex flex-col justify-start" dir="rtl">
          {/* Header ribbon of the document preview */}
          <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-200 text-slate-500 text-[10px] font-sans shrink-0">
            <span className="font-bold text-blue-900 flex items-center gap-1.5">
              <span className="w-4 h-4 bg-blue-700 text-white rounded text-[10px] flex items-center justify-center font-bold">W</span>
              <span>עמוד ראשון מתוך המסמך</span>
            </span>
            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px]">
              Word .docx
            </span>
          </div>

          <div
            className="docx-content-page text-[15px] leading-relaxed text-slate-900 text-right overflow-hidden flex-1"
            style={{
              direction: 'rtl',
              textAlign: 'right',
            }}
            dangerouslySetInnerHTML={{ __html: rawHtml }}
          />

          {/* Fade out at bottom of the page */}
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white via-white/85 to-transparent pointer-events-none" />
        </div>
      ) : rendered && containerRef.current ? (
        /* docx-preview fallback with 2x scale */
        <div className="w-full h-full overflow-hidden relative bg-white flex justify-center p-3">
          <div
            ref={containerRef}
            className="real-docx-page-view origin-top-right text-right direction-rtl pointer-events-none select-none text-black w-full h-full font-bold"
            style={{
              direction: 'rtl',
              fontFamily: 'serif',
              fontSize: '18px',
              lineHeight: '1.35',
            }}
          />
        </div>
      ) : (file.thumbnailLink || file.id) && !imageError && !file.id.startsWith('local_') ? (
        <img
          src={`/api/drive-thumbnail?fileId=${file.id}`}
          alt=""
          onError={() => setImageError(true)}
          className="w-full h-full object-cover object-top scale-105"
        />
      ) : (
        renderDocumentPagePlaceholder()
      )}
    </div>
  );
};
