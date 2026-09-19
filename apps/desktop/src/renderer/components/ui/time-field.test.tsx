import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TimeField } from './time-field';

describe('TimeField', () => {
  afterEach(() => cleanup());

  it('renders one direct editable control instead of a dropdown', () => {
    render(<TimeField ariaLabel="Close time" value="12:30" onChange={() => undefined} />);

    const input = screen.getByRole('textbox', { name: 'Close time' });
    expect(input).toHaveValue('12:30');
    expect(input).toHaveClass('ui-time-field-input');
    expect(input.parentElement).toHaveClass('ui-time-field');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('commits a valid edit once when focus leaves the field', () => {
    const onChange = vi.fn();
    render(<TimeField ariaLabel="Close time" value="12:30" onChange={onChange} />);

    const input = screen.getByRole('textbox', { name: 'Close time' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '13:45' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('13:45');
  });
});
