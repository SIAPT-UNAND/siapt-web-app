import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/prisma.js', () => ({ default: {}, prisma: {} }));

const { keParameterPublik, labelParameter, nilaiSama, normalisasiMasukan, validasiNilai } = await import(
  './konfigurasi.service.js'
);

const DURASI = { kunci_parameter: 'durasi_pinjam_hari', tipe_data: 'number', satuan: 'hari', nilai_min: '1', nilai_maks: '30' };
const TARIF = { kunci_parameter: 'tarif_denda_per_hari', tipe_data: 'decimal', satuan: 'rupiah', nilai_min: '500', nilai_maks: '10000' };
const CHATBOT = { kunci_parameter: 'chatbot_aktif', tipe_data: 'boolean' };
const TEKS = { kunci_parameter: 'info_rekening', tipe_data: null };

function pesanError(fn) {
  try {
    fn();
  } catch (err) {
    return { status: err.statusCode, pesan: err.message };
  }
  return null;
}

describe('validasiNilai', () => {
  it('bilangan bulat dalam rentang diterima dan dinormalisasi', () => {
    expect(validasiNilai(DURASI, '14')).toBe('14');
    expect(validasiNilai(DURASI, ' 007 ')).toBe('7');
    expect(validasiNilai(DURASI, 30)).toBe('30');
    expect(validasiNilai({ ...DURASI, tipe_data: 'integer' }, '1')).toBe('1');
  });

  it.each(['7.5', 'abc', '1e1', '0', '31', '-1'])('bilangan bulat "%s" ditolak dengan pesan rentang', (nilai) => {
    expect(pesanError(() => validasiNilai(DURASI, nilai))).toEqual({
      status: 400,
      pesan: 'Nilai Durasi peminjaman harus bilangan bulat antara 1 dan 30 hari.',
    });
  });

  it('desimal hingga 2 angka diterima', () => {
    expect(validasiNilai(TARIF, '1500.50')).toBe('1500.50');
    expect(validasiNilai(TARIF, '1000')).toBe('1000');
  });

  it.each(['1e3', '12,5', '1500.555', '499', '10000.01'])('desimal "%s" ditolak', (nilai) => {
    expect(pesanError(() => validasiNilai(TARIF, nilai)).status).toBe(400);
  });

  it('boolean menerima true/false (string atau boolean)', () => {
    expect(validasiNilai(CHATBOT, true)).toBe('true');
    expect(validasiNilai(CHATBOT, 'false')).toBe('false');
    expect(validasiNilai(CHATBOT, 'TRUE')).toBe('true');
    expect(pesanError(() => validasiNilai(CHATBOT, 'ya')).pesan).toBe('Nilai Chatbot aktif harus "true" atau "false".');
    expect(pesanError(() => validasiNilai(CHATBOT, '1')).status).toBe(400);
  });

  it('tipe lain diperlakukan sebagai teks 1–255 karakter', () => {
    expect(validasiNilai(TEKS, '  BNI 123  ')).toBe('BNI 123');
    expect(pesanError(() => validasiNilai(TEKS, 'x'.repeat(256))).pesan).toBe('Nilai info_rekening maksimal 255 karakter.');
  });

  it('nilai kosong atau bukan string/angka/boolean ditolak', () => {
    expect(pesanError(() => validasiNilai(DURASI, '  ')).pesan).toBe('Nilai Durasi peminjaman wajib diisi.');
    expect(pesanError(() => validasiNilai(DURASI, null)).pesan).toBe('Nilai Durasi peminjaman tidak valid.');
    expect(pesanError(() => validasiNilai(DURASI, { a: 1 })).status).toBe(400);
    expect(pesanError(() => validasiNilai(DURASI, Number.NaN)).status).toBe(400);
  });

  it('tanpa nilai_min/nilai_maks hanya memeriksa tipe (KF-07)', () => {
    const bebas = { kunci_parameter: 'x', tipe_data: 'number', nilai_min: null, nilai_maks: '' };
    expect(validasiNilai(bebas, '999999')).toBe('999999');
    expect(pesanError(() => validasiNilai(bebas, '1.5')).pesan).toBe('Nilai x harus bilangan bulat.');
  });

  it('pesan rentang hanya batas bawah atau hanya batas atas', () => {
    const hanyaMin = { kunci_parameter: 'x', tipe_data: 'number', nilai_min: '2' };
    const hanyaMaks = { kunci_parameter: 'x', tipe_data: 'decimal', nilai_maks: '5', satuan: 'kali' };
    expect(pesanError(() => validasiNilai(hanyaMin, '1')).pesan).toBe('Nilai x harus bilangan bulat minimal 2.');
    expect(pesanError(() => validasiNilai(hanyaMaks, '6')).pesan).toBe(
      'Nilai x harus angka (maksimal 2 angka desimal) maksimal 5 kali.',
    );
  });

  it('batas yang bukan angka di database diabaikan', () => {
    expect(validasiNilai({ kunci_parameter: 'x', tipe_data: 'number', nilai_min: 'abc' }, '3')).toBe('3');
  });
});

describe('fungsi bantu', () => {
  it('normalisasiMasukan', () => {
    expect(normalisasiMasukan(' 5 ')).toBe('5');
    expect(normalisasiMasukan(5)).toBe('5');
    expect(normalisasiMasukan(false)).toBe('false');
    expect(normalisasiMasukan(Infinity)).toBeNull();
    expect(normalisasiMasukan(undefined)).toBeNull();
  });

  it('nilaiSama membandingkan angka untuk tipe angka', () => {
    expect(nilaiSama(TARIF, '1000.00', '1000')).toBe(true);
    expect(nilaiSama(TARIF, '1000', '1500')).toBe(false);
    expect(nilaiSama(TARIF, null, '1000')).toBe(false);
    expect(nilaiSama(TARIF, '', '0')).toBe(false);
    expect(nilaiSama(CHATBOT, 'true', 'true')).toBe(true);
    expect(nilaiSama(CHATBOT, 'true', 'false')).toBe(false);
  });

  it('labelParameter dan keParameterPublik memakai fallback untuk kunci tak dikenal', () => {
    expect(labelParameter('durasi_pinjam_hari')).toBe('Durasi peminjaman');
    expect(labelParameter('baru')).toBe('baru');
    expect(keParameterPublik({ kunci_parameter: 'baru', id_konfigurasi: 9 })).toEqual({
      kunci_parameter: 'baru',
      label: 'baru',
      deskripsi: '',
      nilai: null,
      tipe_data: null,
      satuan: null,
      nilai_min: null,
      nilai_maks: null,
      wajib: false,
    });
  });
});
