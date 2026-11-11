import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TablePagination } from '../components/TablePagination';

describe('TablePagination Component', () => {
  it('renders records per page selector with 25, 50, and 100 options', () => {
    const handlePageChange = vi.fn();
    const handlePageSizeChange = vi.fn();

    render(
      <TablePagination
        currentPage={1}
        pageSize={25}
        totalRecords={120}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    expect(select.value).toBe('25');

    const options = screen.getAllByRole('option') as HTMLOptionElement[];
    const optionValues = options.map((opt) => opt.value);
    expect(optionValues).toEqual(['25', '50', '100']);
  });

  it('calls onPageSizeChange when user changes the page size', () => {
    const handlePageChange = vi.fn();
    const handlePageSizeChange = vi.fn();

    render(
      <TablePagination
        currentPage={1}
        pageSize={25}
        totalRecords={120}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    );

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '50' } });
    expect(handlePageSizeChange).toHaveBeenCalledWith(50);

    fireEvent.change(select, { target: { value: '100' } });
    expect(handlePageSizeChange).toHaveBeenCalledWith(100);
  });

  it('displays accurate record range and total count', () => {
    render(
      <TablePagination
        currentPage={2}
        pageSize={25}
        totalRecords={85}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByText('26')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('disables previous button on first page and navigates on page click', () => {
    const handlePageChange = vi.fn();

    render(
      <TablePagination
        currentPage={1}
        pageSize={25}
        totalRecords={75}
        onPageChange={handlePageChange}
        onPageSizeChange={vi.fn()}
      />
    );

    const prevButton = screen.getByTitle('Previous page');
    expect(prevButton).toBeDisabled();

    const nextButton = screen.getByTitle('Next page');
    expect(nextButton).not.toBeDisabled();
    fireEvent.click(nextButton);
    expect(handlePageChange).toHaveBeenCalledWith(2);

    const page2Button = screen.getByRole('button', { name: 'Page 2' });
    fireEvent.click(page2Button);
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it('renders 0 of 0 records when totalRecords is 0', () => {
    render(
      <TablePagination
        currentPage={1}
        pageSize={25}
        totalRecords={0}
        onPageChange={vi.fn()}
        onPageSizeChange={vi.fn()}
      />
    );

    expect(screen.getByText(/showing/i)).toBeInTheDocument();
  });
});
