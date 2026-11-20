import { useEffect, useState } from 'react';
import Modal from '../../components/Modal.jsx';
import StatusPermintaan from '../../components/StatusPermintaan.jsx';
import {
  getDaftarPermintaan,
  getDetailPermintaan,
  tanggapiPermintaan,
} from '../../services/permintaanService.js';
import { formatWaktu, lamaMenunggu, menitSejak, ringkasTeks } from '../../utils/formatWaktu.js';
import '../../components/permintaan.css';

const TAB_STATUS = ['Semua', 'Baru', 'Diproses', 'Selesai', 'Ditolak'];
const PILIHAN_STATUS = ['Diproses', 'Selesai', 'Ditolak'];
const STATUS_TERBUKA = ['Baru', 'Diproses'];
const STATUS_TERKUNCI = ['Selesai', 'Ditolak'];
const MENIT_SEHARI = 24 * 60;

const DATA_AWAL = {
  permintaan: [],
  ringkasan: { Baru: 0, Diproses: 0, Selesai: 0, Ditolak: 0 },
  dimuatPada: 0,
};

export default function PermintaanLayanan() {
  const [filter, setFilter] = useState('Semua');
  const [versi, setVersi] = useState(0);
  const [data, setData] = useState(DATA_AWAL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [idDetail, setIdDetail] = useState(null);
  const [detailState, setDetailState] = useState({ id: null, data: null, error: '' });
  const [form, setForm] = useState(null);

  const detail = idDetail !== null && detailState.id === idDetail ? detailState.data : null;
  const galatDetail = idDetail !== null && detailState.id === idDetail ? detailState.error : '';
  const memuatDetail = idDetail !== null && detailState.id !== idDetail;

  // Muat antrian permintaan
  useEffect(() => {
    let batal = false;
    getDaftarPermintaan(filter)
      .then((hasil) => {
        if (batal) return;
        setData({ ...hasil, dimuatPada: Date.now() });
        setError('');
      })
      .catch((err) => {
        if (!batal) setError(err.message);
      })
      .finally(() => {
        if (!batal) setLoading(false);
      });
    return () => {
      batal = true;
    };
  }, [filter, versi]);

  // Muat detail saat modal dibuka
  useEffect(() => {
    if (idDetail === null) return undefined;
    let batal = false;

    getDetailPermintaan(idDetail)
      .then((hasil) => {
        if (batal) return;
        const p = hasil.permintaan;
        setDetailState({ id: idDetail, data: p, error: '' });
        setForm({
          catatan: '',
          status: 'Diproses',
          tambahFaq: false,
          faqPertanyaan: p.chatbot.pertanyaan || p.isi_permintaan,
          faqKataKunci: '',
          error: '',
          sending: false,
        });
      })
      .catch((err) => {
        if (!batal) setDetailState({ id: idDetail, data: null, error: err.message });
      });

    return () => {
      batal = true;
    };
  }, [idDetail]);

  function ubahFilter(status) {
    setFilter(status);
    setLoading(true);
    setSuccess('');
  }

  function muatUlang() {
    setLoading(true);
    setVersi((v) => v + 1);
  }

  function bukaDetail(id) {
    setSuccess('');
    setIdDetail(id);
  }

  function tutupDetail() {
    setIdDetail(null);
    setDetailState({ id: null, data: null, error: '' });
    setForm(null);
  }

  // Tanyakan dulu jika tanggapan sudah diketik tapi belum disimpan
  function mintaTutup() {
    if (
      form &&
      form.catatan.trim() &&
      !window.confirm('Tanggapan belum disimpan. Tutup tanpa menyimpan?')
    ) {
      return;
    }
    tutupDetail();
  }

  function ubahForm(perubahan) {
    setForm((f) => ({ ...f, ...perubahan }));
  }

  async function kirimTanggapan(event) {
    event.preventDefault();
    if (!form || form.sending || !detail) return;

    setForm((f) => ({ ...f, sending: true, error: '' }));

    const payload = { catatan: form.catatan, status: form.status };
    if (form.status === 'Selesai' && form.tambahFaq) {
      payload.faq = { pertanyaan: form.faqPertanyaan, kata_kunci: form.faqKataKunci };
    }

    try {
      const hasil = await tanggapiPermintaan(detail.id_permintaan, payload);
      setSuccess(
        hasil.faq_dibuat
          ? 'Tanggapan tersimpan dan jawabannya ditambahkan ke FAQ chatbot.'
          : 'Tanggapan tersimpan.',
      );
      tutupDetail();
      setLoading(true);
      setVersi((v) => v + 1);
    } catch (err) {
      setForm((f) => ({ ...f, sending: false, error: err.message }));
    }
  }

  const totalSemua = Object.values(data.ringkasan).reduce((a, b) => a + b, 0);
  const terkunci = detail ? STATUS_TERKUNCI.includes(detail.status) : false;

  return (
    <section className="permintaan-section">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Permintaan Layanan</h2>
          <p className="page-subtitle">
            Antrian pertanyaan Anggota yang tidak terjawab chatbot. Yang paling lama menunggu ada di
            paling atas. Tanggapanmu langsung terlihat oleh Anggota.
          </p>
        </div>
        <button type="button" className="btn-outline-sm" onClick={muatUlang} disabled={loading}>
          Muat ulang
        </button>
      </div>

      {success && <div className="alert-success">{success}</div>}
      {error && <div className="alert-error">{error}</div>}

      <div className="tab-filters">
        {TAB_STATUS.map((s) => (
          <button
            key={s}
            type="button"
            className={`tab-btn ${filter === s ? 'active' : ''}`}
            onClick={() => ubahFilter(s)}
          >
            {s} ({s === 'Semua' ? totalSemua : data.ringkasan[s]})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="page-subtitle">Memuat permintaan...</p>
      ) : data.permintaan.length === 0 ? (
        <div className="empty-state-card">
          <p>Tidak ada permintaan layanan untuk filter ini.</p>
        </div>
      ) : (
        <div className="table-responsive-wrapper">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Masuk</th>
                <th>Menunggu</th>
                <th>Anggota</th>
                <th>Isi Permintaan</th>
                <th>Status</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {data.permintaan.map((p) => {
                const terbuka = STATUS_TERBUKA.includes(p.status);
                const lama = terbuka && menitSejak(p.dibuat_pada, data.dimuatPada) >= MENIT_SEHARI;
                return (
                  <tr key={p.id_permintaan}>
                    <td>{formatWaktu(p.dibuat_pada)}</td>
                    <td>
                      <span className={lama ? 'permintaan-lama' : undefined}>
                        {terbuka ? lamaMenunggu(p.dibuat_pada, data.dimuatPada) : '-'}
                      </span>
                    </td>
                    <td>
                      <div className="table-title-cell">
                        <strong>{p.anggota.nama}</strong>
                        <span className="table-sub-text">{p.anggota.pengenal}</span>
                      </div>
                    </td>
                    <td className="permintaan-isi-cell">{ringkasTeks(p.isi_permintaan, 110)}</td>
                    <td>
                      <StatusPermintaan status={p.status} />
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn-action-primary-sm"
                        onClick={() => bukaDetail(p.id_permintaan)}
                      >
                        {terbuka ? 'Tanggapi' : 'Lihat'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        isOpen={idDetail !== null}
        title={`Permintaan Layanan #${idDetail ?? ''}`}
        onClose={mintaTutup}
      >
        {memuatDetail && <p className="page-subtitle">Memuat detail...</p>}
        {galatDetail && <div className="alert-error">{galatDetail}</div>}

        {detail && (
          <div className="permintaan-detail">
            <div className="permintaan-meta-row">
              <StatusPermintaan status={detail.status} />
              <span>
                Dari <strong>{detail.anggota.nama}</strong> ({detail.anggota.pengenal})
              </span>
              <span>{formatWaktu(detail.dibuat_pada)}</span>
            </div>

            <div className="permintaan-box">
              <h4>Isi permintaan</h4>
              <p>{detail.isi_permintaan}</p>
            </div>

            <div className="permintaan-box">
              <h4>Percakapan chatbot sebelumnya</h4>
              <p>
                <strong>Anggota:</strong> {detail.chatbot.pertanyaan}
              </p>
              <p style={{ marginTop: 6 }}>
                <strong>Chatbot:</strong> {detail.chatbot.jawaban}
              </p>
            </div>

            {detail.tanggapan.length > 0 && (
              <div className="permintaan-thread">
                {detail.tanggapan.map((t) => (
                  <div key={t.id_tanggapan} className="permintaan-reply">
                    <div className="permintaan-reply-meta">
                      <strong>{t.pustakawan || 'Pustakawan'}</strong>
                      <StatusPermintaan status={t.status_hasil} />
                      <span>{formatWaktu(t.waktu)}</span>
                    </div>
                    <p className="permintaan-reply-text">{t.catatan}</p>
                  </div>
                ))}
              </div>
            )}

            {terkunci && (
              <p className="permintaan-locked">
                Permintaan ini sudah {detail.status} dan terkunci, tidak dapat diproses kembali.
              </p>
            )}

            {!terkunci && form && (
              <form className="permintaan-form" onSubmit={kirimTanggapan}>
                {form.error && <div className="alert-error">{form.error}</div>}

                <div className="form-group">
                  <label className="form-label" htmlFor="status-tanggapan">
                    Status
                  </label>
                  <select
                    id="status-tanggapan"
                    className="form-control"
                    value={form.status}
                    onChange={(e) => ubahForm({ status: e.target.value })}
                    disabled={form.sending}
                  >
                    {PILIHAN_STATUS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="catatan-tanggapan">
                    {form.status === 'Ditolak' ? 'Alasan penolakan (wajib)' : 'Tanggapan untuk Anggota'}
                  </label>
                  <textarea
                    id="catatan-tanggapan"
                    className="form-control permintaan-textarea"
                    maxLength={2000}
                    value={form.catatan}
                    onChange={(e) => ubahForm({ catatan: e.target.value })}
                    disabled={form.sending}
                  />
                  <span className="form-hint">{form.catatan.length}/2000</span>
                </div>

                {form.status === 'Selesai' && (
                  <div className="permintaan-faq-box">
                    <label className="permintaan-check">
                      <input
                        type="checkbox"
                        checked={form.tambahFaq}
                        onChange={(e) => ubahForm({ tambahFaq: e.target.checked })}
                        disabled={form.sending}
                      />
                      <span>Tambahkan ke FAQ chatbot, supaya pertanyaan serupa dijawab otomatis</span>
                    </label>

                    {form.tambahFaq && (
                      <>
                        <p className="form-hint">
                          Isi tanggapan di atas akan menjadi jawaban FAQ yang bisa dilihat semua Anggota.
                          Pastikan pertanyaan dan jawabannya tidak memuat data pribadi, dan hindari kata
                          kunci yang terlalu umum.
                        </p>
                        <div className="form-group">
                          <label className="form-label" htmlFor="faq-pertanyaan">
                            Pertanyaan FAQ
                          </label>
                          <input
                            id="faq-pertanyaan"
                            className="form-control"
                            type="text"
                            maxLength={500}
                            value={form.faqPertanyaan}
                            onChange={(e) => ubahForm({ faqPertanyaan: e.target.value })}
                            disabled={form.sending}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label" htmlFor="faq-kata-kunci">
                            Kata kunci (pisahkan dengan koma)
                          </label>
                          <input
                            id="faq-kata-kunci"
                            className="form-control"
                            type="text"
                            maxLength={255}
                            placeholder="contoh: jam buka, buka, tutup"
                            value={form.faqKataKunci}
                            onChange={(e) => ubahForm({ faqKataKunci: e.target.value })}
                            disabled={form.sending}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="modal-actions-row">
                  <button
                    type="button"
                    className="btn-outline-sm"
                    onClick={mintaTutup}
                    disabled={form.sending}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={form.sending || !form.catatan.trim()}
                  >
                    {form.sending ? 'Menyimpan...' : 'Simpan tanggapan'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}