export function formatWaktu(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}

export function ringkasTeks(teks, maks = 90) {
  const t = String(teks ?? '').replace(/\s+/g, ' ').trim();
  return t.length > maks ? `${t.slice(0, maks - 3)}...` : t;
}

// Berapa menit sejak waktu `iso` sampai `sekarang` (milidetik)
export function menitSejak(iso, sekarang) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((sekarang - t) / 60000));
}

// Contoh: "baru saja", "15 menit", "3 jam", "2 hari"
export function lamaMenunggu(iso, sekarang) {
  if (!iso) return '-';
  const menit = menitSejak(iso, sekarang);
  if (menit < 1) return 'baru saja';
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam`;
  return `${Math.floor(jam / 24)} hari`;
}