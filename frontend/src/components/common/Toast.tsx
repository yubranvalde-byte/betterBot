import {
  CheckCircle,
  DownloadSimple,
  PencilSimple,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import { motion } from 'motion/react';
import type { ToastState } from '../../types/api';

interface ToastProps {
  toast: ToastState | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDismiss: () => void;
}

export function Toast({ toast, onMouseEnter, onMouseLeave, onDismiss }: ToastProps) {
  if (!toast) return null;

  const isError = toast.tone === 'alert';

  const renderIcon = () => {
    switch (toast.tone) {
      case 'alert':
        return <WarningCircle size={16} weight="bold" className="text-crimson shrink-0" />;
      case 'download':
        return <DownloadSimple size={16} weight="bold" className="text-obsidian shrink-0" />;
      case 'trash':
        return <Trash size={16} weight="bold" className="text-slate-ink shrink-0" />;
      case 'edit':
        return <PencilSimple size={16} weight="bold" className="text-obsidian shrink-0" />;
      default:
        return <CheckCircle size={16} weight="bold" className="text-emerald shrink-0" />;
    }
  };

  return (
    <motion.div
      key={toast.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onDismiss}
      className={`fixed bottom-5 inset-x-4 sm:inset-x-auto sm:left-5 z-50 sm:max-w-md cursor-pointer rounded-md border px-4 py-2.5 text-sm shadow-xl shadow-obsidian/8 flex items-center gap-2.5 canon-transition ${
        isError
          ? 'bg-crimson-tint border-crimson/40 text-ink'
          : 'bg-surface border-hairline-strong text-ink'
      }`}
    >
      {renderIcon()}
      <span>{toast.message}</span>
    </motion.div>
  );
}
