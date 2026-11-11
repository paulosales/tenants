export const BADGE_COLOR_CLASSES: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const DEFAULT_BADGE_CLASS = 'bg-slate-100 text-slate-700 border-slate-200';

export function getBadgeColorClass(color?: string): string {
  return (color && BADGE_COLOR_CLASSES[color]) || DEFAULT_BADGE_CLASS;
}

