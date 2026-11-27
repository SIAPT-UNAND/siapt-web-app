// Permintaan layanan: Anggota mengajukan dari chatbot, Pustakawan menanggapi (A3 UC-07 dan UC-11).

export const JENIS_PERMINTAAN = 'Pertanyaan';

export const STATUS_BARU = 'Baru';
export const STATUS_FILTER = ['Baru', 'Diproses', 'Selesai', 'Ditolak'];
export const STATUS_TANGGAPAN = ['Diproses', 'Selesai', 'Ditolak'];
export const STATUS_TERBUKA = ['Baru', 'Diproses'];
export const STATUS_TERKUNCI = ['Selesai', 'Ditolak'];

export const MAKS_ISI = 1000;
export const MAKS_CATATAN = 2000;
export const MAKS_FAQ_PERTANYAAN = 500;
export const MAKS_KATA_KUNCI = 255;
export const BATAS_DAFTAR = 100;
export const BATAS_PER_HALAMAN = 50;

// Antrian: yang paling lama menunggu berada di paling atas. Riwayat: yang terbaru di atas.
const URUT_ANTRIAN = [{ dibuat_pada: 'asc' }, { id_permintaan: 'asc' }];
const URUT_RIWAYAT = [{ dibuat_pada: 'desc' }, { id_permintaan: 'desc' }];
const URUT_TANGGAPAN = [{ waktu: 'asc' }, { id_tanggapan: 'asc' }];

export class PermintaanError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'PermintaanError';
    this.status = status;
  }
}

// Status kosong (null) dianggap Baru
export function statusSaatIni(status) {
  return status || STATUS_BARU;
}

// "Pinjam, MEMINJAM ,, pinjam" -> "pinjam,meminjam"
export function normalizeKeywords(raw) {
  const seen = new Set();
  const out = [];
  for (const part of String(raw ?? '').split(',')) {
    const kw = part.trim().toLowerCase().replace(/\s+/g, ' ');
    if (kw && !seen.has(kw)) {
      seen.add(kw);
      out.push(kw);
    }
  }
  return out.join(',');
}

export function validateAjukanInput(body) {
  const idPesan = Number(body?.id_pesan);
  const isi = String(body?.isi_permintaan ?? '').trim();

  if (!Number.isInteger(idPesan) || idPesan <= 0) {
    return { error: 'Pesan chatbot tidak valid.' };
  }
  if (!isi) {
    return { error: 'Isi permintaan tidak boleh kosong.' };
  }
  if (isi.length > MAKS_ISI) {
    return { error: `Isi permintaan maksimal ${MAKS_ISI} karakter.` };
  }
  return { idPesan, isi };
}

export function validateTanggapanInput(body) {
  const catatan = String(body?.catatan ?? '').trim();
  const status = String(body?.status ?? '').trim();

  if (!STATUS_TANGGAPAN.includes(status)) {
    return { error: 'Status harus Diproses, Selesai, atau Ditolak.' };
  }
  if (!catatan) {
    return {
      error: status === 'Ditolak' ? 'Alasan penolakan wajib diisi.' : 'Tanggapan tidak boleh kosong.',
    };
  }
  if (catatan.length > MAKS_CATATAN) {
    return { error: `Tanggapan maksimal ${MAKS_CATATAN} karakter.` };
  }

  let faq = null;
  if (body?.faq) {
    if (status !== 'Selesai') {
      return { error: 'Jawaban hanya bisa ditambahkan ke FAQ jika status Selesai.' };
    }
    const pertanyaan = String(body.faq.pertanyaan ?? '').trim();
    const kataKunci = normalizeKeywords(body.faq.kata_kunci);

    if (!pertanyaan) {
      return { error: 'Pertanyaan FAQ tidak boleh kosong.' };
    }
    if (pertanyaan.length > MAKS_FAQ_PERTANYAAN) {
      return { error: `Pertanyaan FAQ maksimal ${MAKS_FAQ_PERTANYAAN} karakter.` };
    }
    if (!kataKunci) {
      return { error: 'Kata kunci FAQ wajib diisi (pisahkan dengan koma).' };
    }
    if (kataKunci.length > MAKS_KATA_KUNCI) {
      return { error: `Kata kunci FAQ maksimal ${MAKS_KATA_KUNCI} karakter.` };
    }
    faq = { pertanyaan, kata_kunci: kataKunci };
  }

  return { catatan, status, faq };
}

