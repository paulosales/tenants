import React from 'react';
import { ArrowUp, ArrowDown, ChevronsUpDown, Search, X } from 'lucide-react';

export type SortDirection = 'asc' | 'desc' | null;

export interface SortableColumnHeaderProps {
  columnKey: string;
  currentSortKey: string | null;
  currentSortDirection: SortDirection;
  onSort: (columnKey: string) => void;
  label: string;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export const SortableColumnHeader: React.FC<SortableColumnHeaderProps> = ({
  columnKey,
  currentSortKey,
  currentSortDirection,
  onSort,
  label,
  className = '',
  align = 'left',
}) => {
  const isSorted = currentSortKey === columnKey;

  return (
    <button
      type="button"
      onClick={() => onSort(columnKey)}
      className={`group inline-flex items-center space-x-1.5 font-semibold uppercase tracking-wider text-xs transition-colors hover:text-slate-900 cursor-pointer ${
        align === 'right' ? 'justify-end w-full' : align === 'center' ? 'justify-center w-full' : ''
      } ${isSorted ? 'text-indigo-600' : 'text-slate-500'} ${className}`}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      <span className="shrink-0 p-0.5 rounded transition-colors group-hover:bg-slate-200/60">
        {isSorted && currentSortDirection === 'asc' ? (
          <ArrowUp className="w-3.5 h-3.5 text-indigo-600 stroke-[2.5]" />
        ) : isSorted && currentSortDirection === 'desc' ? (
          <ArrowDown className="w-3.5 h-3.5 text-indigo-600 stroke-[2.5]" />
        ) : (
          <ChevronsUpDown className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />
        )}
      </span>
    </button>
  );
};

export interface TableColumnFilterInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export const TableColumnFilterInput: React.FC<TableColumnFilterInputProps> = ({
  value,
  onChange,
  placeholder = 'Filter...',
  className = '',
}) => {
  return (
    <div className={`relative flex items-center min-w-[90px] ${className}`}>
      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-7 pr-6 py-1 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1.5 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
          aria-label="Clear filter"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export interface TableColumnFilterSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

export const TableColumnFilterSelect: React.FC<TableColumnFilterSelectProps> = ({
  value,
  onChange,
  options,
  className = '',
}) => {
  return (
    <div className={`relative flex items-center min-w-[90px] ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-2 pr-7 py-1 bg-white border border-slate-200 rounded-lg text-xs font-normal text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 shadow-2xs cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};
