import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.jsx';

// Simulasi: sesi sudah dicek, dan belum ada pengguna yang login
vi.mock('./hooks/useSession.js', () => ({
  default: () => ({
    user: null,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('renders the application name', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    render(<App />);

    expect(await screen.findByText('SIAPT UNAND')).toBeInTheDocument();
  });
});