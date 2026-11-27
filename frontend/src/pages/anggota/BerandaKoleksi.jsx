import { useState } from 'react';
import Modal from '../../components/Modal.jsx';
import BookCover from '../../components/BookCover.jsx';

const ITEMS_PER_PAGE = 15; // Maksimal 15 buku per halaman untuk Beranda Anggota

export default function BerandaKoleksi({
  collections = [],
  dbCategories = [],
  isLoadingCollections = false,
  collectionError = null,
  onRefreshCollections,
  loans = [],
  onAddToCart,
}) {
  // State Pencarian Multi-Kriteria (Identik dengan Katalog Pustakawan)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBy, setSearchBy] = useState('all'); // 'all' | 'judul' | 'penulis' | 'isbn' | 'penerbit' | 'kategori'
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // State Pagination (Maksimal 15 buku per halaman)
  const [currentPage, setCurrentPage] = useState(1);

  // State Detail Modal Buku
  const [selectedBookForDetail, setSelectedBookForDetail] = useState(null);

  // Daftar kategori murni diambil dari Database (tabel kategori & koleksi di database)
  const allCategoryNames = Array.from(
    new Set([
      ...dbCategories,
      ...collections.map((item) => item.kategori).filter(Boolean),
    ])
  );
  const categories = ['Semua', ...allCategoryNames];

  // Logika Pencarian Multi-Kriteria & Pengurutan Buku Terbaru di Paling Atas (id_koleksi DESC)
  const filteredCollections = collections
    .filter((item) => {
      const query = searchQuery.trim().toLowerCase();

      // 1. Filter Kategori dari Dropdown / Modal
      const matchCategoryFilter =
        selectedCategory === 'Semua' || item.kategori === selectedCategory;

      // 2. Filter Ketersediaan Stok
      const matchAvailability = !onlyAvailable || item.stok_tersedia > 0;

      if (!query) {
        return matchCategoryFilter && matchAvailability;
      }

      // 3. Pencarian berdasarkan Kriteria yang Dipilih
      let matchQuery = false;
      if (searchBy === 'all') {
        matchQuery =
          (item.judul && item.judul.toLowerCase().includes(query)) ||
          (item.pengarang && item.pengarang.toLowerCase().includes(query)) ||
          (item.isbn && item.isbn.toLowerCase().includes(query)) ||
          (item.penerbit && item.penerbit.toLowerCase().includes(query)) ||
          (item.kategori && item.kategori.toLowerCase().includes(query)) ||
          (item.kode_koleksi && item.kode_koleksi.toLowerCase().includes(query)) ||
          (item.nomor_panggil && item.nomor_panggil.toLowerCase().includes(query));
      } else if (searchBy === 'judul') {
        matchQuery = item.judul && item.judul.toLowerCase().includes(query);
      } else if (searchBy === 'penulis') {
        matchQuery = item.pengarang && item.pengarang.toLowerCase().includes(query);
      } else if (searchBy === 'isbn') {
        matchQuery = item.isbn && item.isbn.toLowerCase().includes(query);
      } else if (searchBy === 'penerbit') {
        matchQuery = item.penerbit && item.penerbit.toLowerCase().includes(query);
      } else if (searchBy === 'kategori') {
        matchQuery = item.kategori && item.kategori.toLowerCase().includes(query);
      }

      return matchQuery && matchCategoryFilter && matchAvailability;
    })
    .sort((a, b) => (b.id_koleksi || 0) - (a.id_koleksi || 0));

  // Perhitungan Pagination (15 buku per halaman)
  const totalPages = Math.max(1, Math.ceil(filteredCollections.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedCollections = filteredCollections.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  return (
    <section className="catalog-section">
      {/* Header Halaman Anggota */}
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Katalog Koleksi Pustaka</h2>
          <p className="page-subtitle">
            Temukan buku teks, literatur ilmiah, novel, dan referensi akademik perpustakaan UNAND
          </p>
        </div>
        <div className="header-actions-group">
          {onRefreshCollections && (
            <button
              type="button"
              className="btn-outline-sm"
              onClick={onRefreshCollections}
              disabled={isLoadingCollections}
              title="Muat ulang data dari database"
            >
              {isLoadingCollections ? 'Memuat...' : 'Segarkan Katalog'}
            </button>
          )}
          {/* <div className="active-loans-badge">
            <span>Buku Dipinjam: </span>
            <strong>{loans.filter((l) => l.status !== 'SELESAI').length} / 3</strong>
          </div> */}
        </div>
      </div>

      {/* Bar Pencarian Multi-Kriteria & Filter (Sama seperti Katalog Pustakawan) */}
      <div className="search-filter-bar">
        {/* Dropdown Kriteria Pencarian: Judul, Penulis, ISBN, Penerbit, Kategori */}
        <div className="search-criteria-wrapper">
          <label htmlFor="anggota-search-criteria" className="search-criteria-label">
            Cari:
          </label>
          <select
            id="anggota-search-criteria"
            className="search-criteria-select"
            value={searchBy}
            onChange={(e) => {
              setSearchBy(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Semua Kriteria</option>
            <option value="judul">Judul Buku</option>
            <option value="penulis">Penulis / Pengarang</option>
            <option value="isbn">ISBN</option>
            <option value="penerbit">Penerbit</option>
            <option value="kategori">Kategori</option>
          </select>
        </div>

        {/* Input Kata Kunci Pencarian */}
        <div className="search-input-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            className="search-input"
            placeholder={
              searchBy === 'judul'
                ? 'Ketik judul buku...'
                : searchBy === 'penulis'
                ? 'Ketik nama penulis / pengarang...'
                : searchBy === 'isbn'
                ? 'Ketik nomor ISBN...'
                : searchBy === 'penerbit'
                ? 'Ketik nama penerbit...'
                : searchBy === 'kategori'
                ? 'Ketik kategori koleksi...'
                : 'Cari judul, penulis, ISBN, penerbit, atau kategori...'
            }
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              title="Bersihkan pencarian"
            >
              &times;
            </button>
          )}
        </div>

        {/* Tombol Trigger Filter Kategori (Sama seperti Pustakawan) */}
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
          <span>Kategori: {selectedCategory}</span>
          {onlyAvailable && <span className="filter-count-dot"></span>}
        </button>
      </div>

      {/* Info Status Filter Aktif (Sama seperti Pustakawan) */}
      {(searchQuery || selectedCategory !== 'Semua' || onlyAvailable || searchBy !== 'all') && (
        <div className="search-status-bar">
          <span>
            Menampilkan <strong>{filteredCollections.length}</strong> dari {collections.length} koleksi
            {searchQuery && (
              <> untuk pencarian &quot;<em>{searchQuery}</em>&quot; (berdasarkan {
                searchBy === 'all'
                  ? 'semua kriteria'
                  : searchBy === 'judul'
                  ? 'judul'
                  : searchBy === 'penulis'
                  ? 'penulis'
                  : searchBy === 'isbn'
                  ? 'ISBN'
                  : searchBy === 'penerbit'
                  ? 'penerbit'
                  : 'kategori'
              })</>
            )}
            {selectedCategory !== 'Semua' && (
              <> pada kategori &quot;<strong>{selectedCategory}</strong>&quot;</>
            )}
            {onlyAvailable && <> (hanya yang tersedia)</>}
          </span>
          <button
            type="button"
            className="btn-reset-filters"
            onClick={() => {
              setSearchQuery('');
              setSearchBy('all');
              setSelectedCategory('Semua');
              setOnlyAvailable(false);
              setCurrentPage(1);
            }}
          >
            Reset Semua Filter
          </button>
        </div>
      )}

      {/* Pesan Error Koneksi Database jika ada */}
      {collectionError && (
        <div className="search-status-bar" style={{ borderColor: '#fecaca', backgroundColor: '#fef2f2', color: '#991b1b' }}>
          <span>⚠️ {collectionError}</span>
          {onRefreshCollections && (
            <button type="button" className="btn-reset-filters" onClick={onRefreshCollections}>
              Coba Lagi
            </button>
          )}
        </div>
      )}

      {/* Grid Kartu Koleksi Buku (Maksimal 15 Buku per Halaman, Buku Terbaru di Paling Atas) */}
      <div className="collection-grid">
        {isLoadingCollections ? (
          <div className="empty-state-card">
            <p>Sedang memuat katalog koleksi dari database...</p>
          </div>
        ) : filteredCollections.length === 0 ? (
          <div className="empty-state-card">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            <p>Tidak ada koleksi buku yang cocok dengan kriteria pencarian.</p>
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => {
                setSearchQuery('');
                setSearchBy('all');
                setSelectedCategory('Semua');
                setOnlyAvailable(false);
                setCurrentPage(1);
              }}
            >
              Reset Pencarian
            </button>
          </div>
        ) : (
          paginatedCollections.map((book) => {
            const isReady = book.stok_tersedia > 0;
            return (
              <article key={book.id_koleksi} className="book-card book-card-with-cover">
                {/* Kontainer Sampul Buku */}
                <div
                  className="book-card-cover-wrapper"
                  onClick={() => setSelectedBookForDetail(book)}
                  title="Klik untuk melihat sinopsis & detail"
                >
                  <BookCover
                    src={book.sampul}
                    title={book.judul}
                    author={book.pengarang}
                    category={book.kategori}
                    size="md"
                  />
                </div>

                {/* Konten Metadata Buku */}
                <div className="book-card-content">
                  <div className="book-card-top">
                    <span className="book-category-tag">{book.kategori}</span>
                    <span className={`stock-status-pill ${isReady ? 'available' : 'borrowed'}`}>
                      {isReady ? `Tersedia (${book.stok_tersedia})` : 'Dipinjam Penuh'}
                    </span>
                  </div>

                  <h3
                    className="book-title hover-link"
                    onClick={() => setSelectedBookForDetail(book)}
                  >
                    {book.judul}
                  </h3>
                  <p className="book-author">Oleh: <strong>{book.pengarang}</strong></p>

                  <div className="book-meta-list">
                    <div className="meta-item">
                      <span className="meta-label">Penerbit:</span>
                      <span className="meta-val">
                        {book.penerbit || '-'} {book.tahun_terbit ? `(${book.tahun_terbit})` : ''}
                      </span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">ISBN:</span>
                      <span className="meta-val">{book.isbn || '-'}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Lokasi Rak:</span>
                      <span className="meta-val text-green-bold">{book.lokasi_rak || '-'}</span>
                    </div>
                  </div>

                  <div className="book-card-actions">
                    <button
                      type="button"
                      className="btn-outline-sm btn-detail-trigger"
                      onClick={() => setSelectedBookForDetail(book)}
                    >
                      Detail
                    </button>
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
                      <span>{isReady ? 'Pinjam Mandiri' : 'Habis Dipinjam'}</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {/* Bar Navigasi Halaman (Pagination - Maksimal 15 Buku per Halaman) */}
      {!isLoadingCollections && filteredCollections.length > 0 && (
        <div className="pagination-bar">
          <span className="pagination-info">
            Menampilkan <strong>{startIndex + 1}</strong>–
            <strong>{Math.min(startIndex + ITEMS_PER_PAGE, filteredCollections.length)}</strong> dari{' '}
            <strong>{filteredCollections.length}</strong> buku (Halaman {safeCurrentPage} dari {totalPages})
          </span>

          <div className="pagination-controls">
            <button
              type="button"
              className="pagination-btn"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              &laquo; Sebelumnya
            </button>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
              <button
                key={pageNum}
                type="button"
                className={`pagination-btn ${safeCurrentPage === pageNum ? 'active' : ''}`}
                onClick={() => setCurrentPage(pageNum)}
              >
                {pageNum}
              </button>
            ))}

            <button
              type="button"
              className="pagination-btn"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              Selanjutnya &raquo;
            </button>
          </div>
        </div>
      )}

      {/* Modal Detail Buku untuk Anggota */}
      <Modal
        isOpen={!!selectedBookForDetail}
        title="Informasi Koleksi Buku"
        size="lg"
        onClose={() => setSelectedBookForDetail(null)}
      >
        {selectedBookForDetail && (
          <div className="book-detail-container">
            <div className="book-detail-header-row">
              <div className="book-detail-cover">
                <BookCover
                  src={selectedBookForDetail.sampul}
                  title={selectedBookForDetail.judul}
                  author={selectedBookForDetail.pengarang}
                  category={selectedBookForDetail.kategori}
                  size="lg"
                />
              </div>

              <div className="book-detail-meta-group">
                <div className="book-detail-badge-row">
                  <span className="code-pill">{selectedBookForDetail.kode_koleksi}</span>
                  <span className="category-badge">{selectedBookForDetail.kategori}</span>
                  <span
                    className={`stock-pill ${
                      selectedBookForDetail.stok_tersedia > 0 ? 'in-stock' : 'out-stock'
                    }`}
                  >
                    {selectedBookForDetail.stok_tersedia > 0
                      ? `${selectedBookForDetail.stok_tersedia} dari ${selectedBookForDetail.total_stok} Eksemplar Tersedia`
                      : 'Sedang Habis Dipinjam'}
                  </span>
                </div>

                <h3 className="book-detail-title">{selectedBookForDetail.judul}</h3>
                <p className="book-detail-author">
                  Penulis: <strong>{selectedBookForDetail.pengarang}</strong>
                </p>

                <div className="book-detail-grid">
                  <div className="detail-meta-cell">
                    <span className="detail-meta-label">Penerbit</span>
                    <strong className="detail-meta-val">{selectedBookForDetail.penerbit || '-'}</strong>
                  </div>
                  <div className="detail-meta-cell">
                    <span className="detail-meta-label">Tahun Terbit</span>
                    <strong className="detail-meta-val">{selectedBookForDetail.tahun_terbit || '-'}</strong>
                  </div>
                  <div className="detail-meta-cell">
                    <span className="detail-meta-label">ISBN</span>
                    <strong className="detail-meta-val">{selectedBookForDetail.isbn || '-'}</strong>
                  </div>
                  <div className="detail-meta-cell">
                    <span className="detail-meta-label">Nomor Panggil</span>
                    <strong className="detail-meta-val">{selectedBookForDetail.nomor_panggil || '-'}</strong>
                  </div>
                  <div className="detail-meta-cell">
                    <span className="detail-meta-label">Lokasi Rak</span>
                    <strong className="detail-meta-val text-green-bold">{selectedBookForDetail.lokasi_rak || '-'}</strong>
                  </div>
                  <div className="detail-meta-cell">
                    <span className="detail-meta-label">Bahasa &amp; Edisi</span>
                    <strong className="detail-meta-val">
                      {selectedBookForDetail.bahasa || 'Indonesia'} {selectedBookForDetail.edisi ? `(${selectedBookForDetail.edisi})` : ''}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {selectedBookForDetail.deskripsi && (
              <div className="book-detail-desc-box">
                <h4 className="desc-heading">Sinopsis &amp; Pokok Bahasan</h4>
                <p className="desc-text">{selectedBookForDetail.deskripsi}</p>
              </div>
            )}

            {Array.isArray(selectedBookForDetail.eksemplar) &&
              selectedBookForDetail.eksemplar.length > 0 && (
                <div className="book-detail-desc-box">
                  <h4 className="desc-heading">
                    Daftar Kode Eksemplar ({selectedBookForDetail.eksemplar.length} Eksemplar)
                  </h4>
                  <div className="eksemplar-table-wrapper">
                    <table className="eksemplar-input-table">
                      <thead>
                        <tr>
                          <th style={{ width: '50px' }}>No</th>
                          <th>Kode Eksemplar</th>
                          <th>Lokasi Rak</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedBookForDetail.eksemplar.map((eks, idx) => (
                          <tr key={eks.id_eksemplar || idx}>
                            <td>{idx + 1}</td>
                            <td>
                              <strong className="code-pill">{eks.kode_eksemplar}</strong>
                            </td>
                            <td>
                              <span className="rak-badge">{eks.lokasi_rak || '-'}</span>
                            </td>
                            <td>
                              <span
                                className={`stock-pill ${
                                  eks.status === 'TERSEDIA' ? 'in-stock' : 'out-stock'
                                }`}
                              >
                                {eks.status || 'TERSEDIA'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            <div className="modal-actions-row">
              <button
                type="button"
                className="btn-outline-sm"
                onClick={() => setSelectedBookForDetail(null)}
              >
                Tutup
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={selectedBookForDetail.stok_tersedia <= 0}
                onClick={() => {
                  onAddToCart(selectedBookForDetail);
                  setSelectedBookForDetail(null);
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>
                  {selectedBookForDetail.stok_tersedia > 0
                    ? 'Pinjam Mandiri Sekarang'
                    : 'Stok Tidak Tersedia'}
                </span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Filter Kategori & Ketersediaan */}
      <Modal
        isOpen={isFilterModalOpen}
        title="Filter Kategori Koleksi"
        onClose={() => setIsFilterModalOpen(false)}
      >
        <div className="filter-modal-content">
          <div className="form-group">
            <label className="form-label">Pilih Kategori:</label>
            <select
              className="form-control"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
                setIsFilterModalOpen(false);
              }}
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
                onChange={(e) => {
                  setOnlyAvailable(e.target.checked);
                  setCurrentPage(1);
                }}
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
                setCurrentPage(1);
                setIsFilterModalOpen(false);
              }}
            >
              Reset Kategori
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setIsFilterModalOpen(false)}
            >
              Tutup
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
