import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchableMultiSelect } from '../components/SearchableMultiSelect';
import { type SearchableOption } from '../components/SearchableSelect';

const sampleTenantOptions: SearchableOption[] = [
  { value: 'tenant-1', label: 'Alice Smith', sublabel: 'alice@example.com', badge: 'Available', badgeColor: 'emerald' },
  { value: 'tenant-2', label: 'Bob Jones', sublabel: 'bob@example.com', badge: 'Available', badgeColor: 'emerald' },
  { value: 'tenant-3', label: 'Charlie Brown', sublabel: 'charlie@example.com', badge: 'Unit 102', badgeColor: 'slate' },
];

describe('SearchableMultiSelect Component', () => {
  it('renders placeholder when no options are selected', () => {
    render(
      <SearchableMultiSelect
        options={sampleTenantOptions}
        value={[]}
        onChange={vi.fn()}
        placeholder="Select one or multiple tenants..."
      />
    );

    expect(screen.getByText('Select one or multiple tenants...')).toBeInTheDocument();
  });

  it('renders selected option chips', () => {
    render(
      <SearchableMultiSelect
        options={sampleTenantOptions}
        value={['tenant-1', 'tenant-2']}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('allows removing an option via chip remove button', () => {
    const handleChange = vi.fn();
    render(
      <SearchableMultiSelect
        options={sampleTenantOptions}
        value={['tenant-1', 'tenant-2']}
        onChange={handleChange}
      />
    );

    const removeAliceBtn = screen.getByRole('button', { name: /remove alice smith/i });
    fireEvent.click(removeAliceBtn);

    expect(handleChange).toHaveBeenCalledWith(['tenant-2']);
  });

  it('opens dropdown and toggles an unselected option to selected', () => {
    const handleChange = vi.fn();
    render(
      <SearchableMultiSelect
        options={sampleTenantOptions}
        value={['tenant-1']}
        onChange={handleChange}
        placeholder="Select tenants..."
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByTestId('multi-select-trigger'));

    // Click Bob Jones to select
    const bobOption = screen.getByText('Bob Jones');
    fireEvent.click(bobOption);

    expect(handleChange).toHaveBeenCalledWith(['tenant-1', 'tenant-2']);
  });

  it('filters options by search input', () => {
    render(
      <SearchableMultiSelect
        options={sampleTenantOptions}
        value={[]}
        onChange={vi.fn()}
        searchPlaceholder="Filter tenants..."
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByRole('button', { name: /select tenants\.\.\./i }));

    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Filter tenants...');
    fireEvent.change(searchInput, { target: { value: 'Charlie' } });

    expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
    expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
  });

  it('clears all selected options with clear all button', () => {
    const handleChange = vi.fn();
    render(
      <SearchableMultiSelect
        options={sampleTenantOptions}
        value={['tenant-1', 'tenant-2']}
        onChange={handleChange}
      />
    );

    const clearBtn = screen.getByRole('button', { name: /clear all selected/i });
    fireEvent.click(clearBtn);

    expect(handleChange).toHaveBeenCalledWith([]);
  });
});
