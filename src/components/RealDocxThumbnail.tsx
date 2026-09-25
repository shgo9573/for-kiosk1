import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { Loader2, FileText } from 'lucide-react';
import { KioskFile } from '../types';
import { GoogleDriveService } from '../services/googleDrive';
import mammoth from 'mammoth';

interface RealDocxThumbnailProps {
  file: KioskFile;
}

export const RealDocxThumbnail: React.FC<RealDocxThumbnailProps> = ({ file }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [rendered, setRendered] = useState<boolean>(false);
  const [rawHtml, setRawHtml] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadRealDocx = async () => {
      setLoading(true);
      try {
        const { arrayBuffer } = await GoogleDriveService.fetchFileBlob(file);
        if (isCancelled) return;

        // 1. Convert real docx to HTML using mammoth to enable 2x text magnification
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

  return (
    <div className="w-full h-full relative overflow-hidden bg-white rounded shadow-inner select-none pointer-events-none flex items-start justify-center">
      {loading ? (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-500 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
          <span className="text-xs font-semibold">טוען תצוגה מקדימה...</span>
        </div>
      ) : rawHtml ? (
        /* Real HTML from document with 2x (200%) larger font */
        <div className="w-full h-full bg-white text-slate-950 p-3.5 text-right overflow-hidden relative font-serif direction-rtl select-none">
          <div
            className="preview-2x-text leading-relaxed font-bold text-slate-900 line-clamp-[9]"
            style={{
              fontSize: '20px',
              lineHeight: '1.4',
              direction: 'rtl',
              textAlign: 'right',
            }}
            dangerouslySetInnerHTML={{ __html: rawHtml }}
          />
          {/* Subtle gradient at bottom for smooth fade */}
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
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
              fontSize: '19px',
              lineHeight: '1.35',
            }}
          />
        </div>
      ) : file.thumbnailLink ? (
        <img
          src={file.thumbnailLink}
          alt={`עמוד ראשון - ${file.name}`}
          className="w-full h-full object-cover object-top scale-110"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-slate-600 p-3 text-center">
          <FileText className="w-12 h-12 text-blue-600 mb-2" />
          <span className="text-base text-slate-900 font-extrabold line-clamp-2">{file.name}</span>
        </div>
      )}
    </div>
  );
};
