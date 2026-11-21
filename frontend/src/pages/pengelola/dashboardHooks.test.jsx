import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useDashboard } from './dashboardHooks.js';

afterEach(() => {
  cleanup();
});

function tertunda() {
  let selesai;
  let gagal;
  const janji = new Promise((res, rej) => {
    selesai = res;
    gagal = rej;
  });
  return { janji, selesai, gagal };
}

describe('useDashboard', () => {
  it('memuat, lalu data tersedia; muatUlang mempertahankan data lama selama memuat', async () => {
    const ambil = vi.fn().mockResolvedValueOnce({ n: 1 });
    const { result } = renderHook(() => useDashboard(ambil, 'a'));
    expect(result.current.memuat).toBe(true);
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));

    const p = tertunda();
    ambil.mockReturnValueOnce(p.janji);
    act(() => result.current.muatUlang());
    expect(result.current.memuat).toBe(true);
    expect(result.current.data).toEqual({ n: 1 });

    await act(async () => p.selesai({ n: 2 }));
    expect(result.current.data).toEqual({ n: 2 });
  });

  it('error tanpa pesan memakai pesan umum dan data lama tetap ada', async () => {
    const ambil = vi.fn().mockResolvedValueOnce({ n: 1 }).mockRejectedValueOnce({});
    const { result } = renderHook(() => useDashboard(ambil, 'a'));
    await waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
    act(() => result.current.muatUlang());
    await waitFor(() => expect(result.current.error).toBe('Terjadi kesalahan. Silakan coba lagi.'));
    expect(result.current.data).toEqual({ n: 1 });
  });

  it.each(['berhasil', 'gagal'])('hasil %s setelah unmount diabaikan', async (jenis) => {
    const p = tertunda();
    const ambil = vi.fn(() => p.janji);
    const { result, unmount } = renderHook(() => useDashboard(ambil, 'a'));
    unmount();
    if (jenis === 'berhasil') p.selesai({ n: 1 });
    else p.gagal(new Error('x'));
    await Promise.resolve();
    expect(result.current.data).toBeNull();
    expect(ambil).toHaveBeenCalledTimes(1);
  });
});
