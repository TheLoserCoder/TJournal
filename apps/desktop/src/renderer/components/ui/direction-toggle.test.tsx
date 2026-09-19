import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DirectionToggle } from './direction-toggle';

describe('DirectionToggle', () => {
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
});