function formatTanggapan(t) {
  const hasil = {
    id_tanggapan: t.id_tanggapan,
    catatan: t.catatan ?? '',
    status_hasil: t.status_hasil,
    waktu: t.waktu,
  };
  if (t.pustakawan) {
    hasil.pustakawan = t.pustakawan.nama || 'Pustakawan';
  }
  return hasil;
}

function formatPermintaan(r, tanggapan = []) {
  return {
    id_permintaan: r.id_permintaan,
    id_pesan: r.id_pesan,
    jenis_permintaan: r.jenis_permintaan,
    isi_permintaan: r.isi_permintaan ?? '',
    status: statusSaatIni(r.status),
    dibuat_pada: r.dibuat_pada,
    diperbarui_pada: r.diperbarui_pada,
    tanggapan: tanggapan.map(formatTanggapan),
  };
}

// ---------- Anggota ----------

export async function ajukanPermintaan(prisma, user, { idPesan, isi }) {
  const pesan = await prisma.pesanChatbot.findFirst({
    where: { id_pesan: idPesan, id_anggota: user.id },
    select: { id_pesan: true, permintaan_layanan: { select: { id_permintaan: true } } },
  });

  if (!pesan) {
    throw new PermintaanError(404, 'Pesan chatbot tidak ditemukan.');
  }
  if (pesan.permintaan_layanan) {
    throw new PermintaanError(409, 'Permintaan untuk pesan ini sudah pernah diajukan.');
  }

  const sekarang = new Date();
  try {
    const dibuat = await prisma.permintaanLayanan.create({
      data: {
        id_pesan: idPesan,
        jenis_permintaan: JENIS_PERMINTAAN,
        isi_permintaan: isi,
        status: STATUS_BARU,
        dibuat_pada: sekarang,
        diperbarui_pada: sekarang,
      },
    });
    return formatPermintaan(dibuat, []);
  } catch (err) {
    if (err?.code === 'P2002') {
      throw new PermintaanError(409, 'Permintaan untuk pesan ini sudah pernah diajukan.');
    }
    throw err;
  }
}

export async function daftarPermintaanAnggota(prisma, idAnggota, halaman = 1) {
  const where = { pesan_chatbot: { id_anggota: idAnggota } };
  const [rows, total] = await Promise.all([
    prisma.permintaanLayanan.findMany({
      where,
      orderBy: URUT_RIWAYAT,
      skip: (halaman - 1) * BATAS_PER_HALAMAN,
      take: BATAS_PER_HALAMAN,
      include: { tanggapan_permintaan: { orderBy: URUT_TANGGAPAN } },
    }),
    prisma.permintaanLayanan.count({ where }),
  ]);
  return {
    permintaan: rows.map((r) => formatPermintaan(r, r.tanggapan_permintaan)),
    halaman,
    total_halaman: Math.max(1, Math.ceil(total / BATAS_PER_HALAMAN)),
  };
}

// ---------- Pustakawan ----------

const WHERE_TERBUKA = { OR: [{ status: null }, { status: { in: STATUS_TERBUKA } }] };
const WHERE_TERTUTUP = { status: { in: STATUS_TERKUNCI } };

const INCLUDE_DAFTAR = {
  pesan_chatbot: {
    select: { anggota: { select: { nama: true, pengenal: true } } },
  },
  _count: { select: { tanggapan_permintaan: true } },
};

