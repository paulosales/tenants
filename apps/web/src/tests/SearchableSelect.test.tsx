import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchableSelect, type SearchableOption } from '../components/SearchableSelect';

const sampleOptions: SearchableOption[] = [
  { value: 'unit-101', label: 'Unit 101', sublabel: '1 Bed, 1 Bath', badge: 'Vacant', badgeColor: 'emerald' },
  { value: 'unit-102', label: 'Unit 102', sublabel: '2 Bed, 1.5 Bath', badge: 'Occupied', badgeColor: 'amber' },
  { value: 'unit-201', label: 'Unit 201', sublabel: '3 Bed, 2 Bath', badge: 'Vacant', badgeColor: 'emerald' },
  { value: 'penthouse-1', label: 'Penthouse 1', sublabel: '4 Bed, 3 Bath', badge: 'Maintenance', badgeColor: 'rose' },
];

describe('SearchableSelect Component', () => {
  it('renders placeholder when no value is selected', () => {
    render(
      <SearchableSelect
        options={sampleOptions}
        value=""
        onChange={vi.fn()}
        placeholder="Select a unit..."
      />
    );

    expect(screen.getByText('Select a unit...')).toBeInTheDocument();
  });

  it('renders selected option label and badge', () => {
    render(
      <SearchableSelect
        options={sampleOptions}
        value="unit-101"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Unit 101')).toBeInTheDocument();
    expect(screen.getByText('Vacant')).toBeInTheDocument();
  });

  it('opens dropdown and filters options in real-time by search query', () => {
    render(
      <SearchableSelect
        options={sampleOptions}
        value=""
        onChange={vi.fn()}
        placeholder="Select a unit..."
        searchPlaceholder="Type to filter units..."
      />
    );

    // Click trigger to open dropdown
    fireEvent.click(screen.getByRole('button', { name: /select a unit/i }));

    // All options visible
    expect(screen.getByText('Unit 101')).toBeInTheDocument();
    expect(screen.getByText('Penthouse 1')).toBeInTheDocument();

    // Type "Penthouse" in search input
    const searchInput = screen.getByPlaceholderText('Type to filter units...');
    fireEvent.change(searchInput, { target: { value: 'Penthouse' } });

    // Unit 101 should not be in the list anymore
    expect(screen.queryByText('Unit 101')).not.toBeInTheDocument();
    expect(screen.getByText('Penthouse 1')).toBeInTheDocument();
  });

  it('filters options by sublabel', () => {
    render(
      <SearchableSelect
        options={sampleOptions}
        value=""
        onChange={vi.fn()}
        placeholder="Select a unit..."
        searchPlaceholder="Type to filter..."
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /select a unit/i }));

    const searchInput = screen.getByPlaceholderText('Type to filter...');
    fireEvent.change(searchInput, { target: { value: '3 Bath' } });

    expect(screen.getByText('Penthouse 1')).toBeInTheDocument();
    expect(screen.queryByText('Unit 101')).not.toBeInTheDocument();
  });

  it('calls onChange when an option is clicked', () => {
    const handleChange = vi.fn();
    render(
      <SearchableSelect
        options={sampleOptions}
        value=""
        onChange={handleChange}
        placeholder="Select a unit..."
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /select a unit/i }));
    fireEvent.click(screen.getByText('Unit 201'));

    expect(handleChange).toHaveBeenCalledWith('unit-201');
  });

  it('clears selection when clear button is clicked', () => {
    const handleChange = vi.fn();
    render(
      <SearchableSelect
        options={sampleOptions}
        value="unit-101"
        onChange={handleChange}
        allowClear={true}
        clearValue=""
      />
    );

    const clearBtn = screen.getByTitle('Clear selection');
    fireEvent.click(clearBtn);

    expect(handleChange).toHaveBeenCalledWith('');
  });

  it('handles Escape key to close the dropdown', () => {
    render(
      <SearchableSelect
        options={sampleOptions}
        value=""
        onChange={vi.fn()}
        placeholder="Select a unit..."
      />
    );

    const trigger = screen.getByRole('button', { name: /select a unit/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('supports top placement when placement="top" is passed', () => {
    const { container } = render(
      <SearchableSelect
        options={sampleOptions}
        value=""
        onChange={vi.fn()}
        placeholder="Select a unit..."
        placement="top"
      />
    );

    const trigger = screen.getByRole('button', { name: /select a unit/i });
    fireEvent.click(trigger);

    const popover = container.querySelector('[data-placement="top"]');
    expect(popover).toBeInTheDocument();
    expect(popover).toHaveClass('bottom-full');
  });

  it('supports bottom placement when placement="bottom" is passed', () => {
    const { container } = render(
      <SearchableSelect
        options={sampleOptions}
        value=""
        onChange={vi.fn()}
        placeholder="Select a unit..."
        placement="bottom"
      />
    );

    const trigger = screen.getByRole('button', { name: /select a unit/i });
    fireEvent.click(trigger);

    const popover = container.querySelector('[data-placement="bottom"]');
    expect(popover).toBeInTheDocument();
    expect(popover).toHaveClass('top-full');
  });
});
