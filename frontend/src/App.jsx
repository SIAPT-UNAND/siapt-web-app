import { useState, useEffect, useCallback } from 'react';
import './App.css';

import Navbar from './components/Navbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import AuthPage from './pages/auth/AuthPage.jsx';
import AnggotaPage from './pages/anggota/index.jsx';
import PustakawanPage from './pages/pustakawan/index.jsx';
import PengelolaPage from './pages/pengelola/index.jsx';
import AdminPage from './pages/admin/index.jsx';
import { kembalikanPeminjaman } from './api/peminjaman.js';
import { aturPengenalSementara } from './services/apiClient.js';

import {
  initialLoans,
  initialConfigurations,
} from './mockData.js';

export default function App() {
  // Session User State
  const [currentUser, setCurrentUser] = useState(null);

  // Active Menu State
  const [activeMenu, setActiveMenu] = useState('beranda');

  // Mobile Sidebar Toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // App Data State (Koleksi, Kategori, Penulis, dan Penerbit diambil dari Database MySQL melalui API)
  const [collections, setCollections] = useState([]);
  const [dbCategories, setDbCategories] = useState([]);
  const [dbAuthors, setDbAuthors] = useState([]);
  const [dbPublishers, setDbPublishers] = useState([]);
  const [dbNextBookId, setDbNextBookId] = useState(1);
  const [isLoadingCollections, setIsLoadingCollections] = useState(true);
  const [collectionError, setCollectionError] = useState(null);

  const [loans, setLoans] = useState(initialLoans);
  const [configurations, setConfigurations] = useState(initialConfigurations);

  // Fungsi mengambil daftar koleksi, kategori, penulis, dan penerbit dari database
  const fetchCollectionsFromDb = useCallback(async () => {
    setIsLoadingCollections(true);
    setCollectionError(null);
    try {
      const [kolRes, opsiRes] = await Promise.all([
        fetch('/api/koleksi'),
        fetch('/api/koleksi/opsi-form').catch(() => null),
      ]);

      if (!kolRes.ok) {
        throw new Error('Gagal memuat data koleksi dari database');
      }

      const kolJson = await kolRes.json();
      if (kolJson && kolJson.success && Array.isArray(kolJson.data)) {
        setCollections(kolJson.data);
      }

      if (opsiRes && opsiRes.ok) {
        const opsiJson = await opsiRes.json();
        if (opsiJson && opsiJson.success && opsiJson.data) {
          if (Array.isArray(opsiJson.data.kategori)) {
            setDbCategories(opsiJson.data.kategori);
          }
          if (Array.isArray(opsiJson.data.pengarang)) {
            setDbAuthors(opsiJson.data.pengarang);
          }
          if (Array.isArray(opsiJson.data.penerbit)) {
            setDbPublishers(opsiJson.data.penerbit);
          }
          if (opsiJson.data.next_id_koleksi) {
            setDbNextBookId(Number(opsiJson.data.next_id_koleksi));
          }
        }
      }
    } catch (err) {
      console.error('Error fetching collections from DB:', err);
      setCollectionError(err.message || 'Gagal terhubung ke server database');
    } finally {
      setIsLoadingCollections(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [kolRes, opsiRes] = await Promise.all([
          fetch('/api/koleksi'),
          fetch('/api/koleksi/opsi-form').catch(() => null),
        ]);

        if (!kolRes.ok) {
          throw new Error('Gagal memuat data koleksi dari database');
        }

        const kolJson = await kolRes.json();
        if (active && kolJson && kolJson.success && Array.isArray(kolJson.data)) {
          setCollections(kolJson.data);
        }

        if (active && opsiRes && opsiRes.ok) {
          const opsiJson = await opsiRes.json();
          if (opsiJson && opsiJson.success && opsiJson.data) {
            if (Array.isArray(opsiJson.data.kategori)) {
              setDbCategories(opsiJson.data.kategori);
            }
            if (Array.isArray(opsiJson.data.pengarang)) {
              setDbAuthors(opsiJson.data.pengarang);
            }
            if (Array.isArray(opsiJson.data.penerbit)) {
              setDbPublishers(opsiJson.data.penerbit);
            }
            if (opsiJson.data.next_id_koleksi) {
              setDbNextBookId(Number(opsiJson.data.next_id_koleksi));
            }
          }
        }
      } catch (err) {
        if (active) {
          console.error('Error fetching collections from DB:', err);
          setCollectionError(err.message || 'Gagal terhubung ke server database');
        }
      } finally {
        if (active) {
          setIsLoadingCollections(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Helper menyinkronkan opsi kategori, penulis, dan penerbit lokal setelah tambah/edit/import
  const syncOptionsWithBooks = (booksArray) => {
    const newCats = [];
    const newAuthors = [];
    const newPubs = [];

    for (const b of booksArray) {
      if (b.kategori && !dbCategories.includes(b.kategori) && !newCats.includes(b.kategori)) {
        newCats.push(b.kategori);
      }
      if (b.penerbit && !dbPublishers.includes(b.penerbit) && !newPubs.includes(b.penerbit)) {
        newPubs.push(b.penerbit);
      }
      if (b.pengarang) {
        const splitAuthors = String(b.pengarang)
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean);
        for (const a of splitAuthors) {
          if (!dbAuthors.includes(a) && !newAuthors.includes(a)) {
            newAuthors.push(a);
          }
        }
      }
    }

    if (newCats.length > 0) setDbCategories((prev) => Array.from(new Set([...prev, ...newCats])));
    if (newAuthors.length > 0) setDbAuthors((prev) => Array.from(new Set([...prev, ...newAuthors])));
    if (newPubs.length > 0) setDbPublishers((prev) => Array.from(new Set([...prev, ...newPubs])));
  };

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
    aturPengenalSementara(user.pengenal); // bypass auth sementara, lihat services/apiClient.js
    setCurrentUser(user);
    setActiveMenu(getDefaultMenuForRole(user.role));
    setIsSidebarOpen(false);
    fetchCollectionsFromDb();
  };

  // Logout Handler
  const handleLogout = () => {
    aturPengenalSementara(null);
    setCurrentUser(null);
    setIsSidebarOpen(false);
  };

  // Collection Handlers (Terhubung ke Database via REST API)
  const handleAddCollection = async (newBookPayload) => {
    const res = await fetch('/api/koleksi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pengenal': currentUser?.pengenal ?? '',
      },
      body: JSON.stringify(newBookPayload),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json?.error?.message || json?.message || 'Gagal menyimpan koleksi ke database');
    }

    const createdBook = json.data;
    setCollections((prev) => [createdBook, ...prev]);
    if (createdBook?.id_koleksi) {
      setDbNextBookId((prev) => Math.max(prev, Number(createdBook.id_koleksi) + 1));
    }
    syncOptionsWithBooks([createdBook]);
    return createdBook;
  };

  const handleImportCollections = async (itemsArray) => {
    const res = await fetch('/api/koleksi/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pengenal': currentUser?.pengenal ?? '',
      },
      body: JSON.stringify({ items: itemsArray }),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json?.error?.message || json?.message || 'Gagal mengimport koleksi ke database');
    }

    const importedBooks = Array.isArray(json.data) ? json.data : [];
    setCollections(importedBooks);
    const maxImportedId = importedBooks.reduce(
      (max, b) => Math.max(max, Number(b.id_koleksi) || 0),
      0
    );
    if (maxImportedId > 0) {
      setDbNextBookId((prev) => Math.max(prev, maxImportedId + 1));
    }
    syncOptionsWithBooks(importedBooks);
    return importedBooks;
  };

  const handleUpdateCollection = async (updatedBookPayload) => {
    const res = await fetch(`/api/koleksi/${updatedBookPayload.id_koleksi}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-pengenal': currentUser?.pengenal ?? '',
      },
      body: JSON.stringify(updatedBookPayload),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json?.error?.message || json?.message || 'Gagal memperbarui koleksi di database');
    }

    const updatedBook = json.data;
    setCollections((prev) =>
      prev.map((b) =>
        b.id_koleksi === updatedBook.id_koleksi ? updatedBook : b
      )
    );
    syncOptionsWithBooks([updatedBook]);
    return updatedBook;
  };

  const handleDeleteCollection = async (id_koleksi) => {
    const res = await fetch(`/api/koleksi/${id_koleksi}`, {
      method: 'DELETE',
      headers: {
        'x-pengenal': currentUser?.pengenal ?? '',
      },
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json?.error?.message || json?.message || 'Gagal menghapus koleksi dari database');
    }

    setCollections((prev) => prev.filter((b) => b.id_koleksi !== id_koleksi));
    return json.data;
  };

  // Loan Handlers
  const handleReturnLoan = async (id_peminjaman) => {
    const returnedLoan = await kembalikanPeminjaman(currentUser?.pengenal, id_peminjaman);

    setLoans((sebelum) =>
      sebelum.map((l) =>
        l.id_peminjaman === id_peminjaman
          ? { ...l, status: 'SELESAI', denda: 0, status_denda: 'LUNAS' }
          : l,
      ),
    );

    setCollections((sebelum) =>
      sebelum.map((b) => {
        if (b.judul === returnedLoan.koleksi?.judul) {
          return { ...b, stok_tersedia: Math.min(b.stok_tersedia + 1, b.total_stok) };
        }
        return b;
      }),
    );

    return returnedLoan;
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
              dbCategories={dbCategories}
              isLoadingCollections={isLoadingCollections}
              collectionError={collectionError}
              onRefreshCollections={fetchCollectionsFromDb}
              loans={loans}
            />
          )}

          {currentUser.role === 'Pustakawan' && (
            <PustakawanPage
              activeMenu={activeMenu}
              currentUser={currentUser}
              collections={collections}
              dbCategories={dbCategories}
              dbAuthors={dbAuthors}
              dbPublishers={dbPublishers}
              nextBookId={dbNextBookId}
              isLoadingCollections={isLoadingCollections}
              collectionError={collectionError}
              onRefreshCollections={fetchCollectionsFromDb}
              onAddCollection={handleAddCollection}
              onImportCollections={handleImportCollections}
              onUpdateCollection={handleUpdateCollection}
              onDeleteCollection={handleDeleteCollection}
              loans={loans}
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
              currentUser={currentUser}
              onSelectMenu={setActiveMenu}
              configurations={configurations}
              onUpdateConfig={handleUpdateConfig}
            />
          )}
        </main>
      </div>
    </div>
  );
}
