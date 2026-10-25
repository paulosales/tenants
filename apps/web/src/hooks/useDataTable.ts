import { useState, useMemo, useEffect } from 'react';
import { type SortDirection } from '../components/DataTableHeader';

export interface UseDataTableOptions<T> {
  data: T[];
  initialPageSize?: number;
  initialSortKey?: string | null;
  initialSortDirection?: SortDirection;
  filterPredicate?: (item: T, filters: Record<string, string>) => boolean;
  sortComparator?: (a: T, b: T, sortKey: string, direction: 'asc' | 'desc') => number;
}

export function useDataTable<T>({
  data,
  initialPageSize = 25,
  initialSortKey = null,
  initialSortDirection = null,
  filterPredicate,
  sortComparator,
}: UseDataTableOptions<T>) {
  const [pageSize, setPageSize] = useState<number>(initialPageSize);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey);
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortDirection);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showFilterRow, setShowFilterRow] = useState<boolean>(true);

  // Reset to page 1 whenever filters change
  const setColumnFilter = (key: string, val: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      if (!val || val === 'all') {
        delete next[key];
      } else {
        next[key] = val;
      }
      return next;
    });
    setCurrentPage(1);
  };

  const clearAllFilters = () => {
    setColumnFilters({});
    setCurrentPage(1);
  };

  const hasActiveFilters = Object.keys(columnFilters).length > 0;

  // Toggle sort key: null -> asc -> desc -> null
  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection('asc');
    } else if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else {
      setSortKey(null);
      setSortDirection(null);
    }
  };

  // 1. Filter data
  const filteredData = useMemo(() => {
    if (!hasActiveFilters || !filterPredicate) {
      return data;
    }
    return data.filter((item) => filterPredicate(item, columnFilters));
  }, [data, columnFilters, hasActiveFilters, filterPredicate]);

  // 2. Sort data
  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) {
      return filteredData;
    }

    const items = [...filteredData];
    if (sortComparator) {
      items.sort((a, b) => sortComparator(a, b, sortKey, sortDirection));
    } else {
      items.sort((a: any, b: any) => {
        const valA = a[sortKey];
        const valB = b[sortKey];

        if (valA === valB) return 0;
        if (valA == null) return 1;
        if (valB == null) return -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        const cmp = strA.localeCompare(strB, undefined, { numeric: true });
        return sortDirection === 'asc' ? cmp : -cmp;
      });
    }
    return items;
  }, [filteredData, sortKey, sortDirection, sortComparator]);

  // Total pages
  const totalRecords = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  // Auto-clamp page if data shrinks
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  // 3. Paginate
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  return {
    pageSize,
    setPageSize,
    currentPage,
    setCurrentPage,
    sortKey,
    sortDirection,
    handleSort,
    columnFilters,
    setColumnFilter,
    clearAllFilters,
    hasActiveFilters,
    showFilterRow,
    setShowFilterRow,
    totalRecords,
    totalPages,
    paginatedData,
    filteredData: sortedData,
  };
}
