import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WelcomePanel } from './App';

describe('WelcomePanel', () => {
  it('renders application details received from the desktop bridge', () => {
    render(<WelcomePanel appInfo={{ name: 'TJournal', platform: 'win32', version: '0.1.0' }} />);

    expect(screen.getByRole('heading', { name: 'TJournal' })).toBeInTheDocument();
    expect(screen.getByText('0.1.0')).toBeInTheDocument();
    expect(screen.getByText('win32')).toBeInTheDocument();
  });
});
