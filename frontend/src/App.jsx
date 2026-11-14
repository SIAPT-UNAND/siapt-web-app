import { useState } from 'react';
import './App.css';

import Navbar from './components/Navbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import AuthPage from './pages/auth/AuthPage.jsx';
import AnggotaPage from './pages/anggota/index.jsx';
import PustakawanPage from './pages/pustakawan/index.jsx';
import PengelolaPage from './pages/pengelola/index.jsx';
import AdminPage from './pages/admin/index.jsx';

import {
  initialCollections,
  initialLoans,
  initialUsers,
  initialConfigurations,
} from './mockData.js';

export default function App() {
  // Session User State
  const [currentUser, setCurrentUser] = useState(null);

  // Active Menu State
  const [activeMenu, setActiveMenu] = useState('beranda');

  // Mobile Sidebar Toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // App Data State
  const [collections, setCollections] = useState(initialCollections);
  const [loans, setLoans] = useState(initialLoans);
  const [users, setUsers] = useState(initialUsers);
  const [configurations, setConfigurations] = useState(initialConfigurations);

  // Default menu per role
  const getDefaultMenuForRole = (role) => {
    switch (role) {
      case 'Anggota':
        return 'beranda';
      case 'Pustakawan':
        return 'daftar-koleksi';
      case 'Pengelola':
        return 'dashboard-analitik';
      case 'Admin':
        return 'home';
      default:
        return 'beranda';
    }
  };

  // Login Handler
  const handleLogin = (user) => {
    setCurrentUser(user);
    setActiveMenu(getDefaultMenuForRole(user.role));
    setIsSidebarOpen(false);
  };

  // Logout Handler
  const handleLogout = () => {
    setCurrentUser(null);
    setIsSidebarOpen(false);
  };

  // Collection Handlers
  const handleAddCollection = (newBook) => {
    setCollections([newBook, ...collections]);
  };

  const handleUpdateCollection = (updatedBook) => {
    setCollections(
      collections.map((b) =>
        b.id_koleksi === updatedBook.id_koleksi ? updatedBook : b
      )
    );
  };

  const handleDeleteCollection = (id_koleksi) => {
    setCollections(collections.filter((b) => b.id_koleksi !== id_koleksi));
  };

  // Loan Handlers
  const handleAddLoan = (newLoan) => {
    setLoans([newLoan, ...loans]);
    setCollections(
      collections.map((b) => {
        if (b.judul === newLoan.judul && b.stok_tersedia > 0) {
          return { ...b, stok_tersedia: b.stok_tersedia - 1 };
        }
        return b;
      })
    );
  };

  const handleReturnLoan = (id_peminjaman) => {
    const loanToReturn = loans.find((l) => l.id_peminjaman === id_peminjaman);
    if (!loanToReturn) return;

    setLoans(
      loans.map((l) =>
        l.id_peminjaman === id_peminjaman
          ? { ...l, status: 'SELESAI', denda: 0, status_denda: 'LUNAS' }
          : l
      )
    );

    setCollections(
      collections.map((b) => {
        if (b.judul === loanToReturn.judul) {
          return { ...b, stok_tersedia: Math.min(b.stok_tersedia + 1, b.total_stok) };
        }
        return b;
      })
    );
  };

  // User Handlers
  const handleAddUser = (newUser) => {
    setUsers([newUser, ...users]);
  };

  const handleToggleUserStatus = (id_pengguna) => {
    setUsers(
      users.map((u) =>
        u.id_pengguna === id_pengguna ? { ...u, status_aktif: !u.status_aktif } : u
      )
    );
  };

  // Configuration Handlers
  const handleUpdateConfig = (id_konfigurasi, newValue) => {
    setConfigurations(
      configurations.map((cfg) =>
        cfg.id_konfigurasi === id_konfigurasi ? { ...cfg, nilai: newValue } : cfg
      )
    );
  };

  // Jika belum login, tampilkan halaman autentikasi
  if (!currentUser) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return (
    <div className="app-root-layout">
      {/* Navbar Atas */}
      <Navbar
        currentUser={currentUser}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onLogout={handleLogout}
      />

      <div className="app-main-layout">
        {/* Sidebar Navigasi Berdasarkan Peran */}
        <Sidebar
          role={currentUser.role}
          activeMenu={activeMenu}
          onSelectMenu={(menuId) => setActiveMenu(menuId)}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Konten Halaman Berdasarkan Peran */}
        <main className="app-content-body">
          {currentUser.role === 'Anggota' && (
            <AnggotaPage
              activeMenu={activeMenu}
              currentUser={currentUser}
              collections={collections}
              loans={loans}
              onAddLoan={handleAddLoan}
            />
          )}

          {currentUser.role === 'Pustakawan' && (
            <PustakawanPage
              activeMenu={activeMenu}
              collections={collections}
              onAddCollection={handleAddCollection}
              onUpdateCollection={handleUpdateCollection}
              onDeleteCollection={handleDeleteCollection}
              loans={loans}
              onAddLoan={handleAddLoan}
              onReturnLoan={handleReturnLoan}
            />
          )}

          {currentUser.role === 'Pengelola' && (
            <PengelolaPage
              collections={collections}
              loans={loans}
            />
          )}

          {currentUser.role === 'Admin' && (
            <AdminPage
              activeMenu={activeMenu}
              users={users}
              onAddUser={handleAddUser}
              onToggleUserStatus={handleToggleUserStatus}
              configurations={configurations}
              onUpdateConfig={handleUpdateConfig}
            />
          )}
        </main>
      </div>
    </div>
  );
}
