import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { getBadgeColorClass } from '../utils/badgeStyles';

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  badgeColor?: 'emerald' | 'amber' | 'rose' | 'indigo' | 'slate';
  disabled?: boolean;
}

export interface SearchableSelectProps {
  id?: string;
  options: SearchableOption[];
  value: string | null | undefined;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md';
  allowClear?: boolean;
  clearLabel?: string;
  clearValue?: string;
  placement?: 'bottom' | 'top' | 'auto';
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No matching items found',
  disabled = false,
  className = '',
  variant = 'light',
  size = 'md',
  allowClear = false,
  clearLabel = '-- None --',
  clearValue = '',
  placement = 'auto',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [actualPlacement, setActualPlacement] = useState<'bottom' | 'top'>(
    placement === 'top' ? 'top' : 'bottom'
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(q);
      const matchSub = opt.sublabel?.toLowerCase().includes(q);
      const matchBadge = opt.badge?.toLowerCase().includes(q);
      return matchLabel || matchSub || matchBadge;
    });
  }, [options, searchQuery]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens and adjust placement if needed
  useEffect(() => {
    if (isOpen) {
      if (placement === 'top') {
        setActualPlacement('top');
      } else if (placement === 'bottom') {
        setActualPlacement('bottom');
      } else if (containerRef.current && typeof window !== 'undefined') {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        if (spaceBelow < 220 && spaceAbove > spaceBelow) {
          setActualPlacement('top');
        } else {
          setActualPlacement('bottom');
        }
      }

      setSearchQuery('');
      setHighlightedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, placement]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
        handleSelect(filteredOptions[highlightedIndex].value);
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeEl && typeof activeEl.scrollIntoView === 'function') {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(clearValue);
    setIsOpen(false);
  };

  const isDark = variant === 'dark';
  const isSm = size === 'sm';

  return (
    <div
      ref={containerRef}
      className={`relative inline-block w-full text-left ${isOpen ? 'z-30' : ''} ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between text-left transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-xl ${
          isSm ? 'px-3 py-1.5 text-xs' : 'px-3 py-2 text-sm'
        } ${
          isDark
            ? 'bg-slate-800 border border-slate-700 text-white hover:bg-slate-750'
            : 'bg-white border border-slate-300 text-slate-900 hover:border-slate-400'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${
          isOpen ? 'ring-2 ring-indigo-500 border-transparent' : ''
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center min-w-0 flex-1 mr-2">
          {selectedOption ? (
            <div className="flex items-center space-x-2 truncate">
              <span className="font-medium truncate">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 ${getBadgeColorClass(
                    selectedOption.badgeColor
                  )}`}
                >
                  {selectedOption.badge}
                </span>
              )}
              {selectedOption.sublabel && (
                <span
                  className={`text-xs truncate ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  {selectedOption.sublabel}
                </span>
              )}
            </div>
          ) : (
            <span
              className={`truncate ${
                isDark ? 'text-slate-400' : 'text-slate-400'
              }`}
            >
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1 shrink-0">
          {allowClear && selectedOption && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className={`p-0.5 rounded-md hover:bg-slate-200 transition-colors ${
                isDark ? 'hover:bg-slate-700 text-slate-400' : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            } ${isDark ? 'text-slate-400' : 'text-slate-400'}`}
          />
        </div>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          data-placement={actualPlacement}
          className={`absolute left-0 right-0 z-50 ${
            actualPlacement === 'top'
              ? 'bottom-full mb-1.5 origin-bottom'
              : 'top-full mt-1.5 origin-top'
          } rounded-xl border shadow-xl backdrop-blur-md overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 ${
            isDark
              ? 'bg-slate-900 border-slate-700 text-slate-100'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          {/* Integrated Search Box */}
          <div
            className={`p-2 border-b flex items-center space-x-2 ${
              isDark ? 'border-slate-800 bg-slate-950/50' : 'border-slate-100 bg-slate-50/70'
            }`}
          >
            <Search
              className={`w-4 h-4 shrink-0 ${
                isDark ? 'text-slate-400' : 'text-slate-400'
              }`}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              placeholder={searchPlaceholder}
              className={`w-full bg-transparent text-xs sm:text-sm focus:outline-none placeholder:text-slate-400 ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
              onClick={(e) => e.stopPropagation()}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className={`p-1 rounded-md text-xs hover:bg-slate-200 transition-colors ${
                  isDark ? 'hover:bg-slate-800 text-slate-400' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div
            ref={listRef}
            role="listbox"
            className="max-h-60 overflow-y-auto p-1.5 space-y-0.5 focus:outline-none select-none text-xs sm:text-sm"
          >
            {/* Clear option if allowed */}
            {allowClear && (
              <div
                role="option"
                aria-selected={value === clearValue}
                onClick={() => handleSelect(clearValue)}
                className={`px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors italic ${
                  isDark
                    ? 'hover:bg-slate-800/80 text-slate-400'
                    : 'hover:bg-slate-100 text-slate-500'
                }`}
              >
                <span>{clearLabel}</span>
                {value === clearValue && <Check className="w-4 h-4 text-indigo-500" />}
              </div>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-6 px-4 text-center">
                <Search
                  className={`w-5 h-5 mx-auto mb-2 opacity-40 ${
                    isDark ? 'text-slate-400' : 'text-slate-400'
                  }`}
                />
                <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {emptyMessage}
                </p>
                {searchQuery && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    No results for &ldquo;{searchQuery}&rdquo;
                  </p>
                )}
              </div>
            ) : (
              filteredOptions.map((option, idx) => {
                const isSelected = option.value === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled}
                    onClick={() => {
                      if (!option.disabled) {
                        handleSelect(option.value);
                      }
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-3 py-2 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                      option.disabled ? 'opacity-40 cursor-not-allowed' : ''
                    } ${
                      isSelected
                        ? isDark
                          ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                          : 'bg-indigo-50 text-indigo-900 font-semibold'
                        : isHighlighted
                        ? isDark
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-100 text-slate-900'
                        : isDark
                        ? 'text-slate-200'
                        : 'text-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1 mr-2">
                      <div className="flex items-center space-x-2">
                        <span className="truncate">{option.label}</span>
                        {option.badge && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md border shrink-0 ${getBadgeColorClass(
                              option.badgeColor
                            )}`}
                          >
                            {option.badge}
                          </span>
                        )}
                      </div>
                      {option.sublabel && (
                        <p
                          className={`text-xs truncate mt-0.5 ${
                            isSelected
                              ? isDark
                                ? 'text-indigo-300/80'
                                : 'text-indigo-700/80'
                              : isDark
                              ? 'text-slate-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {option.sublabel}
                        </p>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-600 shrink-0 ml-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
