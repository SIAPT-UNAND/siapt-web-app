import { describe, expect, it, vi } from 'vitest';
import {
  ajukanPermintaan,
  daftarPermintaanAnggota,
  daftarPermintaanPustakawan,
  normalizeKeywords,
  statusSaatIni,
  tanggapiPermintaan,
  validateAjukanInput,
  validateTanggapanInput,
} from './permintaan.service.mjs';

function buatPrisma({ permintaan, jumlahDiperbarui = 1 }) {
  const tx = {
    permintaanLayanan: {
      findUnique: vi.fn().mockResolvedValue(permintaan),
      updateMany: vi.fn().mockResolvedValue({ count: jumlahDiperbarui }),
    },
    tanggapanPermintaan: {
      create: vi.fn().mockResolvedValue({
        id_tanggapan: 9,
        catatan: 'Jawaban',
        status_hasil: 'Selesai',
        waktu: new Date(),
      }),
    },
    faq: { create: vi.fn().mockResolvedValue({ id_faq: 5 }) },
  };
  return { prisma: { $transaction: async (cb) => cb(tx) }, tx };
}

const pustakawan = { id: 2, nama: 'Pustakawan Demo' };
const anggota = { id: 1, nama: 'Anggota Demo', pengenal: 'anggota01' };

describe('normalizeKeywords', () => {
  it('merapikan, mengecilkan huruf, dan membuang duplikat', () => {
    expect(normalizeKeywords('Pinjam, MEMINJAM ,, pinjam')).toBe('pinjam,meminjam');
  });

  it('mengembalikan string kosong jika tidak ada kata kunci', () => {
    expect(normalizeKeywords(' , ,')).toBe('');
  });
});

describe('statusSaatIni', () => {
  it('menganggap status kosong sebagai Baru', () => {
    expect(statusSaatIni(null)).toBe('Baru');
    expect(statusSaatIni('Diproses')).toBe('Diproses');
  });
});

describe('validateAjukanInput', () => {
  it('menerima input yang valid', () => {
    expect(validateAjukanInput({ id_pesan: 3, isi_permintaan: '  Tolong dibantu ' })).toEqual({
      idPesan: 3,
      isi: 'Tolong dibantu',
    });
  });

  it('menolak id pesan tidak valid dan isi kosong', () => {
    expect(validateAjukanInput({ id_pesan: 'abc', isi_permintaan: 'x' }).error).toBeTruthy();
    expect(validateAjukanInput({ id_pesan: 3, isi_permintaan: '   ' }).error).toBeTruthy();
  });

  it('menolak isi yang terlalu panjang', () => {
    expect(validateAjukanInput({ id_pesan: 3, isi_permintaan: 'a'.repeat(1001) }).error).toBeTruthy();
  });
});

describe('validateTanggapanInput', () => {
  it('menolak status di luar alur', () => {
    expect(validateTanggapanInput({ catatan: 'ok', status: 'Baru' }).error).toBeTruthy();
  });

  it('mewajibkan alasan saat Ditolak', () => {
    const hasil = validateTanggapanInput({ catatan: ' ', status: 'Ditolak' });
    expect(hasil.error).toBe('Alasan penolakan wajib diisi.');
  });

  it('hanya mengizinkan FAQ saat status Selesai', () => {
    const hasil = validateTanggapanInput({
      catatan: 'ok',
      status: 'Diproses',
      faq: { pertanyaan: 'Q', kata_kunci: 'k' },
    });
    expect(hasil.error).toBeTruthy();
  });

  it('merapikan kata kunci FAQ', () => {
    const hasil = validateTanggapanInput({
      catatan: 'Jawaban lengkap',
      status: 'Selesai',
      faq: { pertanyaan: 'Jam buka?', kata_kunci: 'Jam Buka, buka,  JAM buka' },
    });
    expect(hasil.faq).toEqual({ pertanyaan: 'Jam buka?', kata_kunci: 'jam buka,buka' });
  });

  it('mewajibkan kata kunci jika FAQ dicentang', () => {
    const hasil = validateTanggapanInput({
      catatan: 'Jawaban',
      status: 'Selesai',
      faq: { pertanyaan: 'Jam buka?', kata_kunci: ' , ' },
    });
    expect(hasil.error).toBeTruthy();
  });
});

