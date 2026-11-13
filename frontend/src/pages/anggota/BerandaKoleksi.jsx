import { useState } from 'react';
import Modal from '../../components/Modal.jsx';

export default function BerandaKoleksi({
  collections,
  loans,
  onAddToCart,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const categories = [
    'Semua',
    ...new Set(collections.map((item) => item.kategori)),
  ];

  const filteredCollections = collections.filter((item) => {
    const matchQuery =
      item.judul.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.pengarang.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.kode_koleksi.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.isbn.toLowerCase().includes(searchQuery.toLowerCase());

    const matchCategory =
      selectedCategory === 'Semua' || item.kategori === selectedCategory;

    const matchAvailability = !onlyAvailable || item.stok_tersedia > 0;

    return matchQuery && matchCategory && matchAvailability;
  });

  return (
    <section className="catalog-section">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Daftar Koleksi Pustaka</h2>
          <p className="page-subtitle">
            Temukan buku teks, literatur ilmiah, novel, dan referensi akademik UNAND
          </p>
        </div>
        <div className="active-loans-badge">
          <span>Buku Dipinjam: </span>
          <strong>{loans.filter((l) => l.status !== 'SELESAI').length} / 3</strong>
        </div>
      </div>

      {/* Kolom Pencarian & Tombol Filter */}
      <div className="search-filter-bar">
        <div className="search-input-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder="Cari judul buku, pengarang, ISBN, atau kode..."
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
            selectedCategory !== 'Semua' || onlyAvailable ? 'has-active-filter' : ''
          }`}
          onClick={() => setIsFilterModalOpen(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
          </svg>
          <span>Filter</span>
          {(selectedCategory !== 'Semua' || onlyAvailable) && (
            <span className="filter-count-dot"></span>
          )}
        </button>
      </div>

      {/* Chip Kategori Cepat */}
      <div className="category-chips-row">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`category-chip ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid Kartu Koleksi */}
      <div className="collection-grid">
        {filteredCollections.length === 0 ? (
          <div className="empty-state-card">
            <p>Tidak ada koleksi buku yang cocok dengan kriteria pencarian.</p>
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('Semua');
                setOnlyAvailable(false);
              }}
            >
              Reset Filter
            </button>
          </div>
        ) : (
          filteredCollections.map((book) => {
            const isReady = book.stok_tersedia > 0;
            return (
              <article key={book.id_koleksi} className="book-card">
                <div className="book-card-top">
                  <span className="book-category-tag">{book.kategori}</span>
                  <span className={`stock-status-pill ${isReady ? 'available' : 'borrowed'}`}>
                    {isReady ? `Tersedia (${book.stok_tersedia})` : 'Dipinjam Penuh'}
                  </span>
                </div>

                <h3 className="book-title">{book.judul}</h3>
                <p className="book-author">Oleh: {book.pengarang}</p>

                <div className="book-meta-list">
                  <div className="meta-item">
                    <span className="meta-label">Nomor Panggil:</span>
                    <span className="meta-val">{book.nomor_panggil}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Lokasi Rak:</span>
                    <span className="meta-val text-green-bold">{book.lokasi_rak}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Tahun:</span>
                    <span className="meta-val">{book.tahun_terbit} ({book.bahasa})</span>
                  </div>
                </div>

                <div className="book-card-actions">
                  <button
                    type="button"
                    className="btn-action-primary"
                    onClick={() => onAddToCart(book)}
                    disabled={!isReady}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span>Pinjam Mandiri</span>
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Modal Filter */}
      <Modal
        isOpen={isFilterModalOpen}
        title="Filter Koleksi Perpustakaan"
        onClose={() => setIsFilterModalOpen(false)}
      >
        <div className="filter-modal-content">
          <div className="form-group">
            <label className="form-label">Kategori Subjek:</label>
            <select
              className="form-control"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
              />
              <span className="checkbox-label">
                Hanya tampilkan buku yang sedang tersedia (stok &gt; 0)
              </span>
            </label>
          </div>

          <div className="modal-actions-row">
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => {
                setSelectedCategory('Semua');
                setOnlyAvailable(false);
              }}
            >
              Reset
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setIsFilterModalOpen(false)}
            >
              Terapkan Filter
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

