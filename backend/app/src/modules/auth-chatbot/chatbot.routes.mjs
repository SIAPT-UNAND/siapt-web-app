import { Router } from 'express';
import { prisma } from './db.mjs';
import {
  KUNCI_CHATBOT_AKTIF,
  KUNCI_CHATBOT_PANJANG,
  PANJANG_PESAN_DEFAULT,
  getGeminiConfig,
  getWhatsAppNumber,
} from './config.mjs';
import { createRateLimiter, sendFail, sendOk } from './http.mjs';
import { requireAuth, requireRole } from './auth.middleware.mjs';
import { answerQuestion, buildChatbotWhatsApp } from './chatbot.service.mjs';

const router = Router();

const chatLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: 'Terlalu banyak pesan. Tunggu sebentar lalu coba lagi.',
  keyFn: (req) => `chat|${req.user?.id ?? req.ip}`,
});

async function bacaKonfigurasi() {
  const rows = await prisma.konfigurasiSistem.findMany({
    where: { kunci_parameter: { in: [KUNCI_CHATBOT_AKTIF, KUNCI_CHATBOT_PANJANG] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.kunci_parameter, r.nilai]));

  const aktif =
    map[KUNCI_CHATBOT_AKTIF] === undefined
      ? true
      : ['true', '1', 'ya', 'aktif'].includes(String(map[KUNCI_CHATBOT_AKTIF]).trim().toLowerCase());

  let panjangMaks = Number.parseInt(map[KUNCI_CHATBOT_PANJANG], 10);
  if (!Number.isInteger(panjangMaks) || panjangMaks < 20 || panjangMaks > 2000) {
    panjangMaks = PANJANG_PESAN_DEFAULT;
  }
  return { aktif, panjangMaks };
}

router.get('/chatbot/riwayat', requireAuth, requireRole('Anggota'), async (req, res, next) => {
  try {
    const { aktif, panjangMaks } = await bacaKonfigurasi();
    const rows = await prisma.pesanChatbot.findMany({
      where: { id_anggota: req.user.id },
      orderBy: { id_pesan: 'desc' },
      take: 20,
    });
    rows.reverse();

    const nomor = getWhatsAppNumber();
    const riwayat = rows.map((r) => ({
      id_pesan: r.id_pesan,
      pertanyaan: r.pertanyaan ?? '',
      jawaban: r.jawaban ?? '',
      is_fallback: Boolean(r.is_fallback),
      waktu: r.waktu,
      whatsapp: r.is_fallback
        ? buildChatbotWhatsApp({
            nomor,
            nama: req.user.nama,
            pengenal: req.user.pengenal,
            pertanyaan: r.pertanyaan ?? '',
          })
        : null,
    }));

    return sendOk(res, { aktif, panjang_maks: panjangMaks, riwayat });
  } catch (err) {
    return next(err);
  }
});

router.post('/chatbot/pesan', requireAuth, requireRole('Anggota'), chatLimiter, async (req, res) => {
  try {
    const { aktif, panjangMaks } = await bacaKonfigurasi();

    const pesan = String(req.body?.pesan ?? '').trim();
    if (!pesan) {
      return sendFail(res, 400, 'Pesan tidak boleh kosong.');
    }
    if (pesan.length > panjangMaks) {
      return sendFail(res, 400, `Pesan maksimal ${panjangMaks} karakter.`);
    }

    const faqs = await prisma.faq.findMany({
      where: { status_aktif: true },
      select: { id_faq: true, pertanyaan: true, jawaban: true, kata_kunci: true },
    });

    // 6 percakapan terakhir (yang berhasil dijawab) sebagai konteks agar tanya-jawab nyambung
    const riwayatDesc = await prisma.pesanChatbot.findMany({
      where: { id_anggota: req.user.id, is_fallback: false },
      orderBy: { id_pesan: 'desc' },
      take: 6,
      select: { pertanyaan: true, jawaban: true },
    });

    const hasil = await answerQuestion({
      pesan,
      riwayat: riwayatDesc.reverse(),
      faqs,
      user: req.user,
      aktif,
      gemini: getGeminiConfig(),
      nomorWa: getWhatsAppNumber(),
    });

    const tersimpan = await prisma.pesanChatbot.create({
      data: {
        id_anggota: req.user.id,
        id_faq: hasil.idFaq,
        pertanyaan: pesan,
        jawaban: hasil.jawaban,
        is_fallback: hasil.fallback,
        waktu: new Date(),
      },
    });

    return sendOk(res, {
      id_pesan: tersimpan.id_pesan,
      jawaban: hasil.jawaban,
      sumber: hasil.sumber,
      is_fallback: hasil.fallback,
      whatsapp: hasil.whatsapp,
      waktu: tersimpan.waktu,
    });
  } catch (err) {
    console.error('[chatbot] error:', err);
    return sendFail(res, 500, 'Chatbot sedang tidak dapat digunakan. Coba lagi nanti.');
  }
});

export default router;