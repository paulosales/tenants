import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDataTable } from '../hooks/useDataTable';

interface TestItem {
  id: string;
  name: string;
  count: number;
  category: string;
}

const mockData: TestItem[] = Array.from({ length: 65 }, (_, i) => ({
  id: `item-${i + 1}`,
  name: `Item ${String(i + 1).padStart(3, '0')}`,
  count: i + 1,
  category: i % 2 === 0 ? 'category-a' : 'category-b',
}));

describe('useDataTable Hook', () => {
  it('initializes with default page size 25 and clamps pagination', () => {
    const { result } = renderHook(() =>
      useDataTable<TestItem>({
        data: mockData,
        initialPageSize: 25,
      })
    );

    expect(result.current.pageSize).toBe(25);
    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalRecords).toBe(65);
    expect(result.current.paginatedData.length).toBe(25);
    expect(result.current.paginatedData[0].name).toBe('Item 001');
    expect(result.current.paginatedData[24].name).toBe('Item 025');
  });

  it('supports selecting 50 and 100 page sizes', () => {
    const { result } = renderHook(() =>
      useDataTable<TestItem>({
        data: mockData,
        initialPageSize: 25,
      })
    );

    act(() => {
      result.current.setPageSize(50);
    });

    expect(result.current.pageSize).toBe(50);
    expect(result.current.paginatedData.length).toBe(50);

    act(() => {
      result.current.setPageSize(100);
    });

    expect(result.current.pageSize).toBe(100);
    expect(result.current.paginatedData.length).toBe(65);
  });

  it('navigates across pages', () => {
    const { result } = renderHook(() =>
      useDataTable<TestItem>({
        data: mockData,
        initialPageSize: 25,
      })
    );

    act(() => {
      result.current.setCurrentPage(2);
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.paginatedData.length).toBe(25);
    expect(result.current.paginatedData[0].name).toBe('Item 026');

    act(() => {
      result.current.setCurrentPage(3);
    });

    expect(result.current.currentPage).toBe(3);
    expect(result.current.paginatedData.length).toBe(15);
  });

  it('filters data by column and resets to page 1', () => {
    const { result } = renderHook(() =>
      useDataTable<TestItem>({
        data: mockData,
        initialPageSize: 25,
        filterPredicate: (item, filters) => {
          if (filters.category && item.category !== filters.category) return false;
          if (filters.name && !item.name.toLowerCase().includes(filters.name.toLowerCase())) return false;
          return true;
        },
      })
    );

    act(() => {
      result.current.setCurrentPage(2);
    });
    expect(result.current.currentPage).toBe(2);

    act(() => {
      result.current.setColumnFilter('category', 'category-a');
    });

    // Should reset to page 1 upon filter change
    expect(result.current.currentPage).toBe(1);
    expect(result.current.hasActiveFilters).toBe(true);
    expect(result.current.columnFilters.category).toBe('category-a');
    // Even items: 0, 2, 4, ... 64 -> 33 items total
    expect(result.current.totalRecords).toBe(33);
    expect(result.current.paginatedData.every((x) => x.category === 'category-a')).toBe(true);

    act(() => {
      result.current.clearAllFilters();
    });

    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.totalRecords).toBe(65);
  });

  it('cycles sort states: null -> asc -> desc -> null', () => {
    const { result } = renderHook(() =>
      useDataTable<TestItem>({
        data: mockData,
        initialPageSize: 25,
        sortComparator: (a, b, key, dir) => {
          let cmp = 0;
          if (key === 'count') {
            cmp = a.count - b.count;
          }
          return dir === 'desc' ? -cmp : cmp;
        },
      })
    );

    // Initial state
    expect(result.current.sortKey).toBeNull();
    expect(result.current.sortDirection).toBeNull();

    // 1st click: Asc
    act(() => {
      result.current.handleSort('count');
    });
    expect(result.current.sortKey).toBe('count');
    expect(result.current.sortDirection).toBe('asc');
    expect(result.current.paginatedData[0].count).toBe(1);

    // 2nd click: Desc
    act(() => {
      result.current.handleSort('count');
    });
    expect(result.current.sortKey).toBe('count');
    expect(result.current.sortDirection).toBe('desc');
    expect(result.current.paginatedData[0].count).toBe(65);

    // 3rd click: Reset to null
    act(() => {
      result.current.handleSort('count');
    });
    expect(result.current.sortKey).toBeNull();
    expect(result.current.sortDirection).toBeNull();
  });
});
