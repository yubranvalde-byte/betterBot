import { useRef, useState } from 'react';
import {
  CaretDown,
  CaretUp,
  CircleNotch,
  FileCode,
  FilePdf,
  FileText,
  Image as ImageIcon,
  Paperclip,
  X,
} from '@phosphor-icons/react';
import type { ContextAttachment } from '../../types/api';
import { Tooltip } from '../Tooltip';

const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.txt',
  '.md',
  '.py',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.sql',
  '.csv',
  '.c',
  '.cpp',
  '.h',
  '.hpp',
  '.html',
  '.css',
]);
const ACCEPTED_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);
const FILE_INPUT_ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.webp,.txt,.md,.py,.ts,.tsx,.js,.jsx,.json,.yaml,.yml,.toml,.sql,.csv,.c,.cpp,.h,.hpp,.html,.css';

interface AttachmentBarProps {
  attachments: ContextAttachment[];
  isUploading: boolean;
  disabled?: boolean;
  compact?: boolean;
  onUploadFile: (file: File) => void;
  onDeleteAttachment: (attachmentId: string) => void;
  onValidationError?: (message: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

function AttachmentIcon({ mime }: { mime: string }) {
  if (mime === 'application/pdf') {
    return <FilePdf size={13} weight="duotone" className="text-crimson shrink-0" />;
  }
  if (mime.startsWith('image/')) {
    return <ImageIcon size={13} weight="duotone" className="text-prism-violet shrink-0" />;
  }
  if (mime.includes('python') || mime.includes('json') || mime.includes('javascript')) {
    return <FileCode size={13} weight="duotone" className="text-emerald shrink-0" />;
  }
  return <FileText size={13} weight="duotone" className="text-slate-ink shrink-0" />;
}

export function AttachmentBar({
  attachments,
  isUploading,
  disabled = false,
  compact = false,
  onUploadFile,
  onDeleteAttachment,
  onValidationError,
}: AttachmentBarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || disabled || isUploading) return;
    const file = fileList[0];
    if (!file) return;

    if (attachments.length >= MAX_ATTACHMENTS) {
      onValidationError?.('ניתן לצרף עד 4 קבצי הקשר לסשן.');
      return;
    }
    if (file.size === 0) {
      onValidationError?.('הקובץ שנבחר ריק.');
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      onValidationError?.('גודל הקובץ חורג מהמותר (מקסימום 10 MB).');
      return;
    }
    const ext = getFileExtension(file.name);
    const mime = (file.type || '').toLowerCase();
    if (!ACCEPTED_EXTENSIONS.has(ext) && !ACCEPTED_MIMES.has(mime)) {
      onValidationError?.('סוג קובץ לא נתמך. נתמכים: PDF, PNG/JPG/WebP וקובצי טקסט/קוד.');
      return;
    }

    onUploadFile(file);
  };

  const expandedAttachment = attachments.find((a) => a.id === expandedId) || null;

  return (
    <div
      onDragOver={(e) => {
        if (disabled || isUploading) return;
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`rounded-xl border canon-transition ${
        isDragOver
          ? 'border-obsidian bg-porcelain/90 prism-aura'
          : 'border-hairline/80 bg-white/70 backdrop-blur-md'
      } ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_INPUT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <Tooltip
          content="צרף PDF, תמונה או קובץ קוד/טקסט להקשר (עד 4 קבצים, מקסימום 10 MB)"
          placement="top"
        >
          <button
            type="button"
            disabled={disabled || isUploading || attachments.length >= MAX_ATTACHMENTS}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-hairline bg-surface hover:bg-porcelain disabled:opacity-45 text-[11px] font-medium text-obsidian cursor-pointer canon-transition shrink-0"
          >
            {isUploading ? (
              <CircleNotch size={12} className="animate-spin text-obsidian" />
            ) : (
              <Paperclip size={12} weight="bold" className="text-slate-ink" />
            )}
            <span>
              {isUploading
                ? 'מזקק הקשר...'
                : compact
                ? `קבצים (${attachments.length}/4)`
                : `צרף קובץ הקשר (${attachments.length}/4)`}
            </span>
          </button>
        </Tooltip>

        {attachments.length === 0 && !isUploading && !compact && (
          <span className="text-[11px] text-muted">
            או גרור לכאן PDF, צילום מסך או קוד (עד 10MB)
          </span>
        )}

        {attachments.map((att) => {
          const isExpanded = expandedId === att.id;
          return (
            <div
              key={att.id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2 py-1 text-[11px] text-obsidian max-w-[240px]"
            >
              <AttachmentIcon mime={att.mime_type} />
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : att.id)}
                className="inline-flex items-center gap-1 min-w-0 cursor-pointer hover:underline"
                title="הצג/הסתר תמצית ההקשר"
              >
                <span dir="ltr" className="truncate font-mono text-[10px] font-medium">
                  {att.filename}
                </span>
                <span dir="ltr" className="font-mono text-[9px] text-muted shrink-0">
                  {formatBytes(att.size_bytes)}
                </span>
                <span
                  dir="ltr"
                  className={`font-mono text-[9px] px-1 py-0.2 rounded-sm border shrink-0 ${
                    att.mode === 'distilled'
                      ? 'bg-amber-tint text-amber border-amber/30'
                      : 'bg-emerald-tint text-emerald border-emerald/30'
                  }`}
                >
                  {att.mode === 'distilled' ? 'Distilled' : 'Verbatim'}
                </span>
                {isExpanded ? (
                  <CaretUp size={10} className="text-muted shrink-0" />
                ) : (
                  <CaretDown size={10} className="text-muted shrink-0" />
                )}
              </button>
              <button
                type="button"
                disabled={disabled}
                aria-label={`הסר ${att.filename}`}
                onClick={() => onDeleteAttachment(att.id)}
                className="text-muted hover:text-crimson disabled:opacity-40 cursor-pointer shrink-0"
              >
                <X size={11} weight="bold" />
              </button>
            </div>
          );
        })}
      </div>

      {expandedAttachment && (
        <div className="mt-2 pt-2 border-t border-hairline">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span dir="ltr" className="font-mono text-[10px] text-muted">
              Context Digest · {expandedAttachment.filename} ({expandedAttachment.mode})
            </span>
            <button
              type="button"
              onClick={() => setExpandedId(null)}
              className="text-[10px] text-slate-ink hover:text-obsidian cursor-pointer"
            >
              סגור תצוגה
            </button>
          </div>
          <pre
            dir="auto"
            className="max-h-36 overflow-y-auto rounded-md border border-hairline bg-porcelain p-2 text-[11px] font-mono text-ink whitespace-pre-wrap"
          >
            {expandedAttachment.digest}
          </pre>
        </div>
      )}
    </div>
  );
}
