import { useState, useRef } from 'react';
import Modal from '../../components/Modal.jsx';
import BookCover from '../../components/BookCover.jsx';
import { compressImageToWebp } from '../../utils/imageCompressor.js';
import {
  EXCEL_TEMPLATE_COLUMNS,
  OPTIONAL_EXCEL_COLUMNS,
  parseExcelFile,
  downloadExcelTemplate,
  exportCollectionsToExcel,
} from '../../utils/excelHelper.js';

const ITEMS_PER_PAGE = 10; // Maksimal 10 buku per halaman untuk Katalog Pustakawan

export default function DaftarKoleksi({
  collections = [],
  dbCategories = [],
  dbAuthors = [],
  dbPublishers = [],
  isLoadingCollections = false,
  collectionError = null,
  onRefreshCollections,
  onAddCollection,
  onImportCollections,
  onUpdateCollection,
  onDeleteCollection,
}) {
  // State Pencarian & Filter Katalog
  const [searchQuery, setSearchQuery] = useState('');
  const [searchBy, setSearchBy] = useState('all'); // 'all' | 'judul' | 'penulis' | 'isbn' | 'penerbit' | 'kategori'
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // State Pagination (Maksimal 10 buku per halaman)
  const [currentPage, setCurrentPage] = useState(1);

  // State Modal Aksi
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

  // State Autocomplete Search Penulis & Penerbit di Form Tambah/Edit
  const [showAuthorDropdown, setShowAuthorDropdown] = useState(false);
  const [showPublisherDropdown, setShowPublisherDropdown] = useState(false);

  // State Proses Simpan / Kompresi Gambar
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [coverMeta, setCoverMeta] = useState(null);

  // State Import Excel
  const [importFileName, setImportFileName] = useState('');
  const [importPreviewRows, setImportPreviewRows] = useState([]);
  const [importConflicts, setImportConflicts] = useState([]);
  const [importError, setImportError] = useState('');
  const [isParsingExcel, setIsParsingExcel] = useState(false);

  // State Pesan Error di dalam Modal Tambah/Edit & Pop-up Notifikasi Berhasil/Gagal
  const [formModalError, setFormModalError] = useState('');
  const [feedbackModal, setFeedbackModal] = useState({
    isOpen: false,
    type: 'success', // 'success' | 'error'
    title: '',
    message: '',
  });

  // State Generator Kode Eksemplar Berdasarkan Jumlah Buku Baru
  const [generateBookCount, setGenerateBookCount] = useState(1);
  const [generateDefaultRak, setGenerateDefaultRak] = useState('');

  // Refs input file
  const addFileInputRef = useRef(null);
  const editFileInputRef = useRef(null);
  const excelFileInputRef = useRef(null);

  // Daftar kategori murni diambil dari Database (tabel kategori & koleksi di database)
  const allCategoryNames = Array.from(
    new Set([
      ...dbCategories,
      ...collections.map((item) => item.kategori).filter(Boolean),
    ])
  );
  const categories = ['Semua', ...allCategoryNames];

  // Gabungkan daftar seluruh Penulis yang ada di Database & Koleksi
  const allKnownAuthors = Array.from(
    new Set([
      ...dbAuthors,
      ...collections.flatMap((item) =>
        (item.pengarang || '')
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean)
      ),
    ])
  ).sort((a, b) => a.localeCompare(b));

  // Gabungkan daftar seluruh Penerbit yang ada di Database & Koleksi
  const allKnownPublishers = Array.from(
    new Set([
      ...dbPublishers,
      ...collections
        .map((item) => (item.penerbit || '').trim())
        .filter(Boolean),
    ])
  ).sort((a, b) => a.localeCompare(b));

  // Form State (Eksemplar dihitung berdasarkan daftar kode_eksemplar yang dimasukkan)
  const initialFormState = {
    judul: '',
    pengarang: '',
    kategori: allCategoryNames[0] || 'Ilmu Komputer & Sistem Informasi',
    penerbit: '',
    tahun_terbit: new Date().getFullYear(),
    isbn: '',
    nomor_panggil: '',
    edisi: '',
    bahasa: 'Indonesia',
    deskripsi: '',
    sampul: '',
    eksemplar: [
      {
        kode_eksemplar: '',
        lokasi_rak: '',
        status: 'TERSEDIA',
      },
    ],
  };

  const [bookForm, setBookForm] = useState(initialFormState);

  // =========================================================================
  // LOGIKA MANAJEMEN BARIS TABEL KODE EKSEMPLAR DI MODAL TAMBAH & EDIT
  // =========================================================================
  const handleAddEksemplarRow = () => {
    setBookForm((prev) => {
      const currentList = Array.isArray(prev.eksemplar) ? prev.eksemplar : [];
      const lastRak =
        currentList.length > 0
          ? currentList[currentList.length - 1].lokasi_rak || ''
          : '';
      return {
        ...prev,
        eksemplar: [
          ...currentList,
          {
            kode_eksemplar: '',
            lokasi_rak: lastRak,
            status: 'TERSEDIA',
          },
        ],
      };
    });
  };

  const handleUpdateEksemplarRow = (index, field, value) => {
    setBookForm((prev) => {
      const currentList = Array.isArray(prev.eksemplar) ? [...prev.eksemplar] : [];
      currentList[index] = {
        ...currentList[index],
        [field]: value,
        isAutoGenerated: field === 'kode_eksemplar' ? false : currentList[index]?.isAutoGenerated,
      };
      return {
        ...prev,
        eksemplar: currentList,
      };
    });
  };

  const handleRemoveEksemplarRow = (index) => {
    setBookForm((prev) => {
      const currentList = Array.isArray(prev.eksemplar) ? prev.eksemplar : [];
      if (currentList.length <= 1) {
        // Jika hanya 1 baris, kosongkan isinya karena kode eksemplar dan lokasi rak bersifat opsional
        return {
          ...prev,
          eksemplar: [
            {
              kode_eksemplar: '',
              lokasi_rak: '',
              status: 'TERSEDIA',
            },
          ],
        };
      }
      return {
        ...prev,
        eksemplar: currentList.filter((_, idx) => idx !== index),
      };
    });
  };

  // Generate Kode Eksemplar Otomatis Berdasarkan Input Jumlah Buku (Untuk Buku Baru yang Belum Memiliki Kode Eksemplar)
  // Memastikan setiap kode yang di-generate unik dan tidak pernah sama dengan kode eksemplar yang sudah ada di database maupun di tabel form
  const handleGenerateEksemplarByCount = () => {
    const count = Math.max(1, Math.min(200, parseInt(generateBookCount, 10) || 1));
    const rakTarget = (generateDefaultRak || '').trim();

    // Kumpulkan seluruh kode_eksemplar yang sudah terdaftar di database dari seluruh koleksi
    const existingDbCodes = new Set(
      collections.flatMap((book) =>
        (Array.isArray(book.eksemplar) ? book.eksemplar : [])
          .map((e) => (e.kode_eksemplar || '').trim().toLowerCase())
          .filter(Boolean)
      )
    );

    setBookForm((prev) => {
      const currentList = Array.isArray(prev.eksemplar) ? prev.eksemplar : [];
      // Pertahankan baris yang sudah memiliki id_eksemplar (dari DB) atau yang diketik manual (bukan kosong & bukan auto-generated)
      const preservedManualRows = currentList.filter(
        (row) =>
          row.id_eksemplar ||
          (row.kode_eksemplar && row.kode_eksemplar.trim() !== '' && !row.isAutoGenerated)
      );

      // Masukkan juga kode yang sedang ada di form ke daftar pengecekan agar tidak bentrok
      const usedCodes = new Set(existingDbCodes);
      for (const r of preservedManualRows) {
        if (r.kode_eksemplar) {
          usedCodes.add(r.kode_eksemplar.trim().toLowerCase());
        }
      }

      const prefix = prev.judul
        ? prev.judul
            .replace(/[^a-zA-Z0-9]/g, '')
            .substring(0, 3)
            .toUpperCase() || 'BUK'
        : 'BUK';
      const stamp = Date.now().toString(36).slice(-4).toUpperCase();
      let seqCounter = preservedManualRows.length + 1;

      const generatedRows = [];
      for (let i = 1; i <= count; i++) {
        let candidateCode = '';
        // Pastikan kode kandidat belum pernah ada di database maupun di form saat ini
        do {
          const seq = String(seqCounter).padStart(2, '0');
          candidateCode = `EKS-${prefix}-${stamp}-${seq}`;
          seqCounter++;
        } while (usedCodes.has(candidateCode.toLowerCase()));

        usedCodes.add(candidateCode.toLowerCase());
        generatedRows.push({
          kode_eksemplar: candidateCode,
          lokasi_rak: rakTarget,
          status: 'TERSEDIA',
          isAutoGenerated: true,
        });
      }

      return {
        ...prev,
        eksemplar: [...preservedManualRows, ...generatedRows],
      };
    });
  };

  // =========================================================================
  // LOGIKA AUTOCOMPLETE SEARCH PENULIS (MULTI-PENULIS DIPISAHKAN KOMA) & PENERBIT
  // =========================================================================
  const rawAuthorSegments = (bookForm.pengarang || '').split(',');
  const endsWithComma = /,\s*$/.test(bookForm.pengarang || '');
  const currentAuthorSearchToken = endsWithComma
    ? ''
    : (rawAuthorSegments[rawAuthorSegments.length - 1] || '').trim();

  const parsedAuthorsList = rawAuthorSegments
    .map((s) => s.trim())
    .filter(Boolean);

  const filteredAuthorSuggestions = allKnownAuthors.filter((authorName) => {
    const lowerName = authorName.toLowerCase();
    const prevSelected = (endsWithComma ? parsedAuthorsList : parsedAuthorsList.slice(0, -1)).map(
      (a) => a.toLowerCase()
    );
    if (prevSelected.includes(lowerName)) return false;

    if (!currentAuthorSearchToken) return true;
    return lowerName.includes(currentAuthorSearchToken.toLowerCase());
  });

  const handleSelectAuthorSuggestion = (selectedAuthor) => {
    const segments = (bookForm.pengarang || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (segments.length === 0) {
      setBookForm((prev) => ({ ...prev, pengarang: `${selectedAuthor}, ` }));
    } else if (endsWithComma) {
      setBookForm((prev) => ({
        ...prev,
        pengarang: `${[...segments, selectedAuthor].join(', ')}, `,
      }));
    } else {
      const lastSeg = segments[segments.length - 1];
      const isLastSegExactKnown = allKnownAuthors.some(
        (a) =>
          a.toLowerCase() === lastSeg.toLowerCase() &&
          a.toLowerCase() !== selectedAuthor.toLowerCase()
      );
      if (isLastSegExactKnown) {
        setBookForm((prev) => ({
          ...prev,
          pengarang: `${[...segments, selectedAuthor].join(', ')}, `,
        }));
      } else {
        const updated = [...segments.slice(0, -1), selectedAuthor];
        setBookForm((prev) => ({
          ...prev,
          pengarang: `${updated.join(', ')}, `,
        }));
      }
    }
    setShowAuthorDropdown(false);
  };

  const handleRemoveAuthorTag = (authorToRemove) => {
    const remaining = parsedAuthorsList.filter(
      (a) => a.toLowerCase() !== authorToRemove.toLowerCase()
    );
    setBookForm((prev) => ({
      ...prev,
      pengarang: remaining.join(', '),
    }));
  };

  const publisherSearchToken = (bookForm.penerbit || '').trim();
  const filteredPublisherSuggestions = allKnownPublishers.filter((pub) => {
    if (!publisherSearchToken) return true;
    return pub.toLowerCase().includes(publisherSearchToken.toLowerCase());
  });

  const handleSelectPublisherSuggestion = (selectedPub) => {
    setBookForm((prev) => ({
      ...prev,
      penerbit: selectedPub,
    }));
    setShowPublisherDropdown(false);
  };

  // =========================================================================
  // LOGIKA PENCARIAN MULTI-KRITERIA KATALOG & PENGURUTAN BUKU TERBARU DI ATAS
  // =========================================================================
  const filteredCollections = collections
    .filter((item) => {
      const query = searchQuery.trim().toLowerCase();

      const matchCategoryFilter =
        selectedCategory === 'Semua' || item.kategori === selectedCategory;

      if (!query) {
        return matchCategoryFilter;
      }

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

      return matchQuery && matchCategoryFilter;
    })
    .sort((a, b) => (b.id_koleksi || 0) - (a.id_koleksi || 0));

  // Perhitungan Pagination (Maksimal 10 buku per halaman)
  const totalPages = Math.max(1, Math.ceil(filteredCollections.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedCollections = filteredCollections.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  // Handler Upload & Kompresi Sampul Buku menjadi WebP <= 100 KB
  const handleCoverFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    try {
      const compressed = await compressImageToWebp(file, 100);
      setBookForm((prev) => ({
        ...prev,
        sampul: compressed.dataUrl,
      }));
      setCoverMeta({
        sizeKB: compressed.sizeKB,
      });
    } catch (err) {
      alert(err.message || 'Gagal mengompresi gambar sampul.');
    } finally {
      setIsCompressing(false);
    }
  };

  // Handler Hapus Sampul
  const handleRemoveCover = (isEdit = false) => {
    setBookForm((prev) => ({
      ...prev,
      sampul: '',
    }));
    setCoverMeta(null);
    if (isEdit && editFileInputRef.current) {
      editFileInputRef.current.value = '';
    }
    if (!isEdit && addFileInputRef.current) {
      addFileInputRef.current.value = '';
    }
  };

  const normalizeAuthorInput = (str) =>
    String(str || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .join(', ');

  // Validasi 9 field wajib pada form Tambah & Edit Buku
  // (Kode Eksemplar, Edisi, Lokasi Rak, dan Sampul Buku bersifat opsional / boleh kosong)
  const validateBookFormRequired = (form, cleanedAuthors) => {
    const missing = [];
    if (!form.judul || !form.judul.trim()) missing.push('Judul Buku');
    if (!cleanedAuthors) missing.push('Penulis / Pengarang');
    if (!form.kategori || !form.kategori.trim()) missing.push('Kategori');
    if (!form.penerbit || !form.penerbit.trim()) missing.push('Penerbit');
    if (
      form.tahun_terbit === '' ||
      form.tahun_terbit === null ||
      form.tahun_terbit === undefined ||
      Number.isNaN(Number(form.tahun_terbit))
    ) {
      missing.push('Tahun Terbit');
    }
    if (!form.isbn || !form.isbn.trim()) missing.push('ISBN');
    if (!form.nomor_panggil || !form.nomor_panggil.trim()) missing.push('Nomor Panggil');
    if (!form.bahasa || !form.bahasa.trim()) missing.push('Bahasa');
    if (!form.deskripsi || !form.deskripsi.trim()) missing.push('Deskripsi / Sinopsis Buku');
    return missing;
  };

  // Helper pengecekan duplikat ISBN dan Kode Eksemplar terhadap buku yang sudah ada di Database (maupun di dalam form)
  const getFormDuplicateConflicts = (excludeKoleksiId = null) => {
    const conflicts = [];
    const cleanIsbn = (bookForm.isbn || '').trim();

    if (cleanIsbn) {
      const matchedIsbnBook = collections.find(
        (b) =>
          b.id_koleksi !== excludeKoleksiId &&
          b.isbn &&
          String(b.isbn).trim().toLowerCase() === cleanIsbn.toLowerCase()
      );
      if (matchedIsbnBook) {
        conflicts.push(
          `ISBN "${cleanIsbn}" sudah terdaftar pada buku "${matchedIsbnBook.judul}" (${matchedIsbnBook.kode_koleksi}).`
        );
      }
    }

    const eksRows = Array.isArray(bookForm.eksemplar) ? bookForm.eksemplar : [];
    const seenInForm = new Set();

    for (let i = 0; i < eksRows.length; i++) {
      const code = String(eksRows[i]?.kode_eksemplar || '').trim();
      if (!code) continue;

      const lowerCode = code.toLowerCase();
      if (seenInForm.has(lowerCode)) {
        const dupMsg = `Kode Eksemplar "${code}" dimasukkan lebih dari satu kali di dalam tabel eksemplar form ini.`;
        if (!conflicts.includes(dupMsg)) conflicts.push(dupMsg);
      } else {
        seenInForm.add(lowerCode);
      }

      const matchedEksBook = collections.find(
        (b) =>
          b.id_koleksi !== excludeKoleksiId &&
          Array.isArray(b.eksemplar) &&
          b.eksemplar.some(
            (e) =>
              e.kode_eksemplar &&
              String(e.kode_eksemplar).trim().toLowerCase() === lowerCode
          )
      );
      if (matchedEksBook) {
        const dbMsg = `Kode Eksemplar "${code}" sudah digunakan pada buku "${matchedEksBook.judul}" (${matchedEksBook.kode_koleksi}) di database.`;
        if (!conflicts.includes(dbMsg)) conflicts.push(dbMsg);
      }
    }

    return conflicts;
  };

  // Handler Modal Tambah
  const handleOpenAddModal = () => {
    setBookForm({
      ...initialFormState,
      kategori: allCategoryNames[0] || 'Ilmu Komputer & Sistem Informasi',
      eksemplar: [
        {
          kode_eksemplar: '',
          lokasi_rak: '',
          status: 'TERSEDIA',
        },
      ],
    });
    setGenerateBookCount(1);
    setGenerateDefaultRak('');
    setCoverMeta(null);
    setFormModalError('');
    setShowAuthorDropdown(false);
    setShowPublisherDropdown(false);
    if (addFileInputRef.current) addFileInputRef.current.value = '';
    setIsAddModalOpen(true);
  };

  const handleSubmitAdd = async (e) => {
    e.preventDefault();
    setFormModalError('');
    const cleanedAuthors = normalizeAuthorInput(bookForm.pengarang);
    const missing = validateBookFormRequired(bookForm, cleanedAuthors);
    if (missing.length > 0) {
      const msg = `Field berikut wajib diisi: ${missing.join(', ')}.`;
      setFormModalError(msg);
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Gagal Menambahkan Buku',
        message: msg,
      });
      return;
    }

    const dupConflicts = getFormDuplicateConflicts(null);
    if (dupConflicts.length > 0) {
      const msg = dupConflicts.join(' ');
      setFormModalError(msg);
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Gagal Menambahkan Buku (Data Duplikat)',
        message: msg,
      });
      return;
    }

    // Kode Eksemplar & Lokasi Rak boleh kosong
    const validEksemplar = (bookForm.eksemplar || [])
      .map((item) => ({
        kode_eksemplar: String(item.kode_eksemplar || '').trim(),
        lokasi_rak: String(item.lokasi_rak || '').trim(),
        status: item.status || 'TERSEDIA',
      }))
      .filter((item) => item.kode_eksemplar !== '');

    setIsSubmitting(true);
    try {
      const savedTitle = bookForm.judul.trim();
      await onAddCollection({
        ...bookForm,
        pengarang: cleanedAuthors,
        penerbit: bookForm.penerbit.trim(),
        tahun_terbit: Number(bookForm.tahun_terbit),
        eksemplar: validEksemplar,
      });
      setCurrentPage(1);
      setIsAddModalOpen(false);
      setCoverMeta(null);
      setFeedbackModal({
        isOpen: true,
        type: 'success',
        title: 'Berhasil Menambahkan Buku',
        message: `Koleksi buku "${savedTitle}" berhasil ditambahkan ke dalam database.`,
      });
    } catch (err) {
      const errMsg = err.message || 'Gagal menambahkan koleksi ke database.';
      setFormModalError(errMsg);
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Gagal Menambahkan Buku',
        message: errMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler Modal Edit
  const handleOpenEditModal = (book) => {
    setSelectedBook(book);
    const existingEks =
      Array.isArray(book.eksemplar) && book.eksemplar.length > 0
        ? book.eksemplar.map((e) => ({
            id_eksemplar: e.id_eksemplar,
            kode_eksemplar: e.kode_eksemplar || '',
            lokasi_rak: e.lokasi_rak || '',
            status: e.status || 'TERSEDIA',
          }))
        : [
            {
              kode_eksemplar: '',
              lokasi_rak: '',
              status: 'TERSEDIA',
            },
          ];

    setBookForm({
      judul: book.judul || '',
      pengarang: book.pengarang || '',
      kategori: book.kategori || allCategoryNames[0] || 'Ilmu Komputer & Sistem Informasi',
      penerbit: book.penerbit || '',
      tahun_terbit: book.tahun_terbit || new Date().getFullYear(),
      isbn: book.isbn || '',
      nomor_panggil: book.nomor_panggil || '',
      edisi: book.edisi || '',
      bahasa: book.bahasa || 'Indonesia',
      deskripsi: book.deskripsi || '',
      sampul: book.sampul || '',
      eksemplar: existingEks,
    });
    setGenerateBookCount(1);
    setGenerateDefaultRak(existingEks[0]?.lokasi_rak || '');
    setCoverMeta(null);
    setFormModalError('');
    setShowAuthorDropdown(false);
    setShowPublisherDropdown(false);
    if (editFileInputRef.current) editFileInputRef.current.value = '';
    setIsEditModalOpen(true);
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    if (!selectedBook) return;
    setFormModalError('');
    const cleanedAuthors = normalizeAuthorInput(bookForm.pengarang);
    const missing = validateBookFormRequired(bookForm, cleanedAuthors);
    if (missing.length > 0) {
      const msg = `Field berikut wajib diisi: ${missing.join(', ')}.`;
      setFormModalError(msg);
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Gagal Memperbarui Buku',
        message: msg,
      });
      return;
    }

    const dupConflicts = getFormDuplicateConflicts(selectedBook.id_koleksi);
    if (dupConflicts.length > 0) {
      const msg = dupConflicts.join(' ');
      setFormModalError(msg);
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Gagal Memperbarui Buku (Data Duplikat)',
        message: msg,
      });
      return;
    }

    // Kode Eksemplar & Lokasi Rak boleh kosong
    const validEksemplar = (bookForm.eksemplar || [])
      .map((item) => ({
        id_eksemplar: item.id_eksemplar || null,
        kode_eksemplar: String(item.kode_eksemplar || '').trim(),
        lokasi_rak: String(item.lokasi_rak || '').trim(),
        status: item.status || 'TERSEDIA',
      }))
      .filter((item) => item.kode_eksemplar !== '');

    setIsSubmitting(true);
    try {
      const updatedTitle = bookForm.judul.trim();
      await onUpdateCollection({
        ...selectedBook,
        ...bookForm,
        pengarang: cleanedAuthors,
        penerbit: bookForm.penerbit.trim(),
        tahun_terbit: Number(bookForm.tahun_terbit),
        eksemplar: validEksemplar,
      });
      setIsEditModalOpen(false);
      setCoverMeta(null);
      setFeedbackModal({
        isOpen: true,
        type: 'success',
        title: 'Berhasil Memperbarui Buku',
        message: `Perubahan data koleksi buku "${updatedTitle}" berhasil disimpan ke database.`,
      });
    } catch (err) {
      const errMsg = err.message || 'Gagal memperbarui koleksi di database.';
      setFormModalError(errMsg);
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Gagal Memperbarui Buku',
        message: errMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler Modal Import Excel
  const handleOpenImportModal = () => {
    setImportFileName('');
    setImportPreviewRows([]);
    setImportConflicts([]);
    setImportError('');
    if (excelFileInputRef.current) excelFileInputRef.current.value = '';
    setIsImportModalOpen(true);
  };

  const handleExcelFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFileName(file.name);
    setImportError('');
    setImportConflicts([]);
    setIsParsingExcel(true);
    try {
      const { items, conflicts } = await parseExcelFile(file, collections);
      setImportPreviewRows(items);
      setImportConflicts(conflicts || []);
    } catch (err) {
      setImportPreviewRows([]);
      setImportConflicts([]);
      setImportError(err.message || 'Gagal membaca file Excel.');
    } finally {
      setIsParsingExcel(false);
    }
  };

  const handleConfirmImportExcel = async () => {
    if (importPreviewRows.length === 0) {
      const msg = 'Pilih file Excel yang memiliki data buku terlebih dahulu.';
      setImportError(msg);
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Gagal Import Buku dari Excel',
        message: msg,
      });
      return;
    }

    if (importConflicts.length > 0) {
      const msg =
        'Terdapat duplikat ISBN atau Kode Eksemplar pada file Excel. Mohon perbaiki terlebih dahulu sebelum mengimport.';
      setImportError(msg);
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Gagal Import Buku (Data Duplikat)',
        message: `${msg} (${importConflicts[0]})`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const countBooks = importPreviewRows.length;
      await onImportCollections(importPreviewRows);
      setCurrentPage(1);
      setIsImportModalOpen(false);
      setImportPreviewRows([]);
      setImportConflicts([]);
      setImportFileName('');
      setFeedbackModal({
        isOpen: true,
        type: 'success',
        title: 'Berhasil Import Buku dari Excel',
        message: `${countBooks} judul koleksi buku dari file Excel berhasil diimport dan disimpan ke database.`,
      });
    } catch (err) {
      const errMsg = err.message || 'Gagal mengimport data buku ke database.';
      setImportError(errMsg);
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Gagal Import Buku dari Excel',
        message: errMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler Modal Detail
  const handleOpenDetailModal = (book) => {
    setSelectedBook(book);
    setIsDetailModalOpen(true);
  };

  // Handler Modal Hapus
  const handleOpenDeleteModal = (book) => {
    setSelectedBook(book);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedBook) return;
    setIsSubmitting(true);
    const deletedTitle = selectedBook.judul;
    try {
      await onDeleteCollection(selectedBook.id_koleksi);
      setIsDeleteModalOpen(false);
      if (isDetailModalOpen) setIsDetailModalOpen(false);
      setFeedbackModal({
        isOpen: true,
        type: 'success',
        title: 'Berhasil Menghapus Buku',
        message: `Koleksi buku "${deletedTitle}" beserta data eksemplar dan sampulnya telah berhasil dihapus dari database.`,
      });
    } catch (err) {
      const errMsg = err.message || 'Gagal menghapus koleksi dari database.';
      setIsDeleteModalOpen(false);
      setFeedbackModal({
        isOpen: true,
        type: 'error',
        title: 'Gagal Menghapus Buku',
        message: errMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Hitung ringkasan statistik koleksi dari database
  const totalJudul = collections.length;
  const totalEksemplar = collections.reduce((acc, curr) => acc + (curr.total_stok || 0), 0);
  const totalTersedia = collections.reduce((acc, curr) => acc + (curr.stok_tersedia || 0), 0);

  // Deteksi konflik duplikat secara real-time saat modal Tambah atau Edit dibuka
  const activeExcludeId = isEditModalOpen && selectedBook ? selectedBook.id_koleksi : null;
  const activeFormConflicts =
    isAddModalOpen || isEditModalOpen ? getFormDuplicateConflicts(activeExcludeId) : [];

  const activeIsbnConflict = activeFormConflicts.find((msg) => msg.startsWith('ISBN '));
  const activeEksConflicts = activeFormConflicts.filter((msg) =>
    msg.startsWith('Kode Eksemplar ')
  );

  // Helper menampilkan pesan konflik / error di dalam popup Tambah Buku & Edit Buku
  const renderFormConflictBanner = () => {
    const messagesToShow = [...activeFormConflicts];
    if (formModalError && !messagesToShow.includes(formModalError)) {
      const joinedConflicts = activeFormConflicts.join(' ');
      if (formModalError !== joinedConflicts) {
        messagesToShow.push(formModalError);
      }
    }

    if (messagesToShow.length === 0) return null;

    return (
      <div className="modal-conflict-alert" role="alert">
        <div className="modal-conflict-header">
          <span>⚠️ Peringatan Data Duplikat / Validasi Buku:</span>
        </div>
        <ul className="modal-conflict-list">
          {messagesToShow.map((msg, idx) => (
            <li key={idx}>{msg}</li>
          ))}
        </ul>
      </div>
    );
  };

  // Komponen Reusable Field Input Penulis & Penerbit dengan Search Dropdown
  const renderAuthorAndPublisherFields = () => (
    <>
      <div className="form-row-2">
        <div className="form-group autocomplete-field-wrapper">
          <label className="form-label">
            Penulis / Pengarang * <span className="label-hint">(Pisahkan dengan koma jika &gt; 1)</span>
          </label>
          <div className="autocomplete-input-container">
            <input
              type="text"
              className="form-control"
              placeholder="Cari atau ketik penulis (misal: Robert C. Martin, Kent Beck)"
              value={bookForm.pengarang}
              onFocus={() => {
                setShowAuthorDropdown(true);
                setShowPublisherDropdown(false);
              }}
              onBlur={() => {
                setTimeout(() => setShowAuthorDropdown(false), 180);
              }}
              onChange={(e) => {
                setBookForm({ ...bookForm, pengarang: e.target.value });
                setShowAuthorDropdown(true);
              }}
              required
            />

            {showAuthorDropdown && (
              <div className="autocomplete-dropdown">
                <div className="autocomplete-dropdown-header">
                  <span>Pilih penulis dari database atau ketik baru (pisahkan koma):</span>
                </div>

                {currentAuthorSearchToken &&
                  !allKnownAuthors.some(
                    (a) => a.toLowerCase() === currentAuthorSearchToken.toLowerCase()
                  ) && (
                    <button
                      type="button"
                      className="autocomplete-item autocomplete-item-new"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectAuthorSuggestion(currentAuthorSearchToken);
                      }}
                    >
                      <span>+ Tambahkan penulis baru: <strong>&quot;{currentAuthorSearchToken}&quot;</strong></span>
                    </button>
                  )}

                {filteredAuthorSuggestions.length === 0 ? (
                  <div className="autocomplete-empty">
                    Penulis belum terdaftar — akan otomatis ditambahkan saat disimpan.
                  </div>
                ) : (
                  filteredAuthorSuggestions.slice(0, 8).map((authorName) => (
                    <button
                      key={authorName}
                      type="button"
                      className="autocomplete-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectAuthorSuggestion(authorName);
                      }}
                    >
                      <span>{authorName}</span>
                      <span className="autocomplete-badge">Pilih</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {parsedAuthorsList.length > 0 && (
            <div className="author-tags-preview">
              {parsedAuthorsList.map((author, idx) => {
                const isExisting = allKnownAuthors.some(
                  (a) => a.toLowerCase() === author.toLowerCase()
                );
                return (
                  <span
                    key={`${author}-${idx}`}
                    className={`author-tag-chip ${isExisting ? 'existing' : 'new-author'}`}
                  >
                    <span>
                      {idx + 1}. {author} {!isExisting && <em>(Baru)</em>}
                    </span>
                    <button
                      type="button"
                      className="author-tag-remove"
                      onClick={() => handleRemoveAuthorTag(author)}
                      title="Hapus penulis ini"
                    >
                      &times;
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Kategori *</label>
          <select
            className="form-control"
            value={bookForm.kategori}
            onChange={(e) => setBookForm({ ...bookForm, kategori: e.target.value })}
            required
          >
            {categories.filter((c) => c !== 'Semua').map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row-2">
        <div className="form-group autocomplete-field-wrapper">
          <label className="form-label">Penerbit *</label>
          <div className="autocomplete-input-container">
            <input
              type="text"
              className="form-control"
              placeholder="Cari atau ketik nama penerbit..."
              value={bookForm.penerbit}
              onFocus={() => {
                setShowPublisherDropdown(true);
                setShowAuthorDropdown(false);
              }}
              onBlur={() => {
                setTimeout(() => setShowPublisherDropdown(false), 180);
              }}
              onChange={(e) => {
                setBookForm({ ...bookForm, penerbit: e.target.value });
                setShowPublisherDropdown(true);
              }}
              required
            />

            {showPublisherDropdown && (
              <div className="autocomplete-dropdown">
                <div className="autocomplete-dropdown-header">
                  <span>Pilih penerbit yang ada atau ketik penerbit baru:</span>
                </div>

                {publisherSearchToken &&
                  !allKnownPublishers.some(
                    (p) => p.toLowerCase() === publisherSearchToken.toLowerCase()
                  ) && (
                    <button
                      type="button"
                      className="autocomplete-item autocomplete-item-new"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectPublisherSuggestion(publisherSearchToken);
                      }}
                    >
                      <span>+ Tambahkan penerbit baru: <strong>&quot;{publisherSearchToken}&quot;</strong></span>
                    </button>
                  )}

                {filteredPublisherSuggestions.length === 0 ? (
                  <div className="autocomplete-empty">
                    Penerbit belum ada di daftar — akan otomatis ditambahkan saat disimpan.
                  </div>
                ) : (
                  filteredPublisherSuggestions.slice(0, 8).map((pub) => (
                    <button
                      key={pub}
                      type="button"
                      className="autocomplete-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectPublisherSuggestion(pub);
                      }}
                    >
                      <span>{pub}</span>
                      <span className="autocomplete-badge">Pilih</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Tahun Terbit *</label>
          <input
            type="number"
            min="1900"
            max={new Date().getFullYear() + 1}
            className="form-control"
            value={bookForm.tahun_terbit}
            onChange={(e) => setBookForm({ ...bookForm, tahun_terbit: e.target.value })}
            required
          />
        </div>
      </div>
    </>
  );

  // Komponen Reusable Tabel Input Kode Eksemplar Buku (Opsional)
  const renderEksemplarTableSection = () => {
    const eksList = Array.isArray(bookForm.eksemplar) ? bookForm.eksemplar : [];
    const filledCount = eksList.filter((e) => (e.kode_eksemplar || '').trim() !== '').length;
    const readyCount = eksList.filter(
      (e) => (e.kode_eksemplar || '').trim() !== '' && e.status === 'TERSEDIA'
    ).length;

    return (
      <div className="eksemplar-section-box">
        <div className="eksemplar-section-header">
          <div>
            <label className="form-label" style={{ marginBottom: '2px' }}>
              Daftar Kode Eksemplar Buku <span className="label-hint">(Opsional — Boleh Dikosongkan)</span>
            </label>
            <p className="form-help-text">
              Jumlah stok eksemplar dihitung otomatis berdasarkan berapa banyak kode eksemplar yang dimasukkan di bawah ini:
            </p>
          </div>
          <div className="eksemplar-header-actions">
            <span className="eksemplar-count-badge">
              Total: <strong>{filledCount}</strong> Eksemplar ({readyCount} Tersedia)
            </span>
            <button
              type="button"
              className="btn-add-eks-row"
              onClick={handleAddEksemplarRow}
            >
              + Tambah Baris Manual
            </button>
          </div>
        </div>

        {/* Fitur Generate Kode Eksemplar Otomatis Berdasarkan Jumlah Buku Baru */}
        <div className="eksemplar-generator-bar">
          <div className="generator-bar-info">
            <strong>Generate Kode Eksemplar Otomatis (Buku Baru Belum Memiliki Kode):</strong>
            <span>Masukkan jumlah buku yang akan diinputkan, lalu klik Generate:</span>
          </div>
          <div className="generator-bar-controls">
            <div className="generator-input-group">
              <label>Jumlah Buku:</label>
              <input
                type="number"
                min="1"
                max="200"
                className="form-control generator-count-input"
                value={generateBookCount}
                onChange={(e) => setGenerateBookCount(e.target.value)}
              />
            </div>
            <div className="generator-input-group">
              <label>Lokasi Rak (Opsional):</label>
              <input
                type="text"
                className="form-control generator-rak-input"
                placeholder="RAK-CS-01"
                value={generateDefaultRak}
                onChange={(e) => setGenerateDefaultRak(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn-generate-eks"
              onClick={handleGenerateEksemplarByCount}
            >
              Generate {Math.max(1, parseInt(generateBookCount, 10) || 1)} Kode Eksemplar
            </button>
          </div>
        </div>

        <div className="eksemplar-table-wrapper">
          <table className="eksemplar-input-table">
            <thead>
              <tr>
                <th style={{ width: '48px' }}>No</th>
                <th>Kode Eksemplar (Opsional)</th>
                <th style={{ width: '180px' }}>Lokasi Rak (Opsional)</th>
                <th style={{ width: '150px' }}>Status</th>
                <th style={{ width: '80px', textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {eksList.map((eks, idx) => (
                <tr key={eks.id_eksemplar ? `id-${eks.id_eksemplar}` : `row-${idx}`}>
                  <td className="text-center font-semibold">{idx + 1}</td>
                  <td>
                    <input
                      type="text"
                      className="form-control"
                      placeholder={`Opsional (Contoh: EKS-001-${String.fromCharCode(65 + (idx % 26))})`}
                      value={eks.kode_eksemplar}
                      onChange={(e) =>
                        handleUpdateEksemplarRow(idx, 'kode_eksemplar', e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddEksemplarRow();
                        }
                      }}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Opsional (Contoh: RAK-CS-01)"
                      value={eks.lokasi_rak}
                      onChange={(e) =>
                        handleUpdateEksemplarRow(idx, 'lokasi_rak', e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <select
                      className="form-control"
                      value={eks.status || 'TERSEDIA'}
                      onChange={(e) =>
                        handleUpdateEksemplarRow(idx, 'status', e.target.value)
                      }
                    >
                      <option value="TERSEDIA">TERSEDIA</option>
                      <option value="DIPINJAM">DIPINJAM</option>
                      <option value="RUSAK">RUSAK</option>
                      <option value="HILANG">HILANG</option>
                    </select>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="btn-remove-eks-row"
                      onClick={() => handleRemoveEksemplarRow(idx)}
                      title={eksList.length <= 1 ? 'Kosongkan baris eksemplar' : 'Hapus baris eksemplar ini'}
                    >
                      {eksList.length <= 1 ? 'Reset' : 'Hapus'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {activeEksConflicts.length > 0 && (
          <div className="modal-conflict-alert" style={{ marginTop: '10px' }} role="alert">
            <div className="modal-conflict-header">
              <span>⚠️ Konflik Kode Eksemplar Terdeteksi:</span>
            </div>
            <ul className="modal-conflict-list">
              {activeEksConflicts.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="pustakawan-koleksi-section">
      {/* Header Halaman */}
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Manajemen Koleksi Pustaka</h2>
          <p className="page-subtitle">
            Kelola katalog koleksi perpustakaan, inventaris kode eksemplar, dan ketersediaan sirkulasi UNAND
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
              {isLoadingCollections ? 'Memuat...' : 'Segarkan Data'}
            </button>
          )}
          <button
            type="button"
            className="btn-outline-sm"
            onClick={() => exportCollectionsToExcel(collections)}
            disabled={collections.length === 0}
            title="Export data koleksi beserta kode eksemplar ke file Excel (.xlsx)"
          >
            Export Excel
          </button>
          <button
            type="button"
            className="btn-import-excel"
            onClick={handleOpenImportModal}
            title="Import daftar koleksi buku dari file Excel (.xlsx / .csv)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="12" y1="18" x2="12" y2="12"></line>
              <polyline points="9 15 12 12 15 15"></polyline>
            </svg>
            <span>Import Excel</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleOpenAddModal}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Tambah Koleksi</span>
          </button>
        </div>
      </div>

      {/* Kartu Ringkasan Statistik */}
      <div className="collection-stats-grid">
        <div className="stat-card-mini">
          <span className="stat-label">Total Judul Buku (DB)</span>
          <strong className="stat-value text-green-bold">{totalJudul}</strong>
        </div>
        <div className="stat-card-mini">
          <span className="stat-label">Total Eksemplar Fisik</span>
          <strong className="stat-value">{totalEksemplar}</strong>
        </div>
        <div className="stat-card-mini">
          <span className="stat-label">Eksemplar Tersedia</span>
          <strong className="stat-value text-emerald">{totalTersedia}</strong>
        </div>
        <div className="stat-card-mini">
          <span className="stat-label">Buku Sedang Dipinjam</span>
          <strong className="stat-value text-amber">{totalEksemplar - totalTersedia}</strong>
        </div>
      </div>

      {/* Bar Pencarian Multi-Kriteria & Filter */}
      <div className="search-filter-bar">
        <div className="search-criteria-wrapper">
          <label htmlFor="search-criteria-select" className="search-criteria-label">
            Cari:
          </label>
          <select
            id="search-criteria-select"
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
          <span>Kategori: {selectedCategory}</span>
        </button>
      </div>

      {/* Info Status Filter Aktif */}
      {(searchQuery || selectedCategory !== 'Semua' || searchBy !== 'all') && (
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
          </span>
          <button
            type="button"
            className="btn-reset-filters"
            onClick={() => {
              setSearchQuery('');
              setSearchBy('all');
              setSelectedCategory('Semua');
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

      {/* Tabel Manajemen Koleksi Buku (Maksimal 10 Buku per Halaman, Buku Terbaru di Paling Atas) */}
      <div className="table-responsive-wrapper">
        <table className="custom-table">
          <thead>
            <tr>
              <th style={{ width: '65px' }}>Sampul</th>
              <th>Kode &amp; Judul Koleksi</th>
              <th>Penulis &amp; Penerbit</th>
              <th>Kategori</th>
              <th>Lokasi Rak</th>
              <th>Ketersediaan Stok</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoadingCollections ? (
              <tr>
                <td colSpan="7" className="text-center py-6">
                  <div className="empty-table-state">
                    <p>Sedang memuat data koleksi dari database...</p>
                  </div>
                </td>
              </tr>
            ) : filteredCollections.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-6">
                  <div className="empty-table-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
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
                        setCurrentPage(1);
                      }}
                    >
                      Reset Pencarian
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedCollections.map((item) => (
                <tr key={item.id_koleksi}>
                  <td>
                    <div
                      className="table-cover-clickable"
                      onClick={() => handleOpenDetailModal(item)}
                      title="Klik untuk melihat detail buku"
                    >
                      <BookCover
                        src={item.sampul}
                        title={item.judul}
                        author={item.pengarang}
                        category={item.kategori}
                        size="sm"
                      />
                    </div>
                  </td>

                  {/* Kolom Kode & Judul Koleksi (ISBN di atas, No Panggil di bawah) */}
                  <td>
                    <div className="table-title-cell">
                      <span className="code-pill">{item.kode_koleksi}</span>
                      <strong
                        className="table-main-text hover-link"
                        onClick={() => handleOpenDetailModal(item)}
                      >
                        {item.judul}
                      </strong>
                      <div className="table-sub-stack">
                        <div className="table-sub-text">ISBN: {item.isbn || '-'}</div>
                        <div className="table-sub-text">No Panggil: {item.nomor_panggil || '-'}</div>
                      </div>
                    </div>
                  </td>

                  {/* Kolom Penulis & Penerbit (Nama Penulis di atas, Nama Penerbit di bawah) */}
                  <td>
                    <div className="table-author-cell">
                      <div className="table-author-name">{item.pengarang}</div>
                      <div className="table-sub-text">
                        {item.penerbit ? item.penerbit : 'Penerbit belum diatur'}
                        {item.tahun_terbit ? ` (${item.tahun_terbit})` : ''}
                      </div>
                    </div>
                  </td>

                  <td>
                    <span className="category-badge">{item.kategori}</span>
                  </td>

                  <td>
                    <span className="rak-badge">{item.lokasi_rak || '-'}</span>
                  </td>

                  <td>
                    <span
                      className={`stock-pill ${
                        item.stok_tersedia > 0 ? 'in-stock' : 'out-stock'
                      }`}
                    >
                      {item.stok_tersedia} / {item.total_stok} Tersedia
                    </span>
                  </td>

                  <td className="text-right">
                    <div className="action-buttons-inline">
                      <button
                        type="button"
                        className="btn-action-detail"
                        onClick={() => handleOpenDetailModal(item)}
                        title="Lihat Detail Buku"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="16" x2="12" y2="12"></line>
                          <line x1="12" y1="8" x2="12.01" y2="8"></line>
                        </svg>
                        <span>Detail</span>
                      </button>

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

      {/* Bar Navigasi Halaman (Pagination - Maksimal 10 Buku per Halaman) */}
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

      {/* ========================================================================= */}
      {/* 1. MODAL DETAIL KOLEKSI (DENGAN TABEL DAFTAR KODE EKSEMPLAR)              */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDetailModalOpen}
        title="Detail Koleksi Pustaka"
        size="lg"
        onClose={() => setIsDetailModalOpen(false)}
      >
        {selectedBook && (
          <div className="book-detail-container">
            <div className="book-detail-header-row">
              <div className="book-detail-cover">
                <BookCover
                  src={selectedBook.sampul}
                  title={selectedBook.judul}
                  author={selectedBook.pengarang}
                  category={selectedBook.kategori}
                  size="lg"
                />
              </div>

              <div className="book-detail-meta-group">
                <div className="book-detail-badge-row">
                  <span className="code-pill">{selectedBook.kode_koleksi}</span>
                  <span className="category-badge">{selectedBook.kategori}</span>
                  <span
                    className={`stock-pill ${
                      selectedBook.stok_tersedia > 0 ? 'in-stock' : 'out-stock'
                    }`}
                  >
                    {selectedBook.stok_tersedia > 0
                      ? `${selectedBook.stok_tersedia} dari ${selectedBook.total_stok} Eksemplar Tersedia`
                      : 'Sedang Habis Dipinjam'}
                  </span>
                </div>

                <h3 className="book-detail-title">{selectedBook.judul}</h3>
                <p className="book-detail-author">
                  Penulis: <strong>{selectedBook.pengarang}</strong>
                </p>

                <div className="book-detail-grid">
                  <div className="detail-meta-cell">
                    <span className="detail-meta-label">Penerbit</span>
                    <strong className="detail-meta-val">{selectedBook.penerbit || '-'}</strong>
                  </div>
                  <div className="detail-meta-cell">
                    <span className="detail-meta-label">Tahun Terbit</span>
                    <strong className="detail-meta-val">{selectedBook.tahun_terbit || '-'}</strong>
                  </div>
                  <div className="detail-meta-cell">
                    <span className="detail-meta-label">Nomor ISBN</span>
                    <strong className="detail-meta-val">{selectedBook.isbn || '-'}</strong>
                  </div>
                  <div className="detail-meta-cell">
                    <span className="detail-meta-label">Nomor Panggil</span>
                    <strong className="detail-meta-val">{selectedBook.nomor_panggil || '-'}</strong>
                  </div>
                  <div className="detail-meta-cell">
                    <span className="detail-meta-label">Lokasi Rak</span>
                    <strong className="detail-meta-val text-green-bold">{selectedBook.lokasi_rak || '-'}</strong>
                  </div>
                  <div className="detail-meta-cell">
                    <span className="detail-meta-label">Bahasa &amp; Edisi</span>
                    <strong className="detail-meta-val">
                      {selectedBook.bahasa || 'Indonesia'} {selectedBook.edisi ? `(${selectedBook.edisi})` : ''}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {selectedBook.deskripsi && (
              <div className="book-detail-desc-box">
                <h4 className="desc-heading">Sinopsis &amp; Deskripsi Koleksi</h4>
                <p className="desc-text">{selectedBook.deskripsi}</p>
              </div>
            )}

            {/* Tabel Daftar Kode Eksemplar Buku */}
            {Array.isArray(selectedBook.eksemplar) && selectedBook.eksemplar.length > 0 && (
              <div className="book-detail-desc-box">
                <h4 className="desc-heading">
                  Daftar Kode Eksemplar ({selectedBook.eksemplar.length} Eksemplar)
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
                      {selectedBook.eksemplar.map((eks, idx) => (
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
                onClick={() => setIsDetailModalOpen(false)}
              >
                Tutup
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setIsDetailModalOpen(false);
                  handleOpenEditModal(selectedBook);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                <span>Edit Buku Ini</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* 2. MODAL TAMBAH KOLEKSI (LEBAR DITAMBAH + TABEL KODE EKSEMPLAR)           */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isAddModalOpen}
        title="Tambah Koleksi Buku Baru"
        size="lg"
        onClose={() => !isSubmitting && setIsAddModalOpen(false)}
      >
        <form onSubmit={handleSubmitAdd} className="modal-form">
          <div className="cover-upload-section">
            <div className="cover-preview-box">
              <BookCover
                src={bookForm.sampul}
                title={bookForm.judul || 'Preview Sampul'}
                author={bookForm.pengarang || 'Penulis'}
                category={bookForm.kategori}
                size="lg"
              />
              <span className="cover-preview-caption">
                {isCompressing
                  ? 'Mengompresi ke WebP...'
                  : coverMeta
                  ? `✓ WebP (${coverMeta.sizeKB} KB / Maks 100 KB)`
                  : bookForm.sampul
                  ? '✓ Pratinjau Sampul Aktif'
                  : 'Pratinjau Sampul Default'}
              </span>
            </div>

            <div className="cover-upload-controls">
              <label className="form-label font-bold">
                Sampul Buku <span className="label-hint">(Opsional)</span>
              </label>

              <div className="cover-file-row">
                <input
                  type="file"
                  id="add-cover-file"
                  ref={addFileInputRef}
                  accept="image/*"
                  className="hidden-file-input"
                  onChange={handleCoverFileChange}
                />
                <label htmlFor="add-cover-file" className="btn-upload-file">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <span>{isCompressing ? 'Mengompresi...' : 'Pilih File Sampul'}</span>
                </label>

                {bookForm.sampul && (
                  <button
                    type="button"
                    className="btn-remove-cover"
                    onClick={() => handleRemoveCover(false)}
                    title="Hapus sampul yang dipilih"
                  >
                    Hapus Sampul
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Judul Buku *</label>
            <input
              type="text"
              className="form-control"
              placeholder="Contoh: Pemrograman Web dengan React & Node.js"
              value={bookForm.judul}
              onChange={(e) => setBookForm({ ...bookForm, judul: e.target.value })}
              required
            />
          </div>

          {/* Search Penulis (Multi-Penulis Koma), Kategori, Search Penerbit, & Tahun Terbit */}
          {renderAuthorAndPublisherFields()}

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">ISBN *</label>
              <input
                type="text"
                className={`form-control ${activeIsbnConflict ? 'input-conflict' : ''}`}
                placeholder="Contoh: 9780132350884"
                value={bookForm.isbn}
                onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                required
              />
              {activeIsbnConflict && (
                <div className="field-conflict-hint">⚠️ {activeIsbnConflict}</div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Nomor Panggil *</label>
              <input
                type="text"
                className="form-control"
                placeholder="Contoh: 005.1 MAR c"
                value={bookForm.nomor_panggil}
                onChange={(e) => setBookForm({ ...bookForm, nomor_panggil: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">
                Edisi / Cetakan <span className="label-hint">(Opsional)</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Opsional (Contoh: Edisi 2 / Cetakan ke-3)"
                value={bookForm.edisi}
                onChange={(e) => setBookForm({ ...bookForm, edisi: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Bahasa *</label>
              <input
                type="text"
                className="form-control"
                placeholder="Contoh: Indonesia / Inggris"
                value={bookForm.bahasa}
                onChange={(e) => setBookForm({ ...bookForm, bahasa: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Tabel Daftar Kode Eksemplar Buku (Opsional) */}
          {renderEksemplarTableSection()}

          <div className="form-group">
            <label className="form-label">Deskripsi / Sinopsis Buku *</label>
            <textarea
              className="form-control"
              rows="3"
              placeholder="Tuliskan ringkasan materi, pokok bahasan, atau sinopsis buku..."
              value={bookForm.deskripsi}
              onChange={(e) => setBookForm({ ...bookForm, deskripsi: e.target.value })}
              required
            ></textarea>
          </div>

          {/* Pesan Peringatan Duplikat ISBN / Kode Eksemplar di dalam Popup Tambah Buku */}
          {renderFormConflictBanner()}

          <div className="modal-actions-row">
            <button
              type="button"
              className="btn-outline-sm"
              disabled={isSubmitting || isCompressing}
              onClick={() => setIsAddModalOpen(false)}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || isCompressing}
            >
              {isSubmitting ? 'Menyimpan ke Database...' : 'Simpan Koleksi Buku'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* 3. MODAL EDIT KOLEKSI (LEBAR DITAMBAH + TABEL KODE EKSEMPLAR)             */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isEditModalOpen}
        title="Edit Data Koleksi Buku"
        size="lg"
        onClose={() => !isSubmitting && setIsEditModalOpen(false)}
      >
        <form onSubmit={handleSubmitEdit} className="modal-form">
          <div className="cover-upload-section">
            <div className="cover-preview-box">
              <BookCover
                src={bookForm.sampul}
                title={bookForm.judul}
                author={bookForm.pengarang}
                category={bookForm.kategori}
                size="lg"
              />
              <span className="cover-preview-caption">
                {isCompressing
                  ? 'Mengompresi ke WebP...'
                  : coverMeta
                  ? `✨ WebP Baru (${coverMeta.sizeKB} KB / Maks 100 KB)`
                  : bookForm.sampul !== selectedBook?.sampul
                  ? '✨ Sampul Diperbarui'
                  : bookForm.sampul
                  ? '✓ Sampul Saat Ini'
                  : 'Sampul Default Bertema'}
              </span>
            </div>

            <div className="cover-upload-controls">
              <label className="form-label font-bold">
                Ganti Sampul Buku <span className="label-hint">(Opsional — Otomatis WebP &le; 100 KB)</span>
              </label>
              <p className="form-help-text">
                Pilih gambar baru untuk mengganti sampul. Sampul baru dikompresi ke <strong>.webp (&le; 100 KB)</strong> di <code>public/upload</code> dan file sampul lama akan otomatis dihapus dari server:
              </p>

              <div className="cover-file-row">
                <input
                  type="file"
                  id="edit-cover-file"
                  ref={editFileInputRef}
                  accept="image/*"
                  className="hidden-file-input"
                  onChange={handleCoverFileChange}
                />
                <label htmlFor="edit-cover-file" className="btn-upload-file">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="17 8 12 3 7 8"></polyline>
                    <line x1="12" y1="3" x2="12" y2="15"></line>
                  </svg>
                  <span>{isCompressing ? 'Mengompresi...' : 'Pilih Sampul Baru'}</span>
                </label>

                {bookForm.sampul && (
                  <button
                    type="button"
                    className="btn-remove-cover"
                    onClick={() => handleRemoveCover(true)}
                    title="Kosongkan sampul"
                  >
                    Hapus Sampul
                  </button>
                )}
              </div>
            </div>
          </div>

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

          {/* Search Penulis (Multi-Penulis Koma), Kategori, Search Penerbit, & Tahun Terbit */}
          {renderAuthorAndPublisherFields()}

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">ISBN *</label>
              <input
                type="text"
                className={`form-control ${activeIsbnConflict ? 'input-conflict' : ''}`}
                value={bookForm.isbn}
                onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })}
                required
              />
              {activeIsbnConflict && (
                <div className="field-conflict-hint">⚠️ {activeIsbnConflict}</div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Nomor Panggil *</label>
              <input
                type="text"
                className="form-control"
                value={bookForm.nomor_panggil}
                onChange={(e) => setBookForm({ ...bookForm, nomor_panggil: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label">
                Edisi / Cetakan <span className="label-hint">(Opsional)</span>
              </label>
              <input
                type="text"
                className="form-control"
                placeholder="Opsional (Boleh dikosongkan)"
                value={bookForm.edisi}
                onChange={(e) => setBookForm({ ...bookForm, edisi: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Bahasa *</label>
              <input
                type="text"
                className="form-control"
                value={bookForm.bahasa}
                onChange={(e) => setBookForm({ ...bookForm, bahasa: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Tabel Daftar Kode Eksemplar Buku (Opsional) */}
          {renderEksemplarTableSection()}

          <div className="form-group">
            <label className="form-label">Deskripsi / Sinopsis Buku *</label>
            <textarea
              className="form-control"
              rows="3"
              value={bookForm.deskripsi}
              onChange={(e) => setBookForm({ ...bookForm, deskripsi: e.target.value })}
              required
            ></textarea>
          </div>

          {/* Pesan Peringatan Duplikat ISBN / Kode Eksemplar di dalam Popup Edit Buku */}
          {renderFormConflictBanner()}

          <div className="modal-actions-row">
            <button
              type="button"
              className="btn-outline-sm"
              disabled={isSubmitting || isCompressing}
              onClick={() => setIsEditModalOpen(false)}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={isSubmitting || isCompressing}
            >
              {isSubmitting ? 'Menyimpan ke Database...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* 4. MODAL IMPORT KOLEKSI DENGAN EXCEL (PENGGABUNGAN BUKU & KODE EKSEMPLAR) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isImportModalOpen}
        title="Import Koleksi Buku dari Excel"
        size="lg"
        onClose={() => !isSubmitting && setIsImportModalOpen(false)}
      >
        <div className="import-excel-container">
          <div className="import-info-box">
            <div className="import-info-top">
              <div>
                <strong>Format Kolom Excel (Tanpa Sampul):</strong>
                <p className="form-help-text">
                  Kolom <strong>Kode Eksemplar, Edisi / Cetakan, dan Lokasi Rak</strong> boleh dikosongkan (opsional), sedangkan kolom lainnya wajib diisi. Baris dengan <strong>Judul Buku, Penulis, Penerbit, dan Tahun Terbit</strong> yang sama akan masuk ke dalam <strong>ID Buku yang sama</strong>.
                </p>
              </div>
              <button
                type="button"
                className="btn-download-template"
                onClick={downloadExcelTemplate}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Unduh Template .xlsx</span>
              </button>
            </div>

            <div className="import-columns-badges">
              {EXCEL_TEMPLATE_COLUMNS.map((col, idx) => {
                const isOptional = OPTIONAL_EXCEL_COLUMNS.includes(col);
                return (
                  <span key={col} className="import-col-badge">
                    {idx + 1}. {col}
                    {isOptional ? ' (Opsional)' : ' *'}
                  </span>
                );
              })}
            </div>
          </div>

          <div className="import-file-picker-box">
            <input
              type="file"
              id="excel-import-input"
              ref={excelFileInputRef}
              accept=".xlsx,.xls,.csv"
              className="hidden-file-input"
              onChange={handleExcelFileChange}
            />
            <label htmlFor="excel-import-input" className="btn-upload-file">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
              </svg>
              <span>{isParsingExcel ? 'Membaca File...' : 'Pilih File Excel (.xlsx / .csv)'}</span>
            </label>
            {importFileName && (
              <span className="import-filename-label">
                File: <strong>{importFileName}</strong>
              </span>
            )}
          </div>

          {importError && (
            <div className="import-error-alert" role="alert">
              ⚠️ {importError}
            </div>
          )}

          {/* Pesan Peringatan Duplikat Kode Eksemplar / ISBN Setelah Memasukkan File Excel */}
          {importConflicts.length > 0 && (
            <div className="modal-conflict-alert" role="alert">
              <div className="modal-conflict-header">
                <span>
                  ⚠️ Ditemukan {importConflicts.length} Konflik Duplikat ISBN / Kode Eksemplar pada File Excel:
                </span>
              </div>
              <p className="modal-conflict-subtitle">
                Terdapat Kode Eksemplar atau ISBN yang sama dengan buku yang sudah ada di database atau duplikat antar buku yang akan diimport. Mohon perbaiki file Excel terlebih dahulu:
              </p>
              <ul className="modal-conflict-list">
                {importConflicts.map((conflictMsg, idx) => (
                  <li key={idx}>{conflictMsg}</li>
                ))}
              </ul>
            </div>
          )}

          {importPreviewRows.length > 0 && (
            <div className="import-preview-section">
              <div className="import-preview-header">
                <strong>
                  {importConflicts.length > 0 ? '⚠️' : '✓'} Terdeteksi {importPreviewRows.length} Judul Buku Unik (Total{' '}
                  {importPreviewRows.reduce((sum, r) => sum + (r.eksemplar?.length || 0), 0)} Kode Eksemplar){' '}
                  {importConflicts.length > 0 ? '— Perbaiki Duplikat Sebelum Import' : 'Siap Diimport'}
                </strong>
              </div>
              <div className="import-preview-table-wrapper">
                <table className="import-preview-table">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Judul Buku</th>
                      <th>Penulis</th>
                      <th>Penerbit (Tahun)</th>
                      <th>Daftar Kode Eksemplar</th>
                      <th>Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreviewRows.map((row, idx) => (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>
                          <strong>{row.judul}</strong>
                          <div className="table-sub-text">
                            ISBN: {row.isbn || '-'} • {row.kategori}
                          </div>
                        </td>
                        <td>{row.pengarang}</td>
                        <td>
                          {row.penerbit || '-'} ({row.tahun_terbit || '-'})
                        </td>
                        <td>
                          {(row.eksemplar || []).length === 0 ? (
                            <span className="table-sub-text">Belum ada kode eksemplar</span>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {(row.eksemplar || []).map((eks, eIdx) => (
                                <span key={eIdx} className="rak-badge">
                                  {eks.kode_eksemplar}
                                  {eks.lokasi_rak ? ` (${eks.lokasi_rak})` : ''}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className={`stock-pill ${
                              (row.eksemplar?.length || 0) > 0 ? 'in-stock' : 'out-stock'
                            }`}
                          >
                            {row.eksemplar?.length || 0} Eks
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
              disabled={isSubmitting}
              onClick={() => setIsImportModalOpen(false)}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={isSubmitting || importPreviewRows.length === 0 || importConflicts.length > 0}
              onClick={handleConfirmImportExcel}
            >
              {isSubmitting
                ? 'Mengimport ke Database...'
                : importConflicts.length > 0
                ? 'Tidak Dapat Import (Ada Duplikat)'
                : `Import ${importPreviewRows.length || ''} Buku ke Database`}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* 5. MODAL HAPUS KOLEKSI                                                   */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isDeleteModalOpen}
        title="Konfirmasi Hapus Koleksi"
        onClose={() => !isSubmitting && setIsDeleteModalOpen(false)}
      >
        <div className="confirm-delete-box">
          <div className="delete-book-preview-card">
            <BookCover
              src={selectedBook?.sampul}
              title={selectedBook?.judul || ''}
              author={selectedBook?.pengarang || ''}
              category={selectedBook?.kategori}
              size="sm"
            />
            <div>
              <strong>{selectedBook?.judul}</strong>
              <div className="text-muted-xs">
                {selectedBook?.kode_koleksi} • {selectedBook?.pengarang} ({selectedBook?.penerbit || 'Penerbit'})
              </div>
            </div>
          </div>

          <p>
            Apakah Anda yakin ingin menghapus buku <strong>&quot;{selectedBook?.judul}&quot;</strong> dari database perpustakaan?
          </p>
          <p className="text-warning-sm">
            Tindakan ini tidak dapat dibatalkan. Data koleksi, eksemplar, serta file sampul buku di server akan ikut terhapus secara permanen.
          </p>

          <div className="modal-actions-row">
            <button
              type="button"
              className="btn-outline-sm"
              disabled={isSubmitting}
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={isSubmitting}
              onClick={handleConfirmDelete}
            >
              {isSubmitting ? 'Menghapus...' : 'Ya, Hapus Koleksi'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* 6. MODAL FILTER KATEGORI                                                 */}
      {/* ========================================================================= */}
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
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="modal-actions-row">
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => {
                setSelectedCategory('Semua');
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

      {/* ========================================================================= */}
      {/* 7. MODAL POP-UP PESAN BERHASIL / GAGAL (TAMBAH, EDIT, HAPUS, IMPORT BUKU) */}
      {/* ========================================================================= */}
      <Modal
        isOpen={feedbackModal.isOpen}
        title={feedbackModal.title || (feedbackModal.type === 'success' ? 'Berhasil' : 'Gagal')}
        onClose={() => setFeedbackModal({ ...feedbackModal, isOpen: false })}
      >
        <div className="feedback-popup-box">
          <div
            className={`feedback-icon-circle ${
              feedbackModal.type === 'success' ? 'success' : 'error'
            }`}
          >
            {feedbackModal.type === 'success' ? (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            )}
          </div>
          <h4 className="feedback-popup-title">{feedbackModal.title}</h4>
          <p className="feedback-popup-message">{feedbackModal.message}</p>
          <div className="modal-actions-row" style={{ justifyContent: 'center', width: '100%' }}>
            <button
              type="button"
              className={feedbackModal.type === 'success' ? 'btn-primary' : 'btn-danger'}
              onClick={() => setFeedbackModal({ ...feedbackModal, isOpen: false })}
            >
              Tutup
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
