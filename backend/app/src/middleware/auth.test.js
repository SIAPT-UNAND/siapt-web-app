import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const db = vi.hoisted(() => ({
  pengguna: { findUnique: vi.fn() },
}));
vi.mock('../lib/prisma.js', () => ({ default: db, prisma: db }));

const { requireAuth, requireRole, shimAktif } = await import('./auth.js');

function buatApp() {
  const app = express();
  app.get('/rahasia', requireAuth, requireRole('Admin'), (req, res) => {
    res.json({ success: true, data: req.user });
  });
  app.get('/tanpa-auth', requireRole('Admin'), (req, res) => res.json({ success: true }));
  app.use((err, req, res, _next) => {
    res.status(500).json({ success: false, message: 'Terjadi kesalahan.' });
  });
  return app;
}

const akunAdmin = {
  id_pengguna: 1,
  pengenal: 'admin01',
  nama: 'Admin Demo',
  status_aktif: true,
  role: { nama_role: 'Admin' },
};

describe('middleware/auth.js (shim sementara)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('default mati: tanpa AUTH_SEMENTARA=true selalu 401 dan tidak membaca database', async () => {
    vi.stubEnv('AUTH_SEMENTARA', '');
    expect(shimAktif()).toBe(false);

    const res = await request(buatApp()).get('/rahasia').set('x-pengenal', 'admin01');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: 'Silakan login terlebih dahulu.' });
    expect(db.pengguna.findUnique).not.toHaveBeenCalled();
  });

  describe('saat AUTH_SEMENTARA=true', () => {
    beforeEach(() => {
      vi.stubEnv('AUTH_SEMENTARA', 'true');
    });

    it('menolak 401 jika header x-pengenal kosong', async () => {
      const res = await request(buatApp()).get('/rahasia').set('x-pengenal', '   ');
      expect(res.status).toBe(401);
      expect(db.pengguna.findUnique).not.toHaveBeenCalled();
    });

    it('menolak 401 jika akun tidak ditemukan', async () => {
      db.pengguna.findUnique.mockResolvedValue(null);
      const res = await request(buatApp()).get('/rahasia').set('x-pengenal', 'tidak-ada');
      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Sesi tidak valid atau akun tidak aktif. Silakan login kembali.');
    });

    it('menolak 401 jika akun nonaktif', async () => {
      db.pengguna.findUnique.mockResolvedValue({ ...akunAdmin, status_aktif: false });
      const res = await request(buatApp()).get('/rahasia').set('x-pengenal', 'admin01');
      expect(res.status).toBe(401);
    });

    it('menolak 403 jika peran tidak sesuai', async () => {
      db.pengguna.findUnique.mockResolvedValue({ ...akunAdmin, role: { nama_role: 'Anggota' } });
      const res = await request(buatApp()).get('/rahasia').set('x-pengenal', 'anggota01');
      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        success: false,
        message: 'Kamu tidak memiliki izin untuk mengakses fungsi ini.',
      });
    });

    it('mengisi req.user dengan bentuk yang sama seperti modul Clara', async () => {
      db.pengguna.findUnique.mockResolvedValue(akunAdmin);
      const res = await request(buatApp()).get('/rahasia').set('x-pengenal', ' admin01 ');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ id: 1, nama: 'Admin Demo', pengenal: 'admin01', role: 'Admin' });
      expect(db.pengguna.findUnique).toHaveBeenCalledWith({
        where: { pengenal: 'admin01' },
        include: { role: true },
      });
    });

    it('memakai pengenal sebagai nama jika nama kosong', async () => {
      db.pengguna.findUnique.mockResolvedValue({ ...akunAdmin, nama: null });
      const res = await request(buatApp()).get('/rahasia').set('x-pengenal', 'admin01');
      expect(res.body.data.nama).toBe('admin01');
    });

    it('meneruskan error database ke error handler', async () => {
      db.pengguna.findUnique.mockRejectedValue(new Error('koneksi putus'));
      const res = await request(buatApp()).get('/rahasia').set('x-pengenal', 'admin01');
      expect(res.status).toBe(500);
    });
  });

  it('requireRole menolak 401 jika req.user belum ada', async () => {
    const res = await request(buatApp()).get('/tanpa-auth');
    expect(res.status).toBe(401);
  });
});
