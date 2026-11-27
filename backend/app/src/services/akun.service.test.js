import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({ default: {}, prisma: {} }));

const { bangunFilterAkun, keAkunPublik, urutkanPeran } = await import('./akun.service.js');

describe('keAkunPublik', () => {
  it('tidak pernah menyertakan kata_sandi_hash', () => {
    const publik = keAkunPublik({
      id_pengguna: 5,
      id_role: 3,
      pengenal: 'anggota01',
      nama: 'Budi',
      kata_sandi_hash: '$2b$10$rahasia',
      status_aktif: true,
      alasan_nonaktif: null,
      dibuat_pada: new Date('2026-11-21T00:00:00Z'),
      role: { id_role: 3, nama_role: 'Anggota' },
    });

    expect(publik).toEqual({
      id_pengguna: 5,
      pengenal: 'anggota01',
      nama: 'Budi',
      role: 'Anggota',
      status_aktif: true,
      alasan_nonaktif: null,
      dibuat_pada: new Date('2026-11-21T00:00:00Z'),
    });
    expect(JSON.stringify(publik)).not.toContain('kata_sandi');
  });

  it('mengisi null untuk kolom kosong dan menganggap status null sebagai nonaktif', () => {
    expect(keAkunPublik({ id_pengguna: 1, pengenal: 'x01', status_aktif: null })).toEqual({
      id_pengguna: 1,
      pengenal: 'x01',
      nama: null,
      role: null,
      status_aktif: false,
      alasan_nonaktif: null,
      dibuat_pada: null,
    });
  });
});

describe('urutkanPeran', () => {
  it('mengurutkan Anggota, Pustakawan, Pengelola, Admin lalu peran lain', () => {
    const hasil = urutkanPeran([
      { id_role: 1, nama_role: 'Admin' },
      { id_role: 9, nama_role: 'Tamu' },
      { id_role: 3, nama_role: 'Anggota' },
      { id_role: 8, nama_role: 'Auditor' },
      { id_role: 4, nama_role: 'Pengelola' },
      { id_role: 2, nama_role: 'Pustakawan' },
    ]);
    expect(hasil.map((r) => r.nama_role)).toEqual([
      'Anggota',
      'Pustakawan',
      'Pengelola',
      'Admin',
      'Auditor',
      'Tamu',
    ]);
  });
});

describe('bangunFilterAkun', () => {
  it('tanpa filter menghasilkan where kosong', () => {
    expect(bangunFilterAkun()).toEqual({});
  });

  it('menggabungkan pencarian, peran, dan status aktif', () => {
    expect(bangunFilterAkun({ q: 'rafi', role: 'Anggota', status: 'aktif' })).toEqual({
      AND: [
        { OR: [{ pengenal: { contains: 'rafi' } }, { nama: { contains: 'rafi' } }] },
        { role: { nama_role: 'Anggota' } },
        { status_aktif: true },
      ],
    });
  });

  it('status nonaktif juga mencakup status null', () => {
    expect(bangunFilterAkun({ status: 'nonaktif' })).toEqual({
      AND: [{ OR: [{ status_aktif: false }, { status_aktif: null }] }],
    });
  });
});
