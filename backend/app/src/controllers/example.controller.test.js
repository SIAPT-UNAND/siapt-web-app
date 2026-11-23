import { describe, expect, it, vi } from 'vitest';
import { getItems } from './example.controller.js';

describe('example.controller getItems', () => {
  it('mengembalikan daftar layanan perpustakaan dengan status 200', () => {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    getItems({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(3);
    expect(body.data[0]).toEqual(
      expect.objectContaining({ id: 1, title: 'Katalog Buku & Jurnal' }),
    );
  });
});