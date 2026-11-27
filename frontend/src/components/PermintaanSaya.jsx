import { useEffect, useState } from 'react';
import { getPermintaanSaya } from '../services/permintaanService.js';
import { formatWaktu } from '../utils/formatWaktu.js';
import StatusPermintaan from './StatusPermintaan.jsx';

// Daftar permintaan layanan milik Anggota beserta tanggapan Pustakawan
export default function PermintaanSaya() {
  const [muat, setMuat] = useState({ halaman: 1, versi: 0 });
  const [hasil, setHasil] = useState({ muat: null, data: null, error: '' });
  const memuat = hasil.muat !== muat;

  useEffect(() => {
    let batal = false;
    getPermintaanSaya(muat.halaman)
      .then((data) => {
        if (!batal) setHasil({ muat, data, error: '' });
      })
      .catch((err) => {
        if (!batal) setHasil({ muat, data: null, error: err.message });
      });
    return () => {
      batal = true;
    };
  }, [muat]);

  const keHalaman = (halaman) => setMuat((m) => ({ halaman, versi: m.versi + 1 }));
  const data = memuat ? null : hasil.data;

  return (
    <div className="chatbot-messages">
      <button type="button" className="chatbot-chip" onClick={() => keHalaman(muat.halaman)}>
        Muat ulang
      </button>

      {memuat && <p className="chatbot-note">Memuat permintaan…</p>}
      {!memuat && hasil.error && <p className="chatbot-note chatbot-note-error">{hasil.error}</p>}
      {data && data.permintaan.length === 0 && (
        <p className="chatbot-note">Belum ada permintaan.</p>
      )}

      {data?.permintaan.map((p) => (
        <div key={p.id_permintaan} className="chatbot-bubble bot">
          <StatusPermintaan status={p.status} />
          <p className="chatbot-text">{p.isi_permintaan}</p>
          <span className="chatbot-source">{formatWaktu(p.dibuat_pada)}</span>
          {p.tanggapan.map((t) => (
            <p key={t.id_tanggapan} className="chatbot-text">
              <strong>Pustakawan:</strong> {t.catatan}
            </p>
          ))}
        </div>
      ))}

      {data && data.total_halaman > 1 && (
        <div className="chatbot-tabs">
          <button
            type="button"
            className="chatbot-chip"
            onClick={() => keHalaman(data.halaman - 1)}
            disabled={data.halaman <= 1}
          >
            Sebelumnya
          </button>
          <span className="chatbot-note">
            Halaman {data.halaman} dari {data.total_halaman}
          </span>
          <button
            type="button"
            className="chatbot-chip"
            onClick={() => keHalaman(data.halaman + 1)}
            disabled={data.halaman >= data.total_halaman}
          >
            Berikutnya
          </button>
        </div>
      )}
    </div>
  );
}