describe('ajukanPermintaan', () => {
  it('menolak jika pesan bukan milik Anggota', async () => {
    const prisma = { pesanChatbot: { findFirst: vi.fn().mockResolvedValue(null) } };
    await expect(ajukanPermintaan(prisma, anggota, { idPesan: 3, isi: 'x' })).rejects.toMatchObject({
      status: 404,
    });
  });

  it('menolak jika pesan sudah pernah diajukan', async () => {
    const prisma = {
      pesanChatbot: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id_pesan: 3, permintaan_layanan: { id_permintaan: 1 } }),
      },
    };
    await expect(ajukanPermintaan(prisma, anggota, { idPesan: 3, isi: 'x' })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('menangani pengajuan ganda bersamaan (P2002)', async () => {
    const prisma = {
      pesanChatbot: {
        findFirst: vi.fn().mockResolvedValue({ id_pesan: 3, permintaan_layanan: null }),
      },
      permintaanLayanan: {
        create: vi.fn().mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' })),
      },
    };
    await expect(ajukanPermintaan(prisma, anggota, { idPesan: 3, isi: 'x' })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('menyimpan permintaan berstatus Baru', async () => {
    const create = vi.fn().mockResolvedValue({
      id_permintaan: 10,
      id_pesan: 3,
      jenis_permintaan: 'Pertanyaan',
      isi_permintaan: 'Jam buka?',
      status: 'Baru',
      dibuat_pada: new Date(),
      diperbarui_pada: new Date(),
    });
    const prisma = {
      pesanChatbot: {
        findFirst: vi.fn().mockResolvedValue({ id_pesan: 3, permintaan_layanan: null }),
      },
      permintaanLayanan: { create },
    };
    const hasil = await ajukanPermintaan(prisma, anggota, { idPesan: 3, isi: 'Jam buka?' });
    expect(create.mock.calls[0][0].data).toMatchObject({
      id_pesan: 3,
      isi_permintaan: 'Jam buka?',
      status: 'Baru',
    });
    expect(hasil.status).toBe('Baru');
    expect(hasil.tanggapan).toEqual([]);
  });
});

describe('daftarPermintaanPustakawan (antrian)', () => {
  function buatPrismaDaftar(baris = []) {
    return {
      permintaanLayanan: {
        findMany: vi.fn().mockResolvedValue(baris),
        groupBy: vi.fn().mockResolvedValue([
          { status: null, _count: { _all: 2 } },
          { status: 'Baru', _count: { _all: 1 } },
          { status: 'Selesai', _count: { _all: 4 } },
        ]),
      },
    };
  }

  const barisContoh = {
    id_permintaan: 7,
    isi_permintaan: 'Tanya jam buka',
    status: null,
    dibuat_pada: new Date('2026-11-01T00:00:00Z'),
    diperbarui_pada: new Date('2026-11-01T00:00:00Z'),
    pesan_chatbot: { anggota: { nama: 'Anggota Demo', pengenal: 'anggota01' } },
    _count: { tanggapan_permintaan: 0 },
  };

  it('tanpa filter: yang terbuka paling lama dulu, lalu yang sudah ditutup terbaru dulu', async () => {
    const prisma = buatPrismaDaftar();
    await daftarPermintaanPustakawan(prisma, undefined);
    const urutan = prisma.permintaanLayanan.findMany.mock.calls.map(([arg]) => arg.orderBy);
    expect(urutan).toEqual([
      [{ dibuat_pada: 'asc' }, { id_permintaan: 'asc' }],
      [{ dibuat_pada: 'desc' }, { id_permintaan: 'desc' }],
    ]);
  });

  it('filter Baru: urutan antrian dan menyertakan status kosong', async () => {
    const prisma = buatPrismaDaftar();
    await daftarPermintaanPustakawan(prisma, 'Baru');
    const arg = prisma.permintaanLayanan.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ OR: [{ status: null }, { status: 'Baru' }] });
    expect(arg.orderBy[0]).toEqual({ dibuat_pada: 'asc' });
  });

  it('filter Selesai: terbaru dulu', async () => {
    const prisma = buatPrismaDaftar();
    await daftarPermintaanPustakawan(prisma, 'Selesai');
    const arg = prisma.permintaanLayanan.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ status: 'Selesai' });
    expect(arg.orderBy[0]).toEqual({ dibuat_pada: 'desc' });
  });

  it('menolak filter yang tidak dikenal', async () => {
    await expect(daftarPermintaanPustakawan(buatPrismaDaftar(), 'Aneh')).rejects.toMatchObject({
      status: 400,
    });
  });

  it('ringkasan menghitung status kosong sebagai Baru', async () => {
    const hasil = await daftarPermintaanPustakawan(buatPrismaDaftar(), undefined);
    expect(hasil.ringkasan).toEqual({ Baru: 3, Diproses: 0, Selesai: 4, Ditolak: 0 });
  });

  it('memetakan baris permintaan', async () => {
    const hasil = await daftarPermintaanPustakawan(buatPrismaDaftar([barisContoh]), 'Baru');
    expect(hasil.permintaan[0]).toMatchObject({
      id_permintaan: 7,
      status: 'Baru',
      anggota: { nama: 'Anggota Demo', pengenal: 'anggota01' },
      jumlah_tanggapan: 0,
    });
  });
});

