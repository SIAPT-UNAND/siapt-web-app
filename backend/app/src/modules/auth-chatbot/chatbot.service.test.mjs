import { describe, expect, it, vi } from 'vitest';
import {
  FALLBACK_MARK,
  PESAN_ALIHKAN_WA,
  answerQuestion,
  findFaqMatch,
  samarkanDataPribadi,
} from './chatbot.service.mjs';
import { buildWhatsAppLink, formatWhatsAppDisplay } from './whatsapp.mjs';

const faqs = [
  {
    id_faq: 1,
    pertanyaan: 'Bagaimana cara meminjam koleksi?',
    jawaban: 'Pilih koleksi lalu klik Pinjam.',
    kata_kunci: 'pinjam,meminjam,peminjaman,cara pinjam',
  },
  {
    id_faq: 2,
    pertanyaan: 'Kapan denda dikenakan?',
    jawaban: 'Denda dikenakan jika terlambat mengembalikan.',
    kata_kunci: 'denda,terlambat,telat',
  },
  {
    id_faq: 3,
    pertanyaan: 'Bagaimana cara membayar denda?',
    jawaban: 'Unggah bukti pembayaran.',
    kata_kunci: 'bayar denda,membayar denda,membayar,bayar',
  },
];

const user = { nama: 'Mahasiswa Demo', pengenal: 'anggota01' };
const nomorWa = '6282369502005';

function geminiOk(text) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  });
}

describe('findFaqMatch', () => {
  it('mengembalikan FAQ yang cocok jelas', () => {
    expect(findFaqMatch('Bagaimana cara meminjam koleksi?', faqs)?.id_faq).toBe(1);
  });

  it('mengutamakan frasa yang lebih panjang', () => {
    expect(findFaqMatch('Bagaimana cara membayar denda?', faqs)?.id_faq).toBe(3);
  });

  it('mengembalikan null jika tidak ada kecocokan', () => {
    expect(findFaqMatch('resep nasi goreng enak', faqs)).toBeNull();
  });

  it('menyerahkan kalimat panjang dengan satu kata kunci ke Gemini', () => {
    const panjang =
      'Kalau buku yang sudah saya pinjam kemarin ternyata hilang di perjalanan pulang dari kampus bagaimana';
    expect(findFaqMatch(panjang, faqs)).toBeNull();
  });
});

describe('WhatsApp', () => {
  it('memformat nomor untuk tampilan', () => {
    expect(formatWhatsAppDisplay('6282369502005')).toBe('+62 823-6950-2005');
  });

  it('membuat tautan wa.me dengan teks ter-encode', () => {
    const link = buildWhatsAppLink('6282369502005', 'Halo & salam');
    expect(link.url).toBe('https://wa.me/6282369502005?text=Halo%20%26%20salam');
  });
});

describe('answerQuestion', () => {
  it('langkah 1: menjawab dari FAQ tanpa memanggil Gemini', async () => {
    const fetchImpl = vi.fn();
    const hasil = await answerQuestion({
      pesan: 'Kapan denda dikenakan?',
      faqs,
      user,
      nomorWa,
      gemini: { apiKey: 'k', model: 'm' },
      fetchImpl,
    });
    expect(hasil.sumber).toBe('faq');
    expect(hasil.idFaq).toBe(2);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('langkah 2: menjawab dari Gemini jika FAQ tidak cocok', async () => {
    const hasil = await answerQuestion({
      pesan: 'Halo, selamat pagi',
      faqs,
      user,
      nomorWa,
      gemini: { apiKey: 'k', model: 'm' },
      fetchImpl: geminiOk('Selamat pagi! Ada yang bisa kubantu?'),
    });
    expect(hasil.sumber).toBe('gemini');
    expect(hasil.fallback).toBe(false);
  });

  it('langkah 3: mengalihkan ke WhatsApp jika Gemini menandai tidak bisa menjawab', async () => {
    const hasil = await answerQuestion({
      pesan: 'Siapa presiden pertama Indonesia?',
      faqs,
      user,
      nomorWa,
      gemini: { apiKey: 'k', model: 'm' },
      fetchImpl: geminiOk(`Maaf, itu di luar layanan perpustakaan. ${FALLBACK_MARK}`),
    });
    expect(hasil.sumber).toBe('whatsapp');
    expect(hasil.jawaban).toBe(PESAN_ALIHKAN_WA);
    expect(hasil.whatsapp.url).toContain('https://wa.me/6282369502005?text=');
  });

  it('langkah 3: mengalihkan ke WhatsApp jika Gemini error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'unavailable',
    });
    const hasil = await answerQuestion({
      pesan: 'Pertanyaan bebas apa saja',
      faqs,
      user,
      nomorWa,
      gemini: { apiKey: 'k', model: 'm' },
      fetchImpl,
    });
    expect(hasil.sumber).toBe('whatsapp');
    expect(hasil.fallback).toBe(true);
  });

  it('mengalihkan ke WhatsApp jika API key kosong', async () => {
    const hasil = await answerQuestion({
      pesan: 'Pertanyaan bebas apa saja',
      faqs,
      user,
      nomorWa,
      gemini: { apiKey: '', model: 'm' },
      fetchImpl: vi.fn(),
    });
    expect(hasil.sumber).toBe('whatsapp');
  });

  it('mengalihkan ke WhatsApp jika chatbot dinonaktifkan', async () => {
    const fetchImpl = vi.fn();
    const hasil = await answerQuestion({
      pesan: 'Kapan denda dikenakan?',
      faqs,
      user,
      nomorWa,
      aktif: false,
      gemini: { apiKey: 'k', model: 'm' },
      fetchImpl,
    });
    expect(hasil.sumber).toBe('whatsapp');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('samarkanDataPribadi', () => {
  it('menyamarkan email, NIM, dan nomor HP', () => {
    expect(samarkanDataPribadi('NIM 2311521005, HP +62 812-3456-7890, a.b@mail.ac.id')).toBe(
      'NIM [nomor], HP [nomor], [email]',
    );
  });

  it('menyamarkan NIM dan nomor HP bertanda hubung atau spasi yang mirip tanggal', () => {
    for (const nomor of [
      '2311-52-10-05',
      '2311-05-10-05',
      '2311-05-10 05',
      '0812-34-56-7890',
      '0812 34 56 7890',
    ]) {
      expect(samarkanDataPribadi(`Nomor ${nomor} ya`)).toBe('Nomor [nomor] ya');
    }
  });

  it('membiarkan tanggal yang diikuti jam atau didahului angka', () => {
    for (const teks of [
      'Buka pada 2026-11-27 10:00?',
      'Antrian 12 27-11-2026 09.30',
      'Dari 2026-11-27 2026-11-30',
    ]) {
      expect(samarkanDataPribadi(teks)).toBe(teks);
    }
  });

  it('membiarkan angka pendek dan tanggal', () => {
    expect(samarkanDataPribadi('Pinjam 3 buku sejak 2026-11-27')).toBe(
      'Pinjam 3 buku sejak 2026-11-27',
    );
  });
});
