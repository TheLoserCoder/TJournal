import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DirectionToggle } from './direction-toggle';

describe('DirectionToggle', () => {
  afterEach(() => {
    cleanup();
  });

  it('exposes two keyboard-accessible direction choices', () => {
    const onChange = vi.fn();
    render(
      <DirectionToggle
        ariaLabel="Direction"
        longLabel="Long"
        onChange={onChange}
        shortLabel="Short"
        value="long"
      />,
    );

    expect(screen.getByRole('button', { name: 'Long' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Short' }));
    expect(onChange).toHaveBeenCalledWith('short');
  });

  it('marks the active option with the shared entry type palette', () => {
    cleanup();
    render(
      <DirectionToggle
        ariaLabel="Direction"
        longLabel="Long"
        onChange={() => {}}
        shortLabel="Short"
        value="short"
      />,
    );

    const long = screen.getByRole('button', { name: 'Long' });
    const short = screen.getByRole('button', { name: 'Short' });

    expect(long).toHaveClass('entry-type-entry', 'entry-type-long');
    expect(short).toHaveClass('entry-type-entry', 'entry-type-short');
    expect(long).toHaveAttribute('data-active', 'false');
    expect(short).toHaveAttribute('data-active', 'true');
  });
});
