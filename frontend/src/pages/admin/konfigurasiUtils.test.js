import { describe, expect, it } from 'vitest';
import { formatNilai, formatRentang, formatWaktu, jenisTipe, validasiKlien } from './konfigurasiUtils.js';

const DURASI = { tipe_data: 'number', satuan: 'hari', nilai_min: '1', nilai_maks: '30' };
const TARIF = { tipe_data: 'decimal', satuan: 'rupiah', nilai_min: '500', nilai_maks: '10000' };
const CHATBOT = { tipe_data: 'boolean' };
const TEKS = { tipe_data: null };

// Intl memakai spasi tak terputus; samakan agar mudah dibandingkan.
const rapikan = (teks) => teks.replace(/\s/g, ' ');

describe('konfigurasiUtils', () => {
  it('jenisTipe', () => {
    expect(jenisTipe('number')).toBe('bulat');
    expect(jenisTipe('INTEGER')).toBe('bulat');
    expect(jenisTipe('decimal')).toBe('desimal');
    expect(jenisTipe('boolean')).toBe('boolean');
    expect(jenisTipe(undefined)).toBe('teks');
  });

  it('formatNilai', () => {
    expect(formatNilai(DURASI, '7')).toBe('7 hari');
    expect(rapikan(formatNilai(TARIF, '1000'))).toBe('Rp 1.000');
    expect(rapikan(formatNilai(TARIF, '1500.5'))).toBe('Rp 1.500,50');
    expect(formatNilai({ tipe_data: 'number' }, '3')).toBe('3');
    expect(formatNilai(CHATBOT, 'true')).toBe('Aktif');
    expect(formatNilai(CHATBOT, 'false')).toBe('Nonaktif');
    expect(formatNilai(TEKS, 'BNI 123')).toBe('BNI 123');
    expect(formatNilai(DURASI, 'abc')).toBe('abc');
    expect(formatNilai(DURASI, null)).toBe('-');
    expect(formatNilai(undefined, '')).toBe('-');
  });

  it('formatRentang', () => {
    expect(formatRentang(DURASI)).toBe('1–30 hari');
    expect(rapikan(formatRentang(TARIF))).toBe('Rp 500–Rp 10.000');
    expect(formatRentang({ tipe_data: 'number', nilai_min: '1' })).toBe('min. 1');
    expect(formatRentang({ tipe_data: 'number', nilai_maks: '5', satuan: 'kali' })).toBe('maks. 5 kali');
    expect(rapikan(formatRentang({ tipe_data: 'decimal', satuan: 'rupiah', nilai_min: '0' }))).toBe('min. Rp 0');
    expect(rapikan(formatRentang({ tipe_data: 'decimal', satuan: 'rupiah', nilai_maks: '9' }))).toBe('maks. Rp 9');
    expect(formatRentang({ tipe_data: 'number', nilai_min: '', nilai_maks: null })).toBe('Tanpa batas');
    expect(formatRentang(CHATBOT)).toBe('Aktif / Nonaktif');
    expect(formatRentang(TEKS)).toBe('Teks, maks. 255 karakter');
  });

  it.each([
    [DURASI, '14', ''],
    [DURASI, '', 'Nilai wajib diisi.'],
    [DURASI, '7.5', 'Masukkan bilangan bulat tanpa koma.'],
    [DURASI, '31', 'Nilai harus dalam rentang 1–30 hari.'],
    [DURASI, '0', 'Nilai harus dalam rentang 1–30 hari.'],
    [TARIF, '1500.50', ''],
    [TARIF, '1500.555', 'Masukkan angka dengan maksimal 2 angka desimal.'],
    [CHATBOT, 'false', ''],
    [CHATBOT, 'ya', 'Pilih Aktif atau Nonaktif.'],
    [TEKS, 'x'.repeat(256), 'Maksimal 255 karakter.'],
    [TEKS, 'BNI', ''],
  ])('validasiKlien(%o, %j) → %j', (parameter, nilai, pesan) => {
    expect(validasiKlien(parameter, nilai)).toBe(pesan);
  });

  it('formatWaktu', () => {
    expect(formatWaktu(null)).toBe('-');
    expect(formatWaktu('bukan waktu')).toBe('-');
    expect(formatWaktu('2026-11-23T03:00:00.000Z')).toMatch(/2026/);
  });
});
