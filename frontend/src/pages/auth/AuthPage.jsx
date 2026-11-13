import { useState } from 'react';

export default function AuthPage({ onLogin }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState('Anggota');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setErrorMsg('Silakan masukkan nomor pengenal (NIM/NIP/Username)');
      return;
    }
    setErrorMsg('');
    onLogin({
      id: Date.now(),
      pengenal: identifier,
      nama: identifier.toUpperCase().startsWith('ADM')
        ? 'Admin Perpustakaan'
        : identifier.startsWith('19')
        ? 'Pustakawan Bertugas'
        : 'Ahmad Fauzan',
      role: selectedRole,
    });
  };

  const handleQuickLogin = (role, defaultId, defaultName) => {
    onLogin({
      id: Date.now(),
      pengenal: defaultId,
      nama: defaultName,
      role: role,
    });
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
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
          <h1 className="auth-title">SIAPT UNAND</h1>
          <p className="auth-subtitle">
            Sistem Informasi Perpustakaan Terpadu Universitas Andalas
          </p>
        </div>

        {errorMsg && <div className="alert-error">{errorMsg}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label" htmlFor="role-select">
              Masuk Sebagai Peran:
            </label>
            <select
              id="role-select"
              className="form-control"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="Anggota">Anggota (Mahasiswa / Dosen)</option>
              <option value="Pustakawan">Pustakawan (Sirkulasi & Koleksi)</option>
              <option value="Pengelola">Pengelola (Analitik Perpustakaan)</option>
              <option value="Admin">Administrator (Konfigurasi & Pengguna)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="user-id">
              Nomor Pengenal (NIM / NIP / ID):
            </label>
            <input
              id="user-id"
              type="text"
              className="form-control"
              placeholder="Contoh: 2211521001 atau ADM-001"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="user-pwd">
              Kata Sandi:
            </label>
            <input
              id="user-pwd"
              type="password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn-primary btn-block">
            Masuk ke Layanan
          </button>
        </form>

        <div className="auth-divider">
          <span>atau Akses Cepat Demo</span>
        </div>

        <div className="quick-roles-grid">
          <button
            type="button"
            className="btn-outline-role"
            onClick={() =>
              handleQuickLogin('Anggota', '2211521001', 'Ahmad Fauzan')
            }
          >
            <span className="role-dot role-anggota"></span>
            <span>Anggota</span>
          </button>

          <button
            type="button"
            className="btn-outline-role"
            onClick={() =>
              handleQuickLogin(
                'Pustakawan',
                '198805122014042001',
                'Siti Rahmawati, S.I.Pust.'
              )
            }
          >
            <span className="role-dot role-pustakawan"></span>
            <span>Pustakawan</span>
          </button>

          <button
            type="button"
            className="btn-outline-role"
            onClick={() =>
              handleQuickLogin(
                'Pengelola',
                '197503152000031002',
                'Dr. Irwan Syahputra, M.Kom.'
              )
            }
          >
            <span className="role-dot role-pengelola"></span>
            <span>Pengelola</span>
          </button>

          <button
            type="button"
            className="btn-outline-role"
            onClick={() =>
              handleQuickLogin('Admin', 'ADM-001', 'Administrator Sistem')
            }
          >
            <span className="role-dot role-admin"></span>
            <span>Admin</span>
          </button>
        </div>

        <div className="auth-footer-note">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span>Sesi terenkripsi dan aman SIAPT UNAND</span>
        </div>
      </div>
    </div>
  );
}

