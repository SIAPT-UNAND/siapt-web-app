import { useState } from 'react';
import Modal from '../../components/Modal.jsx';

export default function DaftarKoleksi({
  collections,
  onAddCollection,
  onUpdateCollection,
  onDeleteCollection,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

  const [bookForm, setBookForm] = useState({
    judul: '',
    pengarang: '',
    kategori: 'Ilmu Komputer',
    penerbit: '',
    tahun_terbit: new Date().getFullYear(),
    isbn: '',
    nomor_panggil: '',
    bahasa: 'Indonesia',
    lokasi_rak: '',
    total_stok: 1,
  });

  const categories = [
    'Semua',
    'Ilmu Komputer',
    'Sastra & Fiksi',
    'Sains & Data',
    'Sosial & Humaniora',
    'Teknik & Rekayasa',
  ];

  const filteredCollections = collections.filter((item) => {
    const matchQuery =
      item.judul.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.pengarang.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.kode_koleksi.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.isbn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.nomor_panggil.toLowerCase().includes(searchQuery.toLowerCase());

    const matchCategory =
      selectedCategory === 'Semua' || item.kategori === selectedCategory;

    return matchQuery && matchCategory;
  });

  const handleOpenAddModal = () => {
    setBookForm({
      judul: '',
      pengarang: '',
      kategori: 'Ilmu Komputer',
      penerbit: '',
      tahun_terbit: new Date().getFullYear(),
      isbn: '',
      nomor_panggil: '',
      bahasa: 'Indonesia',
      lokasi_rak: 'RAK-01',
      total_stok: 1,
    });
    setIsAddModalOpen(true);
  };

  const handleSubmitAdd = (e) => {
    e.preventDefault();
    if (!bookForm.judul.trim() || !bookForm.pengarang.trim()) {
      alert('Judul dan pengarang wajib diisi.');
      return;
    }
    const newBook = {
      id_koleksi: Date.now(),
      kode_koleksi: `KOL-${Date.now().toString().slice(-4)}`,
      ...bookForm,
      stok_tersedia: Number(bookForm.total_stok),
      total_stok: Number(bookForm.total_stok),
      status_aktif: true,
    };
    onAddCollection(newBook);
    setIsAddModalOpen(false);
  };

  const handleOpenEditModal = (book) => {
    setSelectedBook(book);
    setBookForm({
      judul: book.judul,
      pengarang: book.pengarang,
      kategori: book.kategori,
      penerbit: book.penerbit,
      tahun_terbit: book.tahun_terbit,
      isbn: book.isbn,
      nomor_panggil: book.nomor_panggil,
      bahasa: book.bahasa,
      lokasi_rak: book.lokasi_rak,
      total_stok: book.total_stok,
    });
    setIsEditModalOpen(true);
  };

  const handleSubmitEdit = (e) => {
    e.preventDefault();
    if (!selectedBook) return;

    onUpdateCollection({
      ...selectedBook,
      ...bookForm,
      total_stok: Number(bookForm.total_stok),
    });
    setIsEditModalOpen(false);
  };

  const handleOpenDeleteModal = (book) => {
    setSelectedBook(book);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedBook) {
      onDeleteCollection(selectedBook.id_koleksi);
      setIsDeleteModalOpen(false);
    }
  };

  return (
    <section className="pustakawan-koleksi-section">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Manajemen Koleksi Pustaka</h2>
          <p className="page-subtitle">
            Kelola katalog fisik, inventaris rak, dan ketersediaan koleksi perpustakaan UNAND
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={handleOpenAddModal}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>+ Tambah Koleksi</span>
        </button>
      </div>

      {/* Bar Kontrol: Cari Koleksi & Tombol Filter */}
      <div className="search-filter-bar">
        <div className="search-input-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Cari judul, pengarang, no panggil, atau ISBN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchQuery('')}
            >
              &times;
            </button>
          )}
        </div>

        <button
          type="button"
          className={`btn-filter-trigger ${
            selectedCategory !== 'Semua' ? 'has-active-filter' : ''
          }`}
          onClick={() => setIsFilterModalOpen(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          <span>Filter ({selectedCategory})</span>
        </button>
      </div>

      {/* Tabel Manajemen Koleksi */}
      <div className="table-responsive-wrapper">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Kode &amp; Judul Koleksi</th>
              <th>Pengarang &amp; Penerbit</th>
              <th>Kategori</th>
              <th>Rak</th>
              <th>Stok</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filteredCollections.length === 0 ? (
              <tr>
                <td colSpan="6" className="text-center py-6">
                  Tidak ada koleksi buku yang cocok.
                </td>
              </tr>
            ) : (
              filteredCollections.map((item) => (
                <tr key={item.id_koleksi}>
                  <td>
                    <div className="table-title-cell">
                      <span className="code-pill">{item.kode_koleksi}</span>
                      <strong className="table-main-text">{item.judul}</strong>
                      <span className="table-sub-text">
                        ISBN: {item.isbn} • {item.nomor_panggil}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="table-author-cell">
                      <span>{item.pengarang}</span>
                      <span className="table-sub-text">
                        {item.penerbit} ({item.tahun_terbit})
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="category-badge">{item.kategori}</span>
                  </td>
                  <td>
                    <span className="rak-badge">{item.lokasi_rak}</span>
                  </td>
                  <td>
                    <span
                      className={`stock-pill ${
                        item.stok_tersedia > 0 ? 'in-stock' : 'out-stock'
                      }`}
                    >
                      {item.stok_tersedia} / {item.total_stok}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="action-buttons-inline">
                      <button
                        type="button"
                        className="btn-action-edit"
                        onClick={() => handleOpenEditModal(item)}
                        title="Edit Koleksi"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        className="btn-action-delete"
                        onClick={() => handleOpenDeleteModal(item)}
                        title="Hapus Koleksi"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        <span>Hapus</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Filter Koleksi */}
      <Modal
        isOpen={isFilterModalOpen}
        title="Filter Koleksi Pustakawan"
        onClose={() => setIsFilterModalOpen(false)}
      >
        <div className="form-group">
          <label className="form-label">Kategori Koleksi:</label>
          <select
            className="form-control"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="modal-actions-row">
          <button
            type="button"
            className="btn-outline-sm"
            onClick={() => setSelectedCategory('Semua')}
          >
            Reset
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setIsFilterModalOpen(false)}
          >
            Tutup
          </button>
        </div>
      </Modal>

      {/* Modal Tambah Koleksi */}
      <Modal
        isOpen={isAddModalOpen}
        title="Tambah Koleksi Buku Baru"
        onClose={() => setIsAddModalOpen(false)}
      >
        <form onSubmit={handleSubmitAdd} className="modal-form">
          <div className="form-group">
            <label className="form-label">Judul Buku *</label>
            <input
              type="text"
              className="form-control"
              value={bookForm.judul}
              onChange={(e) => setBookForm({ ...bookForm, judul: e.target.value })}
              required
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Pengarang *</label>
              <input
                type="text"
                className="form-control"
                value={bookForm.pengarang}
                onChange={(e) => setBookForm({ ...bookForm, pengarang: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Kategori *</label>
              <select
                className="form-control"
                value={bookForm.kategori}
                onChange={(e) => setBookForm({ ...bookForm, kategori: e.target.value })}
              >
                {categories.filter((c) => c !== 'Semua').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">ISBN</label>
              <input
                type="text"
                className="form-control"
                value={bookForm.isbn}
                onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Nomor Panggil</label>
              <input
                type="text"
                className="form-control"
                placeholder="005.1 XXX x"
                value={bookForm.nomor_panggil}
                onChange={(e) => setBookForm({ ...bookForm, nomor_panggil: e.target.value })}
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Lokasi Rak</label>
              <input
                type="text"
                className="form-control"
                placeholder="Contoh: RAK-CS-01"
                value={bookForm.lokasi_rak}
                onChange={(e) => setBookForm({ ...bookForm, lokasi_rak: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Jumlah Eksemplar</label>
              <input
                type="number"
                min="1"
                max="50"
                className="form-control"
                value={bookForm.total_stok}
                onChange={(e) => setBookForm({ ...bookForm, total_stok: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-actions-row">
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => setIsAddModalOpen(false)}
            >
              Batal
            </button>
            <button type="submit" className="btn-primary">
              Simpan Koleksi
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit Koleksi */}
      <Modal
        isOpen={isEditModalOpen}
        title="Edit Data Koleksi"
        onClose={() => setIsEditModalOpen(false)}
      >
        <form onSubmit={handleSubmitEdit} className="modal-form">
          <div className="form-group">
            <label className="form-label">Judul Buku *</label>
            <input
              type="text"
              className="form-control"
              value={bookForm.judul}
              onChange={(e) => setBookForm({ ...bookForm, judul: e.target.value })}
              required
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Pengarang *</label>
              <input
                type="text"
                className="form-control"
                value={bookForm.pengarang}
                onChange={(e) => setBookForm({ ...bookForm, pengarang: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Kategori *</label>
              <select
                className="form-control"
                value={bookForm.kategori}
                onChange={(e) => setBookForm({ ...bookForm, kategori: e.target.value })}
              >
                {categories.filter((c) => c !== 'Semua').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">Lokasi Rak</label>
              <input
                type="text"
                className="form-control"
                value={bookForm.lokasi_rak}
                onChange={(e) => setBookForm({ ...bookForm, lokasi_rak: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Total Stok</label>
              <input
                type="number"
                min="1"
                className="form-control"
                value={bookForm.total_stok}
                onChange={(e) => setBookForm({ ...bookForm, total_stok: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-actions-row">
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => setIsEditModalOpen(false)}
            >
              Batal
            </button>
            <button type="submit" className="btn-primary">
              Simpan Perubahan
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Hapus Koleksi */}
      <Modal
        isOpen={isDeleteModalOpen}
        title="Konfirmasi Hapus Koleksi"
        onClose={() => setIsDeleteModalOpen(false)}
      >
        <div className="confirm-delete-box">
          <p>
            Apakah Anda yakin ingin menghapus buku{' '}
            <strong>&quot;{selectedBook?.judul}&quot;</strong> ({selectedBook?.kode_koleksi}) dari sistem perpustakaan?
          </p>
          <p className="text-warning-sm">
            Tindakan ini tidak dapat dibatalkan dan akan menghapus seluruh data eksemplar terkait.
          </p>

          <div className="modal-actions-row">
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={handleConfirmDelete}
            >
              Ya, Hapus Koleksi
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