describe('tanggapiPermintaan', () => {
  it('menolak permintaan yang tidak ditemukan', async () => {
    const { prisma } = buatPrisma({ permintaan: null });
    await expect(
      tanggapiPermintaan(prisma, pustakawan, 1, { catatan: 'x', status: 'Selesai', faq: null }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('menolak permintaan yang sudah terkunci', async () => {
    const { prisma, tx } = buatPrisma({ permintaan: { id_permintaan: 1, status: 'Selesai' } });
    await expect(
      tanggapiPermintaan(prisma, pustakawan, 1, { catatan: 'x', status: 'Diproses', faq: null }),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.tanggapanPermintaan.create).not.toHaveBeenCalled();
  });

  it('menolak jika permintaan sudah diubah Pustakawan lain', async () => {
    const { prisma } = buatPrisma({
      permintaan: { id_permintaan: 1, status: 'Baru' },
      jumlahDiperbarui: 0,
    });
    await expect(
      tanggapiPermintaan(prisma, pustakawan, 1, { catatan: 'x', status: 'Selesai', faq: null }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('menyimpan tanggapan dan mengubah status', async () => {
    const { prisma, tx } = buatPrisma({ permintaan: { id_permintaan: 1, status: null } });
    const hasil = await tanggapiPermintaan(prisma, pustakawan, 1, {
      catatan: 'Sedang dicek',
      status: 'Diproses',
      faq: null,
    });
    expect(hasil.permintaan.status).toBe('Diproses');
    expect(hasil.faq_dibuat).toBeNull();
    expect(tx.faq.create).not.toHaveBeenCalled();
  });

  it('menambahkan FAQ dengan catatan sebagai jawaban', async () => {
    const { prisma, tx } = buatPrisma({ permintaan: { id_permintaan: 1, status: 'Diproses' } });
    const hasil = await tanggapiPermintaan(prisma, pustakawan, 1, {
      catatan: 'Perpustakaan buka Senin sampai Jumat.',
      status: 'Selesai',
      faq: { pertanyaan: 'Jam buka perpustakaan?', kata_kunci: 'jam buka,buka' },
    });
    expect(tx.faq.create).toHaveBeenCalledWith({
      data: {
        pertanyaan: 'Jam buka perpustakaan?',
        jawaban: 'Perpustakaan buka Senin sampai Jumat.',
        kata_kunci: 'jam buka,buka',
        status_aktif: true,
      },
    });
    expect(hasil.faq_dibuat).toEqual({ id_faq: 5 });
  });
});

describe('daftarPermintaanAnggota (paginasi)', () => {
  it('mengambil halaman yang diminta dan menghitung total halaman', async () => {
    const prisma = {
      permintaanLayanan: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(51),
      },
    };
    const hasil = await daftarPermintaanAnggota(prisma, 1, 2);
    expect(prisma.permintaanLayanan.findMany.mock.calls[0][0]).toMatchObject({ skip: 50, take: 50 });
    expect(hasil).toMatchObject({ halaman: 2, total_halaman: 2, permintaan: [] });
  });
});
