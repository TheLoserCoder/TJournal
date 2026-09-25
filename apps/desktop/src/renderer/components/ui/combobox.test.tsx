import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Combobox } from './combobox';
import { Dialog } from './dialog';

describe('Combobox', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps a dialog combobox popup inside the dialog interaction layer', async () => {
    render(
      <Dialog closeLabel="Close" onOpenChange={vi.fn()} open title="Trade details">
        <Combobox
          ariaLabel="Asset"
          layer="dialog"
          onChange={vi.fn()}
          options={['EURUSD', 'GBPUSD']}
          value=""
        />
      </Dialog>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Asset' }));

    const option = await screen.findByRole('option', { name: 'EURUSD' });
    await waitFor(() => {
      expect(option.closest('.ui-dialog-content')).not.toBeNull();
    });
  });

  it('forwards a selected dialog option to the view callback', async () => {
    const onChange = vi.fn();
    render(
      <Dialog closeLabel="Close" onOpenChange={vi.fn()} open title="Trade details">
        <Combobox
          ariaLabel="Asset"
          layer="dialog"
          onChange={onChange}
          options={['EURUSD', 'GBPUSD']}
          value=""
        />
      </Dialog>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Asset' }));
    fireEvent.click(await screen.findByRole('option', { name: 'EURUSD' }));

    expect(onChange).toHaveBeenCalledWith('EURUSD');
  });

  it('shows every option in the caller order when opened with a committed value', async () => {
    render(
      <Combobox
        ariaLabel="Asset"
        onChange={vi.fn()}
        options={['MSFT', 'AAPL', 'TSLA']}
        value="AAPL"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Asset' }));

    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['MSFT', 'AAPL', 'TSLA']);
  });

  it('filters options only after typing in the input', async () => {
    render(
      <Combobox
        ariaLabel="Asset"
        onChange={vi.fn()}
        options={['MSFT', 'AAPL', 'TSLA']}
        value="AAPL"
      />,
    );

    const input = screen.getByRole('combobox', { name: 'Asset' }) as HTMLInputElement;
    fireEvent.mouseDown(input);
    fireEvent.change(input, { target: { value: 'TS' } });

    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual(['TSLA']);
  });
});
