import { useEffect, useState } from 'react';
import { getBantuan } from '../../services/authService.js';

function LogoBadge() {
  return (
    <div className="auth-logo-badge">
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
      </svg>
    </div>
  );
}

function SecureNote() {
  return (
    <div className="auth-footer-note">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
      <span>Sesi terenkripsi dan aman SIAPT UNAND</span>
    </div>
  );
}

export default function LoginPage({ onLogin }) {
  const [tampilan, setTampilan] = useState('login');
  const [pengenal, setPengenal] = useState('');
  const [kataSandi, setKataSandi] = useState('');
  const [lihatSandi, setLihatSandi] = useState(false);
  const [error, setError] = useState('');
  const [memproses, setMemproses] = useState(false);
  const [bantuan, setBantuan] = useState(null);
  const [bantuanError, setBantuanError] = useState('');

  // Ambil kontak WhatsApp Admin saat membuka tampilan "Lupa kata sandi"
  useEffect(() => {
    if (tampilan !== 'lupa' || bantuan) return undefined;
    let batal = false;
    getBantuan()
      .then((data) => {
        if (!batal) setBantuan(data.whatsapp);
      })
      .catch((err) => {
        if (!batal) setBantuanError(err.message);
      });
    return () => {
      batal = true;
    };
  }, [tampilan, bantuan]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (!pengenal.trim() || !kataSandi) {
      setError('Nomor pengenal (NIM/NIP) dan kata sandi wajib diisi.');
      return;
    }

    setMemproses(true);
    try {
      await onLogin(pengenal.trim(), kataSandi);
    } catch (err) {
      setError(err.message || 'Login gagal. Silakan coba lagi.');
      setMemproses(false);
    }
  }

  // ===== Tampilan: Lupa Kata Sandi =====
  if (tampilan === 'lupa') {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <LogoBadge />
            <h1 className="auth-title">Lupa Kata Sandi</h1>
            <p className="auth-subtitle">
              Kata sandi diatur ulang oleh Admin. Hubungi Admin lewat WhatsApp
              dan sebutkan NIM/NIP kamu.
            </p>
          </div>

          {bantuanError && <div className="alert-error">{bantuanError}</div>}

          {bantuan ? (
            <a
              className="btn-primary btn-block"
              style={{ textDecoration: 'none', textAlign: 'center' }}
              href={bantuan.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Hubungi Admin via WhatsApp ({bantuan.tampil})
            </a>
          ) : (
            !bantuanError && (
              <p className="auth-subtitle">Memuat kontak bantuan…</p>
            )
          )}

          <div className="auth-footer-note">
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => setTampilan('login')}
            >
              Kembali ke halaman login
            </button>
          </div>

          <SecureNote />
        </div>
      </div>
    );
  }

  // ===== Tampilan: Login =====
  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <LogoBadge />
          <h1 className="auth-title">SIAPT UNAND</h1>
          <p className="auth-subtitle">
            Sistem Informasi Perpustakaan Terpadu Universitas Andalas
          </p>
        </div>

        {error && (
          <div className="alert-error" role="alert">
            {error}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="user-id">
              Nomor Pengenal (NIM / NIP):
            </label>
            <input
              id="user-id"
              type="text"
              className="form-control"
              placeholder="Contoh: 2211521001 atau 198805122014042001"
              autoComplete="username"
              value={pengenal}
              onChange={(e) => setPengenal(e.target.value)}
              maxLength={100}
              disabled={memproses}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="user-pwd">
              Kata Sandi:
            </label>
            <input
              id="user-pwd"
              type={lihatSandi ? 'text' : 'password'}
              className="form-control"
              placeholder="••••••••"
              autoComplete="current-password"
              value={kataSandi}
              onChange={(e) => setKataSandi(e.target.value)}
              maxLength={200}
              disabled={memproses}
            />
            <label
              className="form-hint"
              style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                checked={lihatSandi}
                onChange={(e) => setLihatSandi(e.target.checked)}
              />
              Tampilkan kata sandi
            </label>
          </div>

          <button
            type="submit"
            className="btn-primary btn-block"
            disabled={memproses}
          >
            {memproses ? 'Memproses…' : 'Masuk ke Layanan'}
          </button>
        </form>

        <div className="auth-footer-note">
          <button
            type="button"
            className="btn-outline-sm"
            onClick={() => setTampilan('lupa')}
          >
            Lupa kata sandi?
          </button>
        </div>

        <SecureNote />
      </div>
    </div>
  );
}