import { useEffect } from 'react';

const LAMA_NOTIFIKASI_MS = 4000;

export function IkonCari() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  );
}

export function IkonTambah() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
  );
}

export function IkonUbah() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path>
    </svg>
  );
}

export function IkonKunci() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2"></rect>
      <path d="M8 11V7a4 4 0 0 1 8 0v4"></path>
    </svg>
  );
}

export function IkonDaya() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
      <line x1="12" y1="2" x2="12" y2="12"></line>
    </svg>
  );
}

/**
 * Keadaan memuat, error (dengan tombol Coba lagi), atau kosong di dalam kartu.
 * Keadaan kosong boleh membawa satu aksi, misalnya "Hapus filter".
 */
export function KeadaanData({
  keadaan,
  pesanError,
  pesanKosong,
  onCobaLagi,
  aksiKosong,
  pesanMemuat = 'Memuat daftar akun...',
}) {
  if (keadaan === 'memuat') {
    return (
      <div className="adm-state" role="status">
        <span className="adm-spinner" aria-hidden="true"></span>
        <span>{pesanMemuat}</span>
      </div>
    );
  }

  if (keadaan === 'error') {
    return (
      <div className="adm-state is-error" role="alert">
        <span className="adm-state-text">{pesanError}</span>
        <button type="button" className="adm-btn" onClick={onCobaLagi}>
          Coba lagi
        </button>
      </div>
    );
  }

  return (
    <div className="adm-state">
      <span>{pesanKosong}</span>
      {aksiKosong && (
        <button type="button" className="adm-btn" onClick={aksiKosong.onClick}>
          {aksiKosong.label}
        </button>
      )}
    </div>
  );
}

/** Notifikasi melayang yang hilang sendiri. `onTutup` dipanggil dengan string kosong. */
export function Notifikasi({ pesan, onTutup }) {
  useEffect(() => {
    if (!pesan) return undefined;
    const timer = setTimeout(() => onTutup(''), LAMA_NOTIFIKASI_MS);
    return () => clearTimeout(timer);
  }, [pesan, onTutup]);

  if (!pesan) return null;
  return (
    <div className="adm-toast" role="status">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>{pesan}</span>
    </div>
  );
}

/** Nama + pengenal, dengan penanda "Kamu" untuk akun yang sedang dipakai. */
export function SelPengguna({ akun, milikSendiri }) {
  return (
    <div className="adm-user">
      <span className="adm-user-name">
        {akun.nama || '-'}
        {milikSendiri && <span className="adm-you">Kamu</span>}
      </span>
      <span className="adm-user-id">{akun.pengenal}</span>
    </div>
  );
}

/** Pesan error di bawah satu kolom; id dipakai di aria-describedby kolomnya. */
export function ErrorKolom({ id, pesan }) {
  if (!pesan) return null;
  return (
    <p id={id} className="adm-field-error" role="alert">
      {pesan}
    </p>
  );
}
