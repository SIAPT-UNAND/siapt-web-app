import './Sidebar.css';

export default function Sidebar({
  role,
  activeMenu,
  onSelectMenu,
  isOpen,
  onClose,
}) {
  const getMenuItems = () => {
    switch (role) {
      case 'Anggota':
        return [
          {
            id: 'beranda',
            label: 'Beranda (Koleksi)',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            ),
          },
          {
            id: 'peminjaman-mandiri',
            label: 'Peminjaman Mandiri',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            ),
          },
          {
            id: 'informasi-peminjaman',
            label: 'Informasi Peminjaman',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            ),
          },
        ];

      case 'Pustakawan':
        return [
          {
            id: 'daftar-koleksi',
            label: 'Daftar Koleksi',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
            ),
          },
          {
            id: 'peminjaman-buku',
            label: 'Peminjaman Buku',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="15" y2="15"></line>
              </svg>
            ),
          },
          {
            id: 'pengembalian-buku',
            label: 'Pengembalian Buku',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 14 4 9 9 4"></polyline>
                <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
              </svg>
            ),
          },
        ];

      case 'Pengelola':
        return [
          {
            id: 'dashboard-analitik',
            label: 'Ringkasan',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            ),
          },
          {
            id: 'dashboard-koleksi',
            label: 'Koleksi & Inventaris',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
              </svg>
            ),
          },
          {
            id: 'dashboard-sirkulasi',
            label: 'Sirkulasi',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="17 1 21 5 17 9"></polyline>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                <polyline points="7 23 3 19 7 15"></polyline>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
              </svg>
            ),
          },
          {
            id: 'dashboard-denda',
            label: 'Denda & Pembayaran',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
            ),
          },
          {
            id: 'dashboard-layanan',
            label: 'Layanan & Chatbot',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            ),
          },
        ];

      case 'Admin':
        return [
          {
            id: 'home',
            label: 'Home (Beranda)',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            ),
          },
          {
            id: 'kelola-akun',
            label: 'Kelola Akun',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            ),
          },
          {
            id: 'kelola-hak-akses',
            label: 'Hak Akses',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            ),
          },
          {
            id: 'kelola-konfigurasi',
            label: 'Kelola Konfigurasi Sistem',
            icon: (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            ),
          },
        ];

      default:
        return [];
    }
  };

  const menuItems = getMenuItems();

  return (
    <>
      {/* Backdrop for mobile drawer */}
      {isOpen && <div className="sidebar-backdrop" onClick={onClose}></div>}

      <aside className={`app-sidebar ${isOpen ? 'open' : ''}`} aria-label="Navigasi utama">
        <div className="sidebar-header">
          <span className="sidebar-role-tag">Portal {role}</span>
          <button className="sidebar-close-btn" onClick={onClose} aria-label="Tutup Menu">
            &times;
          </button>
        </div>

        <nav className="sidebar-nav" aria-label={`Menu ${role}`}>
          <ul className="nav-list">
            {menuItems.map((item) => {
              const isActive = activeMenu === item.id;
              return (
                <li key={item.id} className="nav-item">
                  <button
                    className={`nav-button ${isActive ? 'active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    onClick={() => {
                      onSelectMenu(item.id);
                      if (onClose) onClose();
                    }}
                    type="button"
                  >
                    <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <div className="system-pill">
            <span className="dot-online"></span>
            <span>SIAPT v1.0 • UNAND</span>
          </div>
        </div>
      </aside>
    </>
  );
}

