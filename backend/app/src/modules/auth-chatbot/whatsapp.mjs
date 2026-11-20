// Contoh: 6282369502005 -> +62 823-6950-2005
export function formatWhatsAppDisplay(nomor) {
  const d = String(nomor).replace(/\D/g, '');
  if (d.startsWith('62') && d.length >= 11) {
    return `+62 ${d.slice(2, 5)}-${d.slice(5, 9)}-${d.slice(9)}`;
  }
  return `+${d}`;
}

export function buildWhatsAppLink(nomor, teks) {
  const digits = String(nomor).replace(/\D/g, '');
  return {
    nomor: digits,
    tampil: formatWhatsAppDisplay(digits),
    url: `https://wa.me/${digits}?text=${encodeURIComponent(teks)}`,
  };
}