// Antrian Pustakawan.
// Tanpa filter: permintaan yang masih terbuka (Baru/Diproses) dulu, yang paling lama menunggu di atas,
// lalu permintaan yang sudah selesai/ditolak (terbaru di atas).
export async function daftarPermintaanPustakawan(prisma, statusFilter) {
  let rows;

  if (!statusFilter) {
    const [terbuka, tertutup] = await Promise.all([
      prisma.permintaanLayanan.findMany({
        where: WHERE_TERBUKA,
        orderBy: URUT_ANTRIAN,
        take: BATAS_DAFTAR,
        include: INCLUDE_DAFTAR,
      }),
      prisma.permintaanLayanan.findMany({
        where: WHERE_TERTUTUP,
        orderBy: URUT_RIWAYAT,
        take: BATAS_DAFTAR,
        include: INCLUDE_DAFTAR,
      }),
    ]);
    rows = [...terbuka, ...tertutup];
  } else {
    if (!STATUS_FILTER.includes(statusFilter)) {
      throw new PermintaanError(400, 'Filter status tidak valid.');
    }
    const where =
      statusFilter === STATUS_BARU ? { OR: [{ status: null }, { status: STATUS_BARU }] } : { status: statusFilter };
    rows = await prisma.permintaanLayanan.findMany({
      where,
      orderBy: STATUS_TERBUKA.includes(statusFilter) ? URUT_ANTRIAN : URUT_RIWAYAT,
      take: BATAS_DAFTAR,
      include: INCLUDE_DAFTAR,
    });
  }

  const grup = await prisma.permintaanLayanan.groupBy({
    by: ['status'],
    _count: { _all: true },
  });
  const ringkasan = { Baru: 0, Diproses: 0, Selesai: 0, Ditolak: 0 };
  for (const g of grup) {
    const kunci = statusSaatIni(g.status);
    if (kunci in ringkasan) ringkasan[kunci] += g._count._all;
  }

  return {
    ringkasan,
    permintaan: rows.map((r) => ({
      id_permintaan: r.id_permintaan,
      isi_permintaan: r.isi_permintaan ?? '',
      status: statusSaatIni(r.status),
      dibuat_pada: r.dibuat_pada,
      diperbarui_pada: r.diperbarui_pada,
      anggota: {
        nama: r.pesan_chatbot?.anggota?.nama ?? '-',
        pengenal: r.pesan_chatbot?.anggota?.pengenal ?? '-',
      },
      jumlah_tanggapan: r._count?.tanggapan_permintaan ?? 0,
    })),
  };
}

export async function detailPermintaan(prisma, id) {
  const r = await prisma.permintaanLayanan.findUnique({
    where: { id_permintaan: id },
    include: {
      pesan_chatbot: {
        include: { anggota: { select: { nama: true, pengenal: true } } },
      },
      tanggapan_permintaan: {
        orderBy: URUT_TANGGAPAN,
        include: { pustakawan: { select: { nama: true } } },
      },
    },
  });

  if (!r) {
    throw new PermintaanError(404, 'Permintaan layanan tidak ditemukan.');
  }

  return {
    ...formatPermintaan(r, r.tanggapan_permintaan),
    anggota: {
      nama: r.pesan_chatbot?.anggota?.nama ?? '-',
      pengenal: r.pesan_chatbot?.anggota?.pengenal ?? '-',
    },
    chatbot: {
      pertanyaan: r.pesan_chatbot?.pertanyaan ?? '',
      jawaban: r.pesan_chatbot?.jawaban ?? '',
    },
  };
}

// Menyimpan tanggapan + mengubah status (+ opsional menambah FAQ) dalam satu transaksi.
export async function tanggapiPermintaan(prisma, user, id, input) {
  return prisma.$transaction(async (tx) => {
    const permintaan = await tx.permintaanLayanan.findUnique({ where: { id_permintaan: id } });
    if (!permintaan) {
      throw new PermintaanError(404, 'Permintaan layanan tidak ditemukan.');
    }
    if (STATUS_TERKUNCI.includes(statusSaatIni(permintaan.status))) {
      throw new PermintaanError(
        409,
        'Permintaan yang sudah Selesai atau Ditolak tidak dapat diproses kembali.',
      );
    }

    const sekarang = new Date();

    // Pengaman agar dua Pustakawan tidak menimpa satu sama lain
    const diperbarui = await tx.permintaanLayanan.updateMany({
      where: { id_permintaan: id, ...WHERE_TERBUKA },
      data: { status: input.status, diperbarui_pada: sekarang },
    });
    if (diperbarui.count === 0) {
      throw new PermintaanError(409, 'Permintaan ini baru saja diproses. Muat ulang lalu coba lagi.');
    }

    const tanggapan = await tx.tanggapanPermintaan.create({
      data: {
        id_permintaan: id,
        id_pustakawan: user.id,
        catatan: input.catatan,
        status_hasil: input.status,
        waktu: sekarang,
      },
    });

    let faq = null;
    if (input.faq) {
      faq = await tx.faq.create({
        data: {
          pertanyaan: input.faq.pertanyaan,
          jawaban: input.catatan,
          kata_kunci: input.faq.kata_kunci,
          status_aktif: true,
        },
      });
    }

    return {
      permintaan: { id_permintaan: id, status: input.status },
      tanggapan: formatTanggapan(tanggapan),
      faq_dibuat: faq ? { id_faq: faq.id_faq } : null,
    };
  });
}