import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { TagChip } from './tag-chip';

describe('TagChip', () => {
  afterEach(() => {
    cleanup();
  });

  it('forwards the trigger props Radix injects and the comment title', () => {
    render(<TagChip color="blue" id="chip-1" label="Breakout" title="Trend continuation" />);

    const chip = screen.getByText('Breakout');
    // Without the forwarded props a Radix tooltip trigger never opens.
    expect(chip).toHaveAttribute('id', 'chip-1');
    expect(chip).toHaveAttribute('title', 'Trend continuation');
  });

  it('leaves the title absent when there is no comment', () => {
    render(<TagChip color="rose" label="Scalp" />);

    expect(screen.getByText('Scalp')).not.toHaveAttribute('title');
  });
});
