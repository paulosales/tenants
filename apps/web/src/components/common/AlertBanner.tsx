import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface AlertBannerProps {
  variant: 'success' | 'error';
  message: string;
  onDismiss?: () => void;
}

const VARIANT_STYLES: Record<
  AlertBannerProps['variant'],
  { container: string; iconColor: string; dismissColor: string; Icon: typeof CheckCircle2 }
> = {
  success: {
    container: 'bg-emerald-50 border border-emerald-200 text-emerald-800',
    iconColor: 'text-emerald-600',
    dismissColor: 'text-emerald-500 hover:text-emerald-700',
    Icon: CheckCircle2,
  },
  error: {
    container: 'bg-rose-50 border border-rose-200 text-rose-800',
    iconColor: 'text-rose-600',
    dismissColor: 'text-rose-500 hover:text-rose-700',
    Icon: AlertCircle,
  },
};

export const AlertBanner: React.FC<AlertBannerProps> = ({ variant, message, onDismiss }) => {
  const style = VARIANT_STYLES[variant];
  const Icon = style.Icon;

  return (
    <div className={`${style.container} rounded-2xl p-4 flex items-center justify-between animate-in fade-in`}>
      <div className="flex items-center space-x-3">
        <Icon className={`w-5 h-5 ${style.iconColor} shrink-0`} />
        <p className="text-sm font-medium">{message}</p>
      </div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className={style.dismissColor} aria-label="Dismiss alert">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

