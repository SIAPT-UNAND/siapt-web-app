import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.jsx';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('renders the application name', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    render(<App />);

    expect(screen.getByText('SIAPT UNAND')).toBeInTheDocument();
  });
});
