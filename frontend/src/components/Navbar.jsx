export default function Navbar({
  currentUser,
  onToggleSidebar,
  onLogout,
}) {
  return (
    <header className="app-navbar">
      <div className="navbar-left">
        <button
          className="menu-toggle-btn"
          onClick={onToggleSidebar}
          aria-label="Toggle Sidebar"
          type="button"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        <div className="brand-logo">
          <div className="brand-badge-icon">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-title">SIAPT UNAND</span>
            <span className="brand-subtitle">Perpustakaan Terpadu</span>
          </div>
        </div>
      </div>

      <div className="navbar-right">
        {currentUser && (
          <>
            {/* Indikator Peran Tetap (Fixed Role Badge) */}
            <div className="current-role-badge">
              <span className="role-badge-label">Peran:</span>
              <span className={`role-pill role-${currentUser.role.toLowerCase()}`}>
                {currentUser.role}
              </span>
            </div>

            <div className="user-profile-badge">
              <div className="user-avatar">
                {currentUser.nama.charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                <span className="user-name">{currentUser.nama}</span>
                <span className="user-pengenal">{currentUser.pengenal}</span>
              </div>
            </div>

            <button
              className="btn-logout"
              onClick={onLogout}
              title="Keluar dari akun"
              type="button"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span className="logout-text">Keluar</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
