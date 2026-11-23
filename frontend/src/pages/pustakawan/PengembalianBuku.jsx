import { useCallback, useEffect, useRef, useState } from 'react';
import Modal from '../../components/Modal.jsx';

const ITEMS_PER_PAGE = 20;

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

function formatDateTimeDdMmYyyy(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return formatDateDdMmYyyy(value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

function formatPaymentStatusLabel(status) {
  const clean = String(status || 'MENUNGGU VERIFIKASI')
    .trim()
    .toUpperCase()
    .replace(/_/g, ' ');
  if (clean === 'TERVERIFIKASI') return 'LUNAS';
  return clean;
}

function sortRecordsNewestFirst(list) {
  return [...list].sort((a, b) => {
    const dateA = a.tanggal_pinjam || '';
    const dateB = b.tanggal_pinjam || '';
    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }
    const idPinjamDiff = (b.id_peminjaman || 0) - (a.id_peminjaman || 0);
    if (idPinjamDiff !== 0) return idPinjamDiff;
    return (b.id_detail || 0) - (a.id_detail || 0);
  });
}

function sortPaymentsNewestFirst(list) {
  return [...list].sort((a, b) => {
    const timeA = a.waktu_unggah || '';
    const timeB = b.waktu_unggah || '';
    if (timeA !== timeB) {
      return timeB.localeCompare(timeA);
    }
    return (b.id_pembayaran || 0) - (a.id_pembayaran || 0);
  });
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

export default function PengembalianBuku({ currentUser }) {
  const [allRecords, setAllRecords] = useState([]);
  const [payments, setPayments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [activeTab, setActiveTab] = useState('AKTIF');
  const [searchQuery, setSearchQuery] = useState('');
  const [dendaStatusFilter, setDendaStatusFilter] = useState('SEMUA');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('SEMUA');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('SEMUA');
  const [currentPage, setCurrentPage] = useState(1);

  // Form Verifikasi Pengembalian
  const [returnCode, setReturnCode] = useState('');
  const [returnFeedback, setReturnFeedback] = useState('');
  const [actionError, setActionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [processingDetailId, setProcessingDetailId] = useState(null);
  const [isSyncingDenda, setIsSyncingDenda] = useState(false);

  // Modal Koreksi Denda
  const [koreksiTarget, setKoreksiTarget] = useState(null);
  const [nominalBaruInput, setNominalBaruInput] = useState('');
  const [alasanKoreksiInput, setAlasanKoreksiInput] = useState('');
  const [isSavingKoreksi, setIsSavingKoreksi] = useState(false);
  const [koreksiError, setKoreksiError] = useState('');

  // Modal Lihat & Verifikasi Bukti Pembayaran Denda
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [alasanPenolakanInput, setAlasanPenolakanInput] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [verifikasiError, setVerifikasiError] = useState('');

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

  const showSuccessFeedback = (msg) => {
    clearFeedbackTimer();
    setActionError('');
    setReturnFeedback(msg);
    feedbackTimerRef.current = setTimeout(() => setReturnFeedback(''), 3000);
  };

  const showErrorFeedback = (msg) => {
    clearFeedbackTimer();
    setReturnFeedback('');
    setActionError(msg);
    feedbackTimerRef.current = setTimeout(() => setActionError(''), 3000);
  };

  const loadAllData = useCallback(async () => {
    const [returnsRes, paymentsRes] = await Promise.all([
      fetch('/api/pengembalian?status=semua'),
      fetch('/api/pengembalian/pembayaran'),
    ]);

    const returnsPayload = await parseApiResponse(returnsRes);
    if (!returnsRes.ok || !returnsPayload.success) {
      throw new Error(
        returnsPayload.message || 'Gagal memuat daftar pengembalian dari database.'
      );
    }

    let paymentsData = [];
    if (paymentsRes) {
      const paymentsPayload = await parseApiResponse(paymentsRes);
      if (paymentsRes.ok && paymentsPayload.success && Array.isArray(paymentsPayload.data)) {
        paymentsData = paymentsPayload.data;
      }
    }

    return {
      records: Array.isArray(returnsPayload.data) ? returnsPayload.data : [],
      payments: paymentsData,
    };
  }, []);

  const fetchAllData = useCallback(async () => {
    setIsLoading(true);
    setFetchError('');
    try {
      const { records, payments: paymentList } = await loadAllData();
      setAllRecords(records);
      setPayments(paymentList);
    } catch (err) {
      setFetchError(err.message || 'Tidak dapat terhubung ke server database.');
    } finally {
      setIsLoading(false);
    }
  }, [loadAllData]);

  useEffect(() => {
    let cancelled = false;
    loadAllData()
      .then(({ records, payments: paymentList }) => {
        if (!cancelled) {
          setAllRecords(records);
          setPayments(paymentList);
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
  }, [loadAllData]);

  const handleManualSyncDenda = async () => {
    setIsSyncingDenda(true);
    setActionError('');
    try {
      const response = await fetch('/api/pengembalian/sync-denda', {
        method: 'POST',
      });
      const payload = await parseApiResponse(response);
      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Gagal menyinkronkan denda harian.');
      }

      await fetchAllData();
      showSuccessFeedback(
        `Denda harian disinkronkan (${payload.data?.updated_count ?? 0} diperbarui).`
      );
    } catch (err) {
      showErrorFeedback(err.message || 'Gagal menyinkronkan denda harian.');
    } finally {
      setIsSyncingDenda(false);
    }
  };

  const submitReturn = async (body, detailId = null) => {
    clearFeedbackTimer();
    setActionError('');
    setReturnFeedback('');
    setIsSubmitting(true);
    setProcessingDetailId(detailId);

    try {
      const response = await fetch('/api/pengembalian/proses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...body,
          ...(currentUser?.pengenal ? { pengenal_pustakawan: currentUser.pengenal } : {}),
        }),
      });
      const payload = await parseApiResponse(response);

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Gagal memproses pengembalian buku.');
      }

      const returnedItem = payload.data?.item;
      setAllRecords((prev) => {
        const exists = prev.some((item) => item.id_detail === returnedItem?.id_detail);
        if (!exists) return prev;
        return prev.map((item) =>
          item.id_detail === returnedItem.id_detail ? returnedItem : item
        );
      });

      const dendaNote =
        returnedItem?.denda > 0
          ? ` (Denda: Rp ${returnedItem.denda.toLocaleString('id-ID')})`
          : '';
      showSuccessFeedback(
        `Buku "${returnedItem?.judul}" berhasil dikembalikan${dendaNote}.`
      );
      return true;
    } catch (err) {
      showErrorFeedback(err.message || 'Terjadi kesalahan saat memproses pengembalian.');
      return false;
    } finally {
      setIsSubmitting(false);
      setProcessingDetailId(null);
    }
  };

  const handleProcessReturn = async (e) => {
    e.preventDefault();
    const trimmedCode = returnCode.trim();
    if (!trimmedCode) return;

    const ok = await submitReturn({ kode: trimmedCode });
    if (ok) {
      setReturnCode('');
    }
  };

  const handleRowReturn = (item) => {
    submitReturn({ id_detail: item.id_detail }, item.id_detail);
  };

  // Handlers Koreksi Denda
  const handleOpenKoreksiModal = (item) => {
    setKoreksiTarget(item);
    setNominalBaruInput(String(item.denda ?? 0));
    setAlasanKoreksiInput('');
    setKoreksiError('');
  };

  const handleCloseKoreksiModal = () => {
    if (isSavingKoreksi) return;
    setKoreksiTarget(null);
    setKoreksiError('');
  };

  const handleSubmitKoreksi = async (e) => {
    e.preventDefault();
    if (!koreksiTarget) return;

    const parsedNominal = Number(nominalBaruInput);
    if (!Number.isFinite(parsedNominal) || parsedNominal < 0) {
      setKoreksiError('Nominal denda baru harus berupa angka minimal 0.');
      return;
    }
    if (!alasanKoreksiInput.trim()) {
      setKoreksiError('Alasan koreksi denda wajib diisi.');
      return;
    }

    setIsSavingKoreksi(true);
    setKoreksiError('');

    try {
      const response = await fetch('/api/pengembalian/denda/koreksi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_denda: koreksiTarget.id_denda,
          id_detail: koreksiTarget.id_detail,
          nominal_baru: parsedNominal,
          alasan: alasanKoreksiInput.trim(),
          pengenal_pustakawan: currentUser?.pengenal,
        }),
      });
      const payload = await parseApiResponse(response);

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Gagal menyimpan koreksi denda.');
      }

      const updatedItem = payload.data?.item;
      if (updatedItem) {
        setAllRecords((prev) =>
          prev.map((item) => (item.id_detail === updatedItem.id_detail ? updatedItem : item))
        );
      } else {
        await fetchAllData();
      }

      setKoreksiTarget(null);
      showSuccessFeedback(
        `Denda dikoreksi menjadi Rp ${parsedNominal.toLocaleString('id-ID')}.`
      );
    } catch (err) {
      setKoreksiError(err.message || 'Terjadi kesalahan saat menyimpan koreksi denda.');
    } finally {
      setIsSavingKoreksi(false);
    }
  };

  // Handlers Verifikasi Pembayaran Denda
  const handleOpenPaymentModal = (payment) => {
    setSelectedPayment(payment);
    setAlasanPenolakanInput('');
    setShowRejectInput(false);
    setVerifikasiError('');
  };

  const handleClosePaymentModal = () => {
    if (isVerifyingPayment) return;
    setSelectedPayment(null);
    setShowRejectInput(false);
    setVerifikasiError('');
  };

  const handleVerifyPayment = async (idPembayaran, statusDecision, alasan = '') => {
    if (statusDecision === 'DITOLAK' && !alasan.trim()) {
      setVerifikasiError('Harap isi alasan penolakan bukti pembayaran.');
      return;
    }

    setIsVerifyingPayment(true);
    setVerifikasiError('');

    try {
      const response = await fetch(
        `/api/pengembalian/pembayaran/${idPembayaran}/verifikasi`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: statusDecision,
            alasan_penolakan: statusDecision === 'DITOLAK' ? alasan.trim() : null,
            pengenal_pustakawan: currentUser?.pengenal,
          }),
        }
      );
      const payload = await parseApiResponse(response);

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Gagal memproses verifikasi pembayaran denda.');
      }

      setSelectedPayment(null);
      await fetchAllData();
      showSuccessFeedback(
        statusDecision === 'TERVERIFIKASI'
          ? 'Pembayaran denda diverifikasi (LUNAS).'
          : 'Bukti pembayaran denda ditolak.'
      );
    } catch (err) {
      setVerifikasiError(err.message || 'Gagal memverifikasi pembayaran denda.');
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchesSearch = (item) => {
    if (!normalizedQuery) return true;
    return [
      item.nomor_transaksi,
      item.kode_eksemplar,
      item.judul,
      item.anggota?.nama,
      item.anggota?.pengenal,
    ].some((field) => String(field || '').toLowerCase().includes(normalizedQuery));
  };

  const activeReturns = sortRecordsNewestFirst(
    allRecords.filter((item) => item.status !== 'SELESAI')
  );
  const filteredActiveReturns = activeReturns.filter(matchesSearch);

  const dendaRecords = sortRecordsNewestFirst(
    allRecords.filter(
      (item) => item.id_denda != null || item.denda > 0 || item.hari_terlambat > 0
    )
  );
  const filteredDendaRecords = dendaRecords.filter((item) => {
    if (!matchesSearch(item)) return false;
    if (dendaStatusFilter === 'LUNAS') return item.status_denda === 'LUNAS';
    if (dendaStatusFilter === 'BELUM_LUNAS') return item.status_denda !== 'LUNAS';
    return true;
  });

  const sortedPayments = sortPaymentsNewestFirst(payments);
  const pendingPaymentsCount = sortedPayments.filter(
    (p) => String(p.status || '').replace(/_/g, ' ') === 'MENUNGGU VERIFIKASI'
  ).length;
  const filteredPayments = sortedPayments.filter((p) => {
    if (paymentStatusFilter !== 'SEMUA') {
      if (formatPaymentStatusLabel(p.status) !== paymentStatusFilter) {
        return false;
      }
    }
    if (!normalizedQuery) return true;
    const rincianFields = (p.rincian || []).flatMap((r) => [
      r.nomor_transaksi,
      r.kode_eksemplar,
      r.judul,
    ]);
    return [p.anggota?.nama, p.anggota?.pengenal, p.status, ...rincianFields].some((val) =>
      String(val || '').toLowerCase().includes(normalizedQuery)
    );
  });

  const historyRecords = sortRecordsNewestFirst(allRecords);
  const filteredHistoryRecords = historyRecords.filter((item) => {
    if (!matchesSearch(item)) return false;
    if (historyStatusFilter !== 'SEMUA' && item.status !== historyStatusFilter) {
      return false;
    }
    return true;
  });

  const activeListForTab =
    activeTab === 'AKTIF'
      ? filteredActiveReturns
      : activeTab === 'DENDA'
      ? filteredDendaRecords
      : activeTab === 'VERIFIKASI_BAYAR'
      ? filteredPayments
      : filteredHistoryRecords;

  const totalItems = activeListForTab.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * ITEMS_PER_PAGE;
  const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, totalItems);

  const paginatedActiveReturns = filteredActiveReturns.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  const paginatedDendaRecords = filteredDendaRecords.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  const paginatedPayments = filteredPayments.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  const paginatedHistoryRecords = filteredHistoryRecords.slice(
    startIdx,
    startIdx + ITEMS_PER_PAGE
  );

  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleSearchChange = (value) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const renderPaginationControls = () => {
    if (totalItems === 0) return null;

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
          marginTop: '14px',
          padding: '10px 14px',
          backgroundColor: '#ffffff',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <span className="table-sub-text">
          Menampilkan <strong>{startIdx + 1}</strong>&ndash;<strong>{endIdx}</strong> dari{' '}
          <strong>{totalItems}</strong> data (Maks {ITEMS_PER_PAGE} per halaman)
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-outline-sm"
            onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
            disabled={safePage <= 1}
          >
            &laquo; Sebelumnya
          </button>

          {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
            <button
              key={pageNum}
              type="button"
              className={pageNum === safePage ? 'btn-action-primary-sm' : 'btn-outline-sm'}
              onClick={() => setCurrentPage(pageNum)}
            >
              {pageNum}
            </button>
          ))}

          <button
            type="button"
            className="btn-outline-sm"
            onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
            disabled={safePage >= totalPages}
          >
            Selanjutnya &raquo;
          </button>
        </div>
      </div>
    );
  };

  return (
    <section className="pustakawan-return-section">
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
          <h2 className="page-title">Pelayanan Pengembalian Buku &amp; Verifikasi Denda</h2>
          <p className="page-subtitle">
            Proses pengembalian buku, sinkronisasi denda harian otomatis (00:00), koreksi denda, dan verifikasi bukti bayar QRIS
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn-outline-sm"
            onClick={handleManualSyncDenda}
            disabled={isSyncingDenda || isLoading}
            title="Hitung & perbarui nominal denda keterlambatan di database sekarang"
          >
            {isSyncingDenda ? 'Menyinkronkan...' : 'Sinkronkan Denda Harian'}
          </button>
          <button
            type="button"
            className="btn-outline-sm"
            onClick={fetchAllData}
            disabled={isLoading || isSubmitting}
          >
            {isLoading ? 'Memuat...' : 'Muat Ulang'}
          </button>
        </div>
      </div>

      {(returnFeedback || actionError) && (
        <div className="toast-floating-wrapper" role="status" aria-live="polite">
          {returnFeedback && (
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
              <span className="toast-floating-msg">{returnFeedback}</span>
            </div>
          )}
          {actionError && (
            <div className="toast-floating-card toast-floating-error">
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
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </span>
              <span className="toast-floating-msg">{actionError}</span>
            </div>
          )}
        </div>
      )}

      <div className="circulation-card">
        <h3 className="card-heading">Verifikasi Pengembalian</h3>
        <form onSubmit={handleProcessReturn} className="circulation-form">
          <div className="form-group">
            <label className="form-label" htmlFor="return-code-input">
              Masukkan Kode Eksemplar:
            </label>
            <div className="input-group-btn">
              <input
                id="return-code-input"
                type="text"
                className="form-control"
                placeholder="Contoh: EKS-001-A"
                value={returnCode}
                onChange={(e) => setReturnCode(e.target.value)}
                disabled={isSubmitting}
                required
              />
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting && processingDetailId === null
                  ? 'Memproses...'
                  : 'Verifikasi & Kembalikan'}
              </button>
            </div>
            <span className="form-hint">
              Total nominal denda keterlambatan dihitung dan diperbarui otomatis di database setiap pergantian tanggal (tengah malam 00:00).
            </span>
          </div>
        </form>
      </div>

      {/* Navigasi Tab Pustakawan */}
      <div className="mt-8">
        <div className="tab-filters" style={{ marginBottom: '14px' }}>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'AKTIF' ? 'active' : ''}`}
            onClick={() => handleSelectTab('AKTIF')}
          >
            Daftar Buku Belum Kembali (Aktif) ({activeReturns.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'DENDA' ? 'active' : ''}`}
            onClick={() => handleSelectTab('DENDA')}
          >
            Koreksi &amp; Daftar Denda ({dendaRecords.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'VERIFIKASI_BAYAR' ? 'active' : ''}`}
            onClick={() => handleSelectTab('VERIFIKASI_BAYAR')}
          >
            Verifikasi Bukti Pembayaran Denda ({payments.length}
            {pendingPaymentsCount > 0 ? ` • ${pendingPaymentsCount} Menunggu` : ''})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'RIWAYAT' ? 'active' : ''}`}
            onClick={() => handleSelectTab('RIWAYAT')}
          >
            Riwayat Peminjaman ({historyRecords.length})
          </button>
        </div>

        <div className="search-filter-bar" style={{ marginBottom: '12px' }}>
          <div className="search-input-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="search-input"
              placeholder="Cari no. transaksi, kode eksemplar, judul buku, atau nama/NIM anggota..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => handleSearchChange('')}
                aria-label="Hapus pencarian"
              >
                &times;
              </button>
            )}
          </div>

          {activeTab === 'DENDA' && (
            <div className="filter-select-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              <select
                aria-label="Filter status denda"
                className={`filter-select-input ${
                  dendaStatusFilter !== 'SEMUA' ? 'has-active-filter' : ''
                }`}
                value={dendaStatusFilter}
                onChange={(e) => {
                  setDendaStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="SEMUA">Semua</option>
                <option value="LUNAS">Lunas</option>
                <option value="BELUM_LUNAS">Belum Lunas</option>
              </select>
            </div>
          )}

          {activeTab === 'VERIFIKASI_BAYAR' && (
            <div className="filter-select-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              <select
                aria-label="Filter status verifikasi pembayaran"
                className={`filter-select-input ${
                  paymentStatusFilter !== 'SEMUA' ? 'has-active-filter' : ''
                }`}
                value={paymentStatusFilter}
                onChange={(e) => {
                  setPaymentStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="SEMUA">Semua</option>
                <option value="MENUNGGU VERIFIKASI">Menunggu Verifikasi</option>
                <option value="LUNAS">Lunas</option>
                <option value="DITOLAK">Ditolak</option>
              </select>
            </div>
          )}

          {activeTab === 'RIWAYAT' && (
            <div className="filter-select-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
              <select
                aria-label="Filter status riwayat peminjaman"
                className={`filter-select-input ${
                  historyStatusFilter !== 'SEMUA' ? 'has-active-filter' : ''
                }`}
                value={historyStatusFilter}
                onChange={(e) => {
                  setHistoryStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="SEMUA">Semua</option>
                <option value="SEDANG_DIPINJAM">Sedang Dipinjam</option>
                <option value="SELESAI">Dikembalikan</option>
                <option value="TERLAMBAT">Terlambat</option>
              </select>
            </div>
          )}
        </div>

        {fetchError ? (
          <div className="empty-state-card">
            <p className="text-red">{fetchError}</p>
            <button type="button" className="btn-outline-sm" onClick={fetchAllData}>
              Coba Lagi
            </button>
          </div>
        ) : activeTab === 'AKTIF' ? (
          <div>
            <h3 className="section-sub-title" style={{ marginBottom: '10px' }}>
              Daftar Buku Belum Kembali (Aktif) ({filteredActiveReturns.length})
            </h3>
            <div className="table-responsive-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>No. Transaksi</th>
                    <th>Judul &amp; Eksemplar</th>
                    <th>Jatuh Tempo</th>
                    <th>Keterlambatan / Denda</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan="5" className="text-center py-6">
                        Memuat data pengembalian dari database...
                      </td>
                    </tr>
                  ) : filteredActiveReturns.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center py-6">
                        {normalizedQuery
                          ? 'Tidak ada data peminjaman aktif yang sesuai dengan pencarian.'
                          : 'Tidak ada buku yang sedang dipinjam (semua sudah dikembalikan).'}
                      </td>
                    </tr>
                  ) : (
                    paginatedActiveReturns.map((item) => {
                      const isRowProcessing =
                        isSubmitting && processingDetailId === item.id_detail;
                      const canKoreksi =
                        (item.id_denda != null || item.denda > 0 || item.hari_terlambat > 0) &&
                        item.status_denda !== 'LUNAS';

                      return (
                        <tr key={item.id_detail}>
                          <td>
                            <strong>{item.nomor_transaksi}</strong>
                            {item.anggota && (
                              <div className="table-sub-text">
                                {item.anggota.nama} ({item.anggota.pengenal})
                              </div>
                            )}
                          </td>
                          <td>
                            <div>{item.judul}</div>
                            <span className="table-sub-text">
                              {item.kode_eksemplar}
                              {item.lokasi_rak && item.lokasi_rak !== '-'
                                ? ` • ${item.lokasi_rak}`
                                : ''}
                            </span>
                          </td>
                          <td>
                            <span
                              className={
                                item.status === 'TERLAMBAT' ? 'text-red font-bold' : ''
                              }
                            >
                              {formatDateDdMmYyyy(item.tanggal_jatuh_tempo)}
                            </span>
                          </td>
                          <td>
                            {item.denda > 0 || item.hari_terlambat > 0 ? (
                              <div>
                                <span
                                  className={
                                    item.status_denda === 'LUNAS'
                                      ? 'text-green font-bold'
                                      : 'text-red font-bold'
                                  }
                                >
                                  Rp {item.denda.toLocaleString('id-ID')}
                                  {item.hari_terlambat > 0
                                    ? ` (${item.hari_terlambat} hari)`
                                    : ''}
                                </span>
                                <div className="table-sub-text">
                                  Status: {String(item.status_denda || '').replace(/_/g, ' ')}
                                  {item.riwayat_koreksi?.length > 0 ? ' • Dikoreksi' : ''}
                                </div>
                              </div>
                            ) : (
                              <span className="text-green">Tepat Waktu</span>
                            )}
                          </td>
                          <td>
                            <div
                              style={{
                                display: 'flex',
                                gap: '6px',
                                flexWrap: 'wrap',
                                alignItems: 'center',
                              }}
                            >
                              <button
                                type="button"
                                className="btn-action-primary-sm"
                                onClick={() => handleRowReturn(item)}
                                disabled={isSubmitting}
                              >
                                {isRowProcessing ? 'Memproses...' : 'Proses Kembali'}
                              </button>
                              {canKoreksi && (
                                <button
                                  type="button"
                                  className="btn-warn-sm"
                                  onClick={() => handleOpenKoreksiModal(item)}
                                >
                                  Koreksi Denda
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {renderPaginationControls()}
          </div>
        ) : activeTab === 'DENDA' ? (
          <div>
            <h3 className="section-sub-title" style={{ marginBottom: '10px' }}>
              Daftar Tagihan &amp; Koreksi Denda ({filteredDendaRecords.length})
            </h3>
            <div className="table-responsive-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>No. Transaksi &amp; Anggota</th>
                    <th>Judul &amp; Status Buku</th>
                    <th>Keterlambatan</th>
                    <th>Nominal Denda &amp; Riwayat Koreksi</th>
                    <th>Status Denda</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDendaRecords.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-6">
                        Tidak ada data denda keterlambatan yang ditemukan.
                      </td>
                    </tr>
                  ) : (
                    paginatedDendaRecords.map((item) => (
                      <tr key={item.id_detail}>
                        <td>
                          <strong>{item.nomor_transaksi}</strong>
                          {item.anggota && (
                            <div className="table-sub-text">
                              {item.anggota.nama} ({item.anggota.pengenal})
                            </div>
                          )}
                        </td>
                        <td>
                          <div>{item.judul}</div>
                          <span className="table-sub-text">
                            {item.kode_eksemplar} •{' '}
                            {item.status === 'SELESAI'
                              ? `Sudah Kembali (${formatDateDdMmYyyy(item.tanggal_kembali)})`
                              : 'Belum Kembali'}
                          </span>
                        </td>
                        <td>
                          <strong>{item.hari_terlambat} hari</strong>
                          <div className="table-sub-text">
                            Jatuh tempo: {formatDateDdMmYyyy(item.tanggal_jatuh_tempo)}
                          </div>
                        </td>
                        <td>
                          <strong className="text-red">
                            Rp {item.denda.toLocaleString('id-ID')}
                          </strong>
                          {item.riwayat_koreksi?.length > 0 && (
                            <div className="table-sub-text" style={{ color: '#065f46' }}>
                              Dikoreksi dari Rp{' '}
                              {item.riwayat_koreksi[0].nominal_lama.toLocaleString('id-ID')}: &quot;
                              {item.riwayat_koreksi[0].alasan}&quot;
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className={`status-pill ${
                              item.status_denda === 'LUNAS'
                                ? 'status-active'
                                : 'status-danger'
                            }`}
                          >
                            {String(item.status_denda || '').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>
                          {item.status_denda !== 'LUNAS' ? (
                            <button
                              type="button"
                              className="btn-warn-sm"
                              onClick={() => handleOpenKoreksiModal(item)}
                            >
                              Koreksi Denda
                            </button>
                          ) : (
                            <span className="table-sub-text">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {renderPaginationControls()}
          </div>
        ) : activeTab === 'VERIFIKASI_BAYAR' ? (
          <div>
            <h3 className="section-sub-title" style={{ marginBottom: '10px' }}>
              Daftar Verifikasi Pembayaran Denda ({filteredPayments.length})
            </h3>
            <div className="table-responsive-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Anggota &amp; Waktu Unggah</th>
                    <th>Transaksi &amp; Buku</th>
                    <th>Nominal Bayar</th>
                    <th>Bukti Pembayaran</th>
                    <th>Status Verifikasi</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-6">
                        Belum ada bukti pembayaran denda yang diunggah oleh anggota.
                      </td>
                    </tr>
                  ) : (
                    paginatedPayments.map((payment) => (
                      <tr key={payment.id_pembayaran}>
                        <td>
                          <strong>{payment.anggota?.nama || '-'}</strong>
                          <div className="table-sub-text">
                            {payment.anggota?.pengenal || '-'}
                            {payment.waktu_unggah
                              ? ` • ${formatDateTimeDdMmYyyy(payment.waktu_unggah)}`
                              : ''}
                          </div>
                        </td>
                        <td>
                          {payment.rincian?.length > 0 ? (
                            payment.rincian.map((r) => (
                              <div key={r.id_rincian || r.id_denda}>
                                <strong>{r.nomor_transaksi}</strong> — {r.judul}
                                <div className="table-sub-text">
                                  {r.kode_eksemplar} ({r.hari_terlambat} hari terlambat)
                                </div>
                              </div>
                            ))
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                        <td>
                          <strong>
                            Rp {payment.nominal_bayar.toLocaleString('id-ID')}
                          </strong>
                        </td>
                        <td>
                          {payment.path_bukti ? (
                            <button
                              type="button"
                              className="btn-outline-sm"
                              onClick={() => handleOpenPaymentModal(payment)}
                            >
                              Lihat Bukti
                            </button>
                          ) : (
                            <span className="table-sub-text">Tidak ada berkas</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`status-pill ${
                              formatPaymentStatusLabel(payment.status) === 'LUNAS'
                                ? 'status-active'
                                : formatPaymentStatusLabel(payment.status) === 'DITOLAK'
                                ? 'status-danger'
                                : 'status-done'
                            }`}
                          >
                            {formatPaymentStatusLabel(payment.status)}
                          </span>
                          {payment.alasan_penolakan && (
                            <div className="table-sub-text text-red">
                              Alasan: {payment.alasan_penolakan}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn-action-primary-sm"
                              onClick={() => handleOpenPaymentModal(payment)}
                            >
                              {formatPaymentStatusLabel(payment.status) === 'MENUNGGU VERIFIKASI'
                                ? 'Periksa & Verifikasi'
                                : 'Detail Bukti'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {renderPaginationControls()}
          </div>
        ) : (
          <div>
            <h3 className="section-sub-title" style={{ marginBottom: '10px' }}>
              Riwayat Peminjaman Keseluruhan ({filteredHistoryRecords.length})
            </h3>
            <div className="table-responsive-wrapper">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>No. Transaksi &amp; Anggota</th>
                    <th>Judul &amp; Eksemplar</th>
                    <th>Tgl Pinjam &amp; Jatuh Tempo</th>
                    <th>Tgl Kembali</th>
                    <th>Denda</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistoryRecords.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-6">
                        Tidak ada riwayat peminjaman yang ditemukan.
                      </td>
                    </tr>
                  ) : (
                    paginatedHistoryRecords.map((item) => {
                      const isReturned = item.status === 'SELESAI';
                      const isOverdue = item.status === 'TERLAMBAT';

                      return (
                        <tr key={item.id_detail}>
                          <td>
                            <strong>{item.nomor_transaksi}</strong>
                            {item.anggota && (
                              <div className="table-sub-text">
                                {item.anggota.nama} ({item.anggota.pengenal})
                              </div>
                            )}
                          </td>
                          <td>
                            <div>{item.judul}</div>
                            <span className="table-sub-text">
                              {item.kode_eksemplar}
                              {item.lokasi_rak && item.lokasi_rak !== '-'
                                ? ` • ${item.lokasi_rak}`
                                : ''}
                            </span>
                          </td>
                          <td>
                            <div>Pinjam: {formatDateDdMmYyyy(item.tanggal_pinjam)}</div>
                            <div className="table-sub-text">
                              Tempo: {formatDateDdMmYyyy(item.tanggal_jatuh_tempo)}
                            </div>
                          </td>
                          <td>
                            {item.tanggal_kembali ? (
                              <span>{formatDateDdMmYyyy(item.tanggal_kembali)}</span>
                            ) : (
                              <span className="table-sub-text">Belum Kembali</span>
                            )}
                          </td>
                          <td>
                            {item.denda > 0 || item.hari_terlambat > 0 ? (
                              <div>
                                <strong
                                  className={
                                    item.status_denda === 'LUNAS' ? 'text-green' : 'text-red'
                                  }
                                >
                                  Rp {item.denda.toLocaleString('id-ID')}
                                </strong>
                                <div className="table-sub-text">
                                  {item.hari_terlambat} hari •{' '}
                                  {String(item.status_denda || '').replace(/_/g, ' ')}
                                </div>
                              </div>
                            ) : (
                              <span className="text-green">Tepat Waktu</span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`status-pill ${
                                isReturned
                                  ? 'status-done'
                                  : isOverdue
                                  ? 'status-danger'
                                  : 'status-active'
                              }`}
                            >
                              {isReturned
                                ? 'DIKEMBALIKAN'
                                : isOverdue
                                ? 'TERLAMBAT'
                                : 'SEDANG DIPINJAM'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {renderPaginationControls()}
          </div>
        )}
      </div>

      {/* Modal Koreksi Denda */}
      <Modal
        isOpen={Boolean(koreksiTarget)}
        title="Koreksi Nominal Denda Keterlambatan"
        onClose={handleCloseKoreksiModal}
      >
        {koreksiTarget && (
          <form onSubmit={handleSubmitKoreksi} className="modal-form">
            {koreksiError && <div className="alert-error">{koreksiError}</div>}

            <div className="book-meta-list">
              <div className="meta-item">
                <span className="meta-label">No. Transaksi:</span>
                <span className="meta-val">{koreksiTarget.nomor_transaksi}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Peminjam:</span>
                <span className="meta-val">
                  {koreksiTarget.anggota?.nama} ({koreksiTarget.anggota?.pengenal})
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Buku &amp; Eksemplar:</span>
                <span className="meta-val">
                  {koreksiTarget.judul} ({koreksiTarget.kode_eksemplar})
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Hari Terlambat:</span>
                <span className="meta-val">{koreksiTarget.hari_terlambat} hari</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Nominal Denda Saat Ini:</span>
                <span className="meta-val text-red">
                  Rp {koreksiTarget.denda.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {koreksiTarget.riwayat_koreksi?.length > 0 && (
              <div className="rule-box" style={{ marginTop: 0 }}>
                <h4>Riwayat Koreksi Sebelumnya:</h4>
                <ul>
                  {koreksiTarget.riwayat_koreksi.map((k) => (
                    <li key={k.id_koreksi}>
                      Rp {k.nominal_lama.toLocaleString('id-ID')} &rarr;{' '}
                      <strong>Rp {k.nominal_baru.toLocaleString('id-ID')}</strong> ({k.alasan})
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="form-group">
              <label className="form-label" htmlFor="nominal-baru-input">
                Nominal Denda Baru (Rp) *
              </label>
              <input
                id="nominal-baru-input"
                type="number"
                min="0"
                step="500"
                className="form-control"
                value={nominalBaruInput}
                onChange={(e) => setNominalBaruInput(e.target.value)}
                required
              />
              <span className="form-hint">
                Isi 0 apabila diberikan dispensasi pembebasan denda penuh.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="alasan-koreksi-input">
                Alasan Koreksi Denda *
              </label>
              <input
                id="alasan-koreksi-input"
                type="text"
                className="form-control"
                placeholder="Contoh: Penyesuaian hari libur fakultas / kendala sistem"
                value={alasanKoreksiInput}
                onChange={(e) => setAlasanKoreksiInput(e.target.value)}
                required
              />
            </div>

            <div className="modal-actions-row">
              <button
                type="button"
                className="btn-outline-sm"
                onClick={handleCloseKoreksiModal}
                disabled={isSavingKoreksi}
              >
                Batal
              </button>
              <button type="submit" className="btn-primary" disabled={isSavingKoreksi}>
                {isSavingKoreksi ? 'Menyimpan...' : 'Simpan Koreksi Denda'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Lihat & Verifikasi Bukti Pembayaran Denda */}
      <Modal
        isOpen={Boolean(selectedPayment)}
        title="Verifikasi Bukti Pembayaran Denda"
        onClose={handleClosePaymentModal}
      >
        {selectedPayment && (
          <div className="modal-form">
            {verifikasiError && <div className="alert-error">{verifikasiError}</div>}

            <div className="book-meta-list">
              <div className="meta-item">
                <span className="meta-label">Anggota:</span>
                <span className="meta-val">
                  {selectedPayment.anggota?.nama || '-'} (
                  {selectedPayment.anggota?.pengenal || '-'})
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Nominal Bayar:</span>
                <span className="meta-val">
                  Rp {(selectedPayment.nominal_bayar || 0).toLocaleString('id-ID')}
                </span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Status Saat Ini:</span>
                <span className="meta-val">
                  {formatPaymentStatusLabel(selectedPayment.status)}
                </span>
              </div>
              {selectedPayment.alasan_penolakan && (
                <div className="meta-item">
                  <span className="meta-label">Alasan Penolakan:</span>
                  <span className="meta-val text-red">
                    {selectedPayment.alasan_penolakan}
                  </span>
                </div>
              )}
              <div className="meta-item">
                <span className="meta-label">Tipe Berkas:</span>
                <span className="meta-val">{selectedPayment.tipe_berkas}</span>
              </div>
            </div>

            {selectedPayment.path_bukti && (
              <div
                style={{
                  textAlign: 'center',
                  padding: '12px',
                  backgroundColor: '#f8faf9',
                  border: '1px solid #d5e2da',
                  borderRadius: '8px',
                }}
              >
                <img
                  src={selectedPayment.path_bukti}
                  alt="Bukti Pembayaran Denda Anggota"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '300px',
                    objectFit: 'contain',
                    borderRadius: '6px',
                  }}
                />
              </div>
            )}

            {formatPaymentStatusLabel(selectedPayment.status) === 'MENUNGGU VERIFIKASI' && (
              <>
                {showRejectInput && (
                  <div className="form-group">
                    <label className="form-label" htmlFor="alasan-penolakan-input">
                      Alasan Penolakan Bukti Pembayaran *
                    </label>
                    <input
                      id="alasan-penolakan-input"
                      type="text"
                      className="form-control"
                      placeholder="Wajib diisi: Contoh nominal transfer tidak sesuai atau gambar bukti buram"
                      value={alasanPenolakanInput}
                      onChange={(e) => setAlasanPenolakanInput(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                )}

                <div className="modal-actions-row">
                  <button
                    type="button"
                    className="btn-outline-sm"
                    onClick={handleClosePaymentModal}
                    disabled={isVerifyingPayment}
                  >
                    Tutup
                  </button>

                  {!showRejectInput ? (
                    <>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => setShowRejectInput(true)}
                        disabled={isVerifyingPayment}
                      >
                        Tolak
                      </button>

                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() =>
                          handleVerifyPayment(selectedPayment.id_pembayaran, 'TERVERIFIKASI')
                        }
                        disabled={isVerifyingPayment}
                      >
                        {isVerifyingPayment ? 'Memverifikasi...' : 'Verifikasi & Setujui (Lunas)'}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() =>
                        handleVerifyPayment(
                          selectedPayment.id_pembayaran,
                          'DITOLAK',
                          alasanPenolakanInput
                        )
                      }
                      disabled={isVerifyingPayment || !alasanPenolakanInput.trim()}
                    >
                      {isVerifyingPayment ? 'Memproses...' : 'Konfirmasi Penolakan'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
