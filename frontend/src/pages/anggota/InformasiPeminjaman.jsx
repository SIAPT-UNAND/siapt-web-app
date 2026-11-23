import { useCallback, useEffect, useRef, useState } from 'react';
import Modal from '../../components/Modal.jsx';

const MAX_WEBP_BYTES = 100 * 1024; // 100 KB

function formatDateDdMmYyyy(value) {
  if (!value || value === '-') return '-';
  const str = String(value).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
  }
  const d = new Date(str);
  if (Number.isNaN(d.getTime())) return str;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

async function parseApiResponse(response) {
  const text = await response.text();
  if (!text) {
    if (!response.ok) {
      throw new Error(
        'Server API backend (port 5000) tidak merespons. Pastikan server backend sudah berjalan.'
      );
    }
    return { success: false, message: 'Respons server kosong.' };
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      `Respons server tidak valid (HTTP ${response.status}). Pastikan backend berjalan dengan benar.`
    );
  }
}

function getBase64ByteLength(dataUrl) {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx !== -1 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Gagal membaca berkas dari perangkat.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Mengonversi gambar apa pun menjadi format WebP dan mengompresi
 * kualitas serta resolusi secara bertahap hingga ukuran <= 100 KB.
 */
async function convertAndCompressToWebp(file, maxBytes = MAX_WEBP_BYTES) {
  const img = await loadImageFromFile(file);
  const maxInitialDim = 1280;
  let baseWidth = img.naturalWidth || img.width || 800;
  let baseHeight = img.naturalHeight || img.height || 600;

  if (baseWidth > maxInitialDim || baseHeight > maxInitialDim) {
    const ratio = Math.min(maxInitialDim / baseWidth, maxInitialDim / baseHeight);
    baseWidth = Math.max(64, Math.round(baseWidth * ratio));
    baseHeight = Math.max(64, Math.round(baseHeight * ratio));
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Browser tidak mendukung pemrosesan Canvas 2D untuk konversi WebP.');
  }

  const scaleSteps = [1, 0.85, 0.7, 0.55, 0.42, 0.3, 0.2];
  const qualitySteps = [0.85, 0.72, 0.6, 0.48, 0.36, 0.25, 0.15];

  for (const scale of scaleSteps) {
    const targetW = Math.max(64, Math.round(baseWidth * scale));
    const targetH = Math.max(64, Math.round(baseHeight * scale));
    canvas.width = targetW;
    canvas.height = targetH;
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    for (const quality of qualitySteps) {
      const dataUrl = canvas.toDataURL('image/webp', quality);
      if (!dataUrl.startsWith('data:image/webp')) {
        throw new Error('Browser Anda tidak mendukung konversi gambar ke format WebP.');
      }

      const sizeBytes = getBase64ByteLength(dataUrl);
      if (sizeBytes <= maxBytes) {
        return {
          dataUrl,
          sizeBytes,
          width: targetW,
          height: targetH,
          quality,
        };
      }
    }
  }

  throw new Error('Gambar terlalu besar untuk dikompresi di bawah 100 KB. Silakan pilih gambar lain.');
}

export default function InformasiPeminjaman({ currentUser }) {
  const [loanRecords, setLoanRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [loanFilter, setLoanFilter] = useState('SEMUA');

  // State Modal Pembayaran Denda via QRIS
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [qrisUrl, setQrisUrl] = useState('');
  const [qrisError, setQrisError] = useState('');
  const [compressedWebp, setCompressedWebp] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [modalError, setModalError] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [previewBuktiItem, setPreviewBuktiItem] = useState(null);

  const feedbackTimerRef = useRef(null);

  const clearFeedbackTimer = () => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearFeedbackTimer();
  }, []);

  const showTemporaryFeedback = (msg) => {
    clearFeedbackTimer();
    setFeedbackMsg(msg);
    feedbackTimerRef.current = setTimeout(() => {
      setFeedbackMsg('');
    }, 3000);
  };

  const pengenalAnggota = currentUser?.pengenal || '';

  const loadMemberLoans = useCallback(async () => {
    const query = pengenalAnggota
      ? `?status=semua&pengenal_anggota=${encodeURIComponent(pengenalAnggota)}`
      : '?status=semua';
    const response = await fetch(`/api/pengembalian${query}`);
    const payload = await parseApiResponse(response);

    if (!response.ok || !payload.success) {
      throw new Error(payload.message || 'Gagal memuat informasi peminjaman dari database.');
    }

    return Array.isArray(payload.data) ? payload.data : [];
  }, [pengenalAnggota]);

  const handleRefreshLoans = useCallback(async () => {
    setIsLoading(true);
    setFetchError('');
    try {
      const data = await loadMemberLoans();
      setLoanRecords(data);
    } catch (err) {
      setFetchError(err.message || 'Tidak dapat terhubung ke server database.');
    } finally {
      setIsLoading(false);
    }
  }, [loadMemberLoans]);

  useEffect(() => {
    let cancelled = false;
    loadMemberLoans()
      .then((data) => {
        if (!cancelled) {
          setLoanRecords(data);
          setFetchError('');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setFetchError(err.message || 'Tidak dapat terhubung ke server database.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadMemberLoans]);

  const handleOpenPaymentModal = async (loanItem) => {
    if (!loanItem || loanItem.status !== 'SELESAI') {
      return;
    }
    setSelectedLoan(loanItem);
    setCompressedWebp(null);
    setModalError('');
    setQrisError('');
    setQrisUrl('');

    try {
      const response = await fetch('/api/pengembalian/qris');
      const payload = await parseApiResponse(response);
      if (response.ok && payload.success && payload.data?.url) {
        setQrisUrl(payload.data.url);
      } else {
        setQrisError(payload.message || 'Gambar QRIS tidak ditemukan di server.');
      }
    } catch (err) {
      setQrisError(err.message || 'Gagal memuat gambar QRIS.');
    }
  };

  const handleClosePaymentModal = () => {
    if (isUploading) return;
    setSelectedLoan(null);
    setCompressedWebp(null);
    setModalError('');
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setModalError('');
    setCompressedWebp(null);
    setIsCompressing(true);

    try {
      const result = await convertAndCompressToWebp(file, MAX_WEBP_BYTES);
      setCompressedWebp({
        ...result,
        originalName: file.name,
        originalSize: file.size,
      });
    } catch (err) {
      setModalError(err.message || 'Gagal mengonversi gambar ke format WebP.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSubmitPaymentProof = async (e) => {
    e.preventDefault();
    if (!selectedLoan || !compressedWebp) {
      setModalError('Silakan pilih dan unggah gambar bukti pembayaran terlebih dahulu.');
      return;
    }

    setIsUploading(true);
    setModalError('');

    try {
      const nominalTagihan = selectedLoan.sisa_denda ?? selectedLoan.denda;
      const existingPaymentId = selectedLoan.pembayaran_terakhir?.id_pembayaran || null;
      const response = await fetch('/api/pengembalian/pembayaran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_pembayaran: existingPaymentId,
          id_denda: selectedLoan.id_denda,
          id_detail: selectedLoan.id_detail,
          pengenal_anggota: currentUser?.pengenal,
          nominal_bayar: nominalTagihan,
          file_base64: compressedWebp.dataUrl,
        }),
      });
      const payload = await parseApiResponse(response);

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Gagal mengunggah bukti pembayaran denda.');
      }

      const wasReplaced = Boolean(payload.data?.is_updated || existingPaymentId);
      showTemporaryFeedback(
        wasReplaced
          ? 'Bukti pembayaran denda berhasil diperbarui.'
          : 'Bukti pembayaran denda berhasil dikirim.'
      );
      setSelectedLoan(null);
      setCompressedWebp(null);
      await handleRefreshLoans();
    } catch (err) {
      setModalError(err.message || 'Terjadi kesalahan saat mengunggah bukti pembayaran.');
    } finally {
      setIsUploading(false);
    }
  };

  const filteredLoans = loanRecords.filter((loan) => {
    if (loanFilter === 'SEDANG_DIPINJAM') {
      return loan.status === 'SEDANG_DIPINJAM' || loan.status === 'TERLAMBAT';
    }
    if (loanFilter === 'SELESAI') return loan.status === 'SELESAI';
    return true;
  });

  const activeBorrowedCount = loanRecords.filter(
    (l) => l.status === 'SEDANG_DIPINJAM' || l.status === 'TERLAMBAT'
  ).length;
  const overdueCount = loanRecords.filter((l) => l.status === 'TERLAMBAT').length;
  const totalUnpaidDenda = loanRecords
    .filter((l) => l.status_denda === 'BELUM_LUNAS')
    .reduce((acc, curr) => acc + (curr.sisa_denda ?? curr.denda ?? 0), 0);

  return (
    <section className="loan-info-section">
      <div
        className="page-header-row"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 className="page-title">Informasi Peminjaman Saya</h2>
          <p className="page-subtitle">
            Pantau status sirkulasi buku yang sedang Anda pinjam, riwayat pengembalian, dan pembayaran tagihan denda via QRIS
          </p>
        </div>
        <button
          type="button"
          className="btn-outline-sm"
          onClick={handleRefreshLoans}
          disabled={isLoading}
        >
          {isLoading ? 'Memuat...' : 'Muat Ulang'}
        </button>
      </div>

      {feedbackMsg && (
        <div className="toast-floating-wrapper" role="status" aria-live="polite">
          <div className="toast-floating-card toast-floating-success">
            <span className="toast-floating-icon" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
            <span className="toast-floating-msg">{feedbackMsg}</span>
          </div>
        </div>
      )}

      {/* Quick Metrics */}
      <div className="metrics-row">
        <div className="metric-box">
          <div className="metric-box-top">
            <span className="metric-label">Buku Sedang Dipinjam</span>
            <span className="metric-icon-badge metric-icon-green" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </span>
          </div>
          <strong className="metric-value">{activeBorrowedCount}</strong>
          <span className="metric-sub">Eksemplar aktif dalam peminjaman</span>
        </div>

        <div className="metric-box">
          <div className="metric-box-top">
            <span className="metric-label">Buku Terlambat</span>
            <span className="metric-icon-badge metric-icon-red" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
          </div>
          <strong className="metric-value text-red">{overdueCount}</strong>
          <span className="metric-sub">Melewati batas tanggal jatuh tempo</span>
        </div>

        <div className="metric-box">
          <div className="metric-box-top">
            <span className="metric-label">Total Denda Belum Lunas</span>
            <span className="metric-icon-badge metric-icon-amber" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </span>
          </div>
          <strong className="metric-value text-red">
            Rp {totalUnpaidDenda.toLocaleString('id-ID')}
          </strong>
          <span className="metric-sub">Dapat dibayarkan secara online via QRIS</span>
        </div>
      </div>

      {/* Filter Tab */}
      <div className="tab-filters">
        <button
          type="button"
          className={`tab-btn ${loanFilter === 'SEMUA' ? 'active' : ''}`}
          onClick={() => setLoanFilter('SEMUA')}
        >
          Semua Riwayat ({loanRecords.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${loanFilter === 'SEDANG_DIPINJAM' ? 'active' : ''}`}
          onClick={() => setLoanFilter('SEDANG_DIPINJAM')}
        >
          Sedang Dipinjam ({activeBorrowedCount})
        </button>
        <button
          type="button"
          className={`tab-btn ${loanFilter === 'SELESAI' ? 'active' : ''}`}
          onClick={() => setLoanFilter('SELESAI')}
        >
          Sudah Dikembalikan ({loanRecords.filter((l) => l.status === 'SELESAI').length})
        </button>
      </div>

      {/* List Kartu Peminjaman */}
      <div className="loan-cards-list">
        {fetchError ? (
          <div className="empty-state-card">
            <p className="text-red">{fetchError}</p>
            <button type="button" className="btn-outline-sm" onClick={handleRefreshLoans}>
              Coba Lagi
            </button>
          </div>
        ) : isLoading ? (
          <div className="empty-state-card">
            <p>Memuat data peminjaman dan denda dari database...</p>
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="empty-state-card">
            <p>Tidak ada data peminjaman pada filter ini.</p>
          </div>
        ) : (
          filteredLoans.map((item) => {
            const isOverdue = item.status === 'TERLAMBAT';
            const isReturned = item.status === 'SELESAI';
            const latestPayment = item.pembayaran_terakhir;
            const normalizedPaymentStatus = String(latestPayment?.status || '').replace(
              /_/g,
              ' '
            );
            const isPendingVerification =
              normalizedPaymentStatus === 'MENUNGGU VERIFIKASI' &&
              item.status_denda === 'BELUM_LUNAS';
            const isPaymentRejected =
              normalizedPaymentStatus === 'DITOLAK' && item.status_denda === 'BELUM_LUNAS';

            const cardStateClass = isReturned
              ? 'card-returned'
              : isOverdue
              ? 'card-overdue'
              : 'card-active';

            const dendaBadgeClass =
              item.status_denda === 'BELUM_LUNAS'
                ? isPendingVerification
                  ? 'pending'
                  : 'unpaid'
                : item.status_denda === 'LUNAS'
                ? 'paid'
                : 'none';

            return (
              <div key={item.id_detail} className={`loan-record-card ${cardStateClass}`}>
                <div className="loan-card-main">
                  <div className="loan-card-info">
                    <div className="loan-badge-line">
                      <span className="loan-trx-num">{item.nomor_transaksi}</span>
                      <span
                        className={`status-pill ${
                          isReturned
                            ? 'status-returned'
                            : isOverdue
                            ? 'status-danger'
                            : 'status-active'
                        }`}
                      >
                        {isReturned ? 'Dikembalikan' : isOverdue ? 'Terlambat' : 'Aktif'}
                      </span>
                    </div>

                    <h4 className="loan-book-title">{item.judul}</h4>

                    <div className="loan-meta-grid">
                      <div className="loan-meta-item">
                        <span className="lbl">Kode Eksemplar</span>
                        <strong className="val">{item.kode_eksemplar}</strong>
                      </div>
                      <div className="loan-meta-item">
                        <span className="lbl">Tanggal Pinjam</span>
                        <span className="val">{formatDateDdMmYyyy(item.tanggal_pinjam)}</span>
                      </div>
                      <div className="loan-meta-item">
                        <span className="lbl">Jatuh Tempo</span>
                        <span className={`val ${isOverdue ? 'text-red font-bold' : ''}`}>
                          {formatDateDdMmYyyy(item.tanggal_jatuh_tempo)}
                        </span>
                      </div>
                      {item.tanggal_kembali && (
                        <div className="loan-meta-item">
                          <span className="lbl">Tanggal Kembali</span>
                          <span className="val">{formatDateDdMmYyyy(item.tanggal_kembali)}</span>
                        </div>
                      )}
                    </div>

                    {item.riwayat_koreksi?.length > 0 && (
                      <div className="loan-note-banner loan-note-correction">
                        <strong>Koreksi Pustakawan:</strong> Rp{' '}
                        {item.riwayat_koreksi[0].nominal_lama.toLocaleString('id-ID')} &rarr; Rp{' '}
                        {item.riwayat_koreksi[0].nominal_baru.toLocaleString('id-ID')} (
                        {item.riwayat_koreksi[0].alasan})
                      </div>
                    )}

                    {isPaymentRejected && latestPayment.alasan_penolakan && (
                      <div className="loan-note-banner loan-note-rejected">
                        <strong>Bukti pembayaran ditolak:</strong> {latestPayment.alasan_penolakan}
                      </div>
                    )}
                  </div>
                </div>

                <div className="loan-card-side">
                  <div className="denda-box">
                    <span className="denda-lbl">
                      Denda Keterlambatan
                      {item.hari_terlambat > 0 ? ` (${item.hari_terlambat} hari)` : ''}
                    </span>
                    <strong className={`denda-val ${item.denda > 0 && item.status_denda === 'BELUM_LUNAS' ? 'text-red' : ''}`}>
                      Rp {item.denda.toLocaleString('id-ID')}
                    </strong>
                    <span className={`denda-status ${dendaBadgeClass}`}>
                      {item.status_denda === 'BELUM_LUNAS'
                        ? isPendingVerification
                          ? 'Menunggu Verifikasi Pustakawan'
                          : isPaymentRejected
                          ? 'Bukti Ditolak - BELUM LUNAS'
                          : 'BELUM LUNAS'
                        : item.status_denda === 'LUNAS'
                        ? 'LUNAS'
                        : 'Tidak Ada Denda'}
                    </span>
                  </div>

                  {item.status_denda === 'BELUM_LUNAS' && item.denda > 0 && (
                    isReturned ? (
                      <button
                        type="button"
                        className="btn-pay-denda"
                        onClick={() => handleOpenPaymentModal(item)}
                      >
                        {isPendingVerification
                          ? 'Ganti Bukti Bayar'
                          : isPaymentRejected
                          ? 'Upload Ulang Bukti'
                          : 'Bayar Denda (QRIS)'}
                      </button>
                    ) : (
                      <span className="denda-return-hint">
                        Kembalikan buku untuk membayar denda
                      </span>
                    )
                  )}

                  {item.status_denda === 'LUNAS' && latestPayment?.path_bukti && (
                    <button
                      type="button"
                      className="btn-outline-sm"
                      onClick={() => setPreviewBuktiItem(item)}
                    >
                      Lihat Bukti
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Pembayaran Denda QRIS & Upload/Ganti Bukti WebP */}
      <Modal
        isOpen={Boolean(selectedLoan)}
        size="lg"
        title={
          selectedLoan?.pembayaran_terakhir?.path_bukti
            ? 'Ganti Bukti Pembayaran Denda via QRIS'
            : 'Pembayaran Denda via QRIS'
        }
        onClose={handleClosePaymentModal}
      >
        {selectedLoan && (
          <form onSubmit={handleSubmitPaymentProof} className="modal-form">
            {modalError && <div className="alert-error">{modalError}</div>}

            <div className="payment-summary-card">
              <div className="payment-summary-top">
                <div className="payment-summary-book">{selectedLoan.judul}</div>
                <span className="loan-trx-num">{selectedLoan.nomor_transaksi}</span>
              </div>
              <div className="payment-summary-grid">
                <div className="payment-summary-item">
                  <span className="lbl">Kode Eksemplar</span>
                  <span className="val">{selectedLoan.kode_eksemplar}</span>
                </div>
                <div className="payment-summary-item">
                  <span className="lbl">Jatuh Tempo</span>
                  <span className="val">{formatDateDdMmYyyy(selectedLoan.tanggal_jatuh_tempo)}</span>
                </div>
                <div className="payment-summary-item">
                  <span className="lbl">Keterlambatan</span>
                  <span className="val">{selectedLoan.hari_terlambat} hari</span>
                </div>
                <div className="payment-summary-item">
                  <span className="lbl">Total Tagihan Denda</span>
                  <span className="val text-red">
                    Rp {(selectedLoan.sisa_denda ?? selectedLoan.denda).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </div>

            {/* Grid Responsif (Mobile-First): QRIS, Bukti Sebelumnya, & Pratinjau Bukti Baru */}
            <div
              className={`payment-modal-media-grid ${
                selectedLoan.pembayaran_terakhir?.path_bukti && compressedWebp
                  ? 'cols-3'
                  : selectedLoan.pembayaran_terakhir?.path_bukti || compressedWebp
                  ? 'cols-2'
                  : ''
              }`}
            >
              {/* 1. Tampilan Gambar QRIS dari public/qris */}
              <div className="payment-media-box">
                <div className="payment-media-header">
                  <span className="payment-media-title">Scan QRIS Perpustakaan UNAND</span>
                </div>
                <div className="payment-media-frame">
                  {qrisUrl ? (
                    <img
                      src={qrisUrl}
                      alt="QRIS Pembayaran Denda Perpustakaan"
                      className="payment-media-img"
                    />
                  ) : qrisError ? (
                    <p className="text-red" style={{ fontSize: '0.8rem', margin: 0 }}>
                      {qrisError}
                    </p>
                  ) : (
                    <p style={{ fontSize: '0.8rem', margin: 0 }}>Memuat kode QRIS...</p>
                  )}
                </div>
                <div className="payment-media-caption">
                  Pindai kode QRIS di atas sesuai nominal tagihan denda.
                </div>
              </div>

              {/* 2. Tampilan Bukti Pembayaran Sebelumnya (Jika Ganti Bukti) */}
              {selectedLoan.pembayaran_terakhir?.path_bukti && (
                <div className="payment-media-box previous-proof-box">
                  <div className="payment-media-header">
                    <span className="payment-media-title" style={{ color: '#92400e' }}>
                      Bukti Pembayaran Sebelumnya
                    </span>
                    <span
                      className={`status-pill ${
                        selectedLoan.pembayaran_terakhir.status === 'DITOLAK'
                          ? 'status-danger'
                          : 'status-done'
                      }`}
                    >
                      {String(selectedLoan.pembayaran_terakhir.status || '').replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="payment-media-frame">
                    <img
                      src={`${selectedLoan.pembayaran_terakhir.path_bukti}?t=${encodeURIComponent(
                        selectedLoan.pembayaran_terakhir.waktu_unggah || ''
                      )}`}
                      alt="Bukti Pembayaran Sebelumnya"
                      className="payment-media-img"
                    />
                  </div>
                  <div className="payment-media-caption" style={{ color: '#78350f' }}>
                    {selectedLoan.pembayaran_terakhir.alasan_penolakan ? (
                      <div className="text-red" style={{ fontWeight: 700 }}>
                        Ditolak: {selectedLoan.pembayaran_terakhir.alasan_penolakan}
                      </div>
                    ) : (
                      <span>Gambar ini akan dihapus otomatis saat bukti baru disimpan.</span>
                    )}
                  </div>
                </div>
              )}

              {/* 3. Pratinjau Bukti Pembayaran Baru (Muncul di Grid Saat Gambar Dipilih) */}
              {compressedWebp && (
                <div className="payment-media-box new-proof-box">
                  <div className="payment-media-header">
                    <span className="payment-media-title" style={{ color: '#065f46' }}>
                      Pratinjau Bukti Baru
                    </span>
                    <span className="status-pill status-active">Siap Diunggah</span>
                  </div>
                  <div className="payment-media-frame">
                    <img
                      src={compressedWebp.dataUrl}
                      alt="Pratinjau Bukti Pembayaran WebP"
                      className="payment-media-img"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="payment-upload-box">
              <label className="form-label" htmlFor="bukti-denda-file">
                {selectedLoan.pembayaran_terakhir?.path_bukti
                  ? 'Unggah Gambar Bukti Pembayaran Baru (Pengganti Bukti Lama):'
                  : 'Unggah Gambar Bukti Pembayaran:'}
              </label>
              <input
                id="bukti-denda-file"
                type="file"
                accept="image/*"
                className="form-control"
                onChange={handleFileChange}
                disabled={isCompressing || isUploading}
                required
              />
              <span className="form-hint">
                {isCompressing
                  ? 'Sedang mengonversi dan mengompresi gambar ke WebP (<= 100 KB)...'
                  : 'Gambar otomatis dikonversi ke format .webp dan dikompresi maksimal 100 KB.'}
              </span>
            </div>

            <div className="modal-actions-row" style={{ marginTop: '4px' }}>
              <button
                type="button"
                className="btn-outline-sm"
                onClick={handleClosePaymentModal}
                disabled={isUploading}
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={isCompressing || isUploading || !compressedWebp}
              >
                {isUploading
                  ? 'Mengunggah...'
                  : selectedLoan.pembayaran_terakhir?.path_bukti
                  ? 'Ganti & Simpan Bukti Baru'
                  : 'Kirim Bukti Pembayaran'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Pratinjau Bukti Pembayaran Denda yang Sudah Lunas */}
      <Modal
        isOpen={Boolean(previewBuktiItem)}
        size="lg"
        title="Bukti Pembayaran Denda Terverifikasi"
        onClose={() => setPreviewBuktiItem(null)}
      >
        {previewBuktiItem?.pembayaran_terakhir && (
          <div className="modal-form">
            <div className="payment-summary-card">
              <div className="payment-summary-top">
                <div className="payment-summary-book">{previewBuktiItem.judul}</div>
                <span className="loan-trx-num">{previewBuktiItem.nomor_transaksi}</span>
              </div>
              <div className="payment-summary-grid">
                <div className="payment-summary-item">
                  <span className="lbl">Kode Eksemplar</span>
                  <span className="val">{previewBuktiItem.kode_eksemplar}</span>
                </div>
                <div className="payment-summary-item">
                  <span className="lbl">Nominal Dibayar</span>
                  <span className="val text-green">
                    Rp{' '}
                    {previewBuktiItem.pembayaran_terakhir.nominal_bayar.toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="payment-summary-item">
                  <span className="lbl">Status Verifikasi</span>
                  <span className="val">
                    {String(previewBuktiItem.pembayaran_terakhir.status || '')
                      .trim()
                      .toUpperCase()
                      .replace(/_/g, ' ') === 'TERVERIFIKASI'
                      ? 'LUNAS'
                      : String(previewBuktiItem.pembayaran_terakhir.status || '').replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="payment-summary-item">
                  <span className="lbl">Format Berkas</span>
                  <span className="val">
                    {previewBuktiItem.pembayaran_terakhir.tipe_berkas}
                  </span>
                </div>
              </div>
            </div>

            <div className="payment-media-box">
              <div className="payment-media-frame" style={{ height: '280px' }}>
                <img
                  src={`${previewBuktiItem.pembayaran_terakhir.path_bukti}?t=${encodeURIComponent(
                    previewBuktiItem.pembayaran_terakhir.waktu_unggah || ''
                  )}`}
                  alt="Bukti Pembayaran Denda"
                  className="payment-media-img"
                />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
