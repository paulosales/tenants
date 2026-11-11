import React from 'react';
import { X } from 'lucide-react';

interface ModalDialogProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  titleId?: string;
  maxWidthClass?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Shared accessible modal container preventing duplicate overlay/header markup across feature views.
 */
export const ModalDialog: React.FC<ModalDialogProps> = ({
  isOpen,
  title,
  subtitle,
  titleId,
  maxWidthClass = 'max-w-md',
  onClose,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className={`bg-white rounded-3xl ${maxWidthClass} w-full shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto`}
      >
        <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h3 id={titleId} className="text-lg font-bold text-slate-900">
              {title}
            </h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

