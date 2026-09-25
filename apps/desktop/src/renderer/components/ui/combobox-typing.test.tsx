import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Combobox } from './combobox';
import { Dialog } from './dialog';

/** Mirrors the trade forms: the parent only commits a known symbol. */
const RejectingCombobox = (): ReactElement => {
  const [value, setValue] = useState('EURUSD');
  return (
    <Combobox
      ariaLabel="Asset"
      onChange={(nextValue) => {
        if (['EURUSD', 'GBPUSD', 'XAUUSD'].includes(nextValue)) setValue(nextValue);
      }}
      options={['EURUSD', 'GBPUSD', 'XAUUSD']}
      value={value}
    />
  );
};

describe('Combobox typing', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps a partial query in the input even when the parent rejects it', () => {
    render(<RejectingCombobox />);

    const input = screen.getByRole('combobox', { name: 'Asset' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'GB' } });

    expect(input.value).toBe('GB');
  });

  it('keeps typed characters in a dialog context', () => {
    render(
      <Dialog closeLabel="Close" onOpenChange={vi.fn()} open title="Trade details">
        <RejectingCombobox />
      </Dialog>,
    );

    const input = screen.getByRole('combobox', { name: 'Asset' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'XAU' } });

    expect(input.value).toBe('XAU');
  });

  it('offers inline creation for a value without an exact match', async () => {
    const onCreateOption = vi.fn();
    render(
      <Combobox
        ariaLabel="Asset"
        createLabel={(value) => `New ${value}`}
        onChange={vi.fn()}
        onCreateOption={onCreateOption}
        options={['EURUSD', 'GBPUSD']}
        value=""
      />,
    );

    const input = screen.getByRole('combobox', { name: 'Asset' }) as HTMLInputElement;
    fireEvent.click(screen.getByRole('button', { name: 'Asset' }));
    fireEvent.change(input, { target: { value: 'SOL' } });

    fireEvent.click(await screen.findByRole('button', { name: 'New SOL' }));
    expect(onCreateOption).toHaveBeenCalledWith('SOL');
    expect(input.value).toBe('SOL');
  });

  it('hides the creation row when the value already exists', async () => {
    render(
      <Combobox
        ariaLabel="Asset"
        createLabel={(value) => `New ${value}`}
        onChange={vi.fn()}
        onCreateOption={vi.fn()}
        options={['EURUSD', 'GBPUSD']}
        value=""
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Asset' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Asset' }), {
      target: { value: 'eurusd' },
    });

    expect(await screen.findByRole('option', { name: 'EURUSD' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /New / })).toBeNull();
  });

  it('shows the committed selection after choosing an option', async () => {
    render(<RejectingCombobox />);

    const input = screen.getByRole('combobox', { name: 'Asset' }) as HTMLInputElement;
    fireEvent.click(screen.getByRole('button', { name: 'Asset' }));
    fireEvent.change(input, { target: { value: 'GB' } });
    fireEvent.click(await screen.findByRole('option', { name: 'GBPUSD' }));

    expect(input.value).toBe('GBPUSD');
  });
});
