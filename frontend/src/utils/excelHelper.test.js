import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EXCEL_TEMPLATE_COLUMNS,
  OPTIONAL_EXCEL_COLUMNS,
  downloadExcelTemplate,
  exportCollectionsToExcel,
  parseExcelFile,
} from './excelHelper';

const makeMockFile = (content, name) => {
  const buf =
    typeof content === 'string'
      ? new TextEncoder().encode(content).buffer
      : content instanceof ArrayBuffer
        ? content
        : content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);

  return {
    name,
    size: buf.byteLength,
    arrayBuffer: async () => buf,
  };
};

describe('excelHelper', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('exports template and optional column definitions', () => {
    expect(EXCEL_TEMPLATE_COLUMNS).toContain('Judul Buku');
    expect(EXCEL_TEMPLATE_COLUMNS).toContain('ISBN');
    expect(OPTIONAL_EXCEL_COLUMNS).toEqual(
      expect.arrayContaining(['Edisi / Cetakan', 'Kode Eksemplar', 'Lokasi Rak'])
    );
  });

  it('triggers template download with expected filename and href', () => {
    const clickMock = vi.fn();
    const anchorMock = { href: '', download: '', click: clickMock };
    const createSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchorMock);
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

    downloadExcelTemplate();

    expect(createSpy).toHaveBeenCalledWith('a');
    expect(anchorMock.href).toBe('/public/template/template_import_buku.xlsx');
    expect(anchorMock.download).toBe('template_import_buku.xlsx');
    expect(appendSpy).toHaveBeenCalledWith(anchorMock);
    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith(anchorMock);
  });

  it('exports collections to an XLSX blob and round-trips through parseExcelFile', async () => {
    let capturedBlob = null;
    URL.createObjectURL = vi.fn((blob) => {
      capturedBlob = blob;
      return 'blob:mock-xlsx';
    });
    URL.revokeObjectURL = vi.fn();

    const clickMock = vi.fn();
    const anchorMock = { href: '', download: '', click: clickMock };
    vi.spyOn(document, 'createElement').mockReturnValue(anchorMock);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});

    exportCollectionsToExcel([
      {
        judul: 'Algoritma & Struktur Data <Dasar>',
        pengarang: 'Budi Raharjo, Adi Nugroho',
        kategori: 'Ilmu Komputer',
        penerbit: 'Informatika',
        tahun_terbit: 2023,
        edisi: '2',
        isbn: '9786020000011',
        nomor_panggil: '005.1 BUD a',
        bahasa: 'Indonesia',
        deskripsi: 'Buku algoritma & pemrograman "dasar".',
        eksemplar: [
          { kode_eksemplar: '001-2023-1', lokasi_rak: 'Rak A-1', status: 'TERSEDIA' },
          { kode_eksemplar: '002-2023-1', lokasi_rak: 'Rak A-2', status: 'DIPINJAM' },
        ],
      },
      {
        judul: 'Basis Data Lanjut',
        pengarang: 'Siti Aminah',
        kategori: 'Basis Data',
        penerbit: 'Andi',
        tahun_terbit: 2022,
        edisi: '',
        isbn: '9786020000022',
        nomor_panggil: '005.74 SIT b',
        bahasa: 'Indonesia',
        deskripsi: 'Materi sistem basis data.',
        lokasi_rak: 'Rak B-1',
        eksemplar: [],
      },
    ]);

    expect(anchorMock.download).toBe('Data_Koleksi_Eksemplar_SIAPT.xlsx');
    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(capturedBlob).toBeInstanceOf(Blob);

    const buf = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(capturedBlob);
    });

    const parsed = await parseExcelFile(makeMockFile(buf, 'exported.xlsx'), []);
    expect(parsed.conflicts).toEqual([]);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].judul).toBe('Algoritma & Struktur Data <Dasar>');
    expect(parsed.items[0].eksemplar).toHaveLength(2);
    expect(parsed.items[0].eksemplar.map((e) => e.kode_eksemplar)).toEqual([
      '001-2023-1',
      '002-2023-1',
    ]);
    expect(parsed.items[1].judul).toBe('Basis Data Lanjut');
    expect(parsed.items[1].eksemplar).toEqual([]);
  });

  it('parses CSV with semicolon delimiter, UTF-8 BOM, author grouping, and quoted fields', async () => {
    const csvContent =
      '\uFEFFJudul;Penulis / Pengarang;Kategori;Penerbit;Tahun Terbit;Edisi;ISBN;Nomor Panggil;Bahasa;Deskripsi;Kode Eksemplar;Lokasi Rak\n' +
      '"Clean Code ""Annotated""";Robert C. Martin, Kent Beck;Ilmu Komputer;Prentice Hall;2008;1;9780132350884;005.1 MAR c;Inggris;"Panduan, praktik; terbaik";EKS-CC-01;Rak IT-1\n' +
      '"Clean Code ""Annotated""";Kent Beck, Robert C. Martin;Ilmu Komputer;Prentice Hall;2008;1;9780132350884;005.1 MAR c;Inggris;"Panduan, praktik; terbaik";EKS-CC-02;Rak IT-2\n';

    const result = await parseExcelFile(makeMockFile(csvContent, 'import.csv'), []);
    expect(result.conflicts).toEqual([]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].judul).toBe('Clean Code "Annotated"');
    expect(result.items[0].eksemplar).toHaveLength(2);
    expect(result.items[0].lokasi_rak).toBe('Rak IT-1');
    expect(result.items[0].eksemplar.map((e) => e.lokasi_rak)).toEqual(['Rak IT-1', 'Rak IT-2']);
  });

  it('detects DB and in-file ISBN and Kode Eksemplar conflicts in CSV imports', async () => {
    const csvContent = [
      'Judul,Penulis / Pengarang,Kategori,Penerbit,Tahun Terbit,Edisi,ISBN,Nomor Panggil,Bahasa,Deskripsi,Kode Eksemplar,Lokasi Rak',
      'Buku A,Penulis A,Teknologi,Penerbit X,2024,1,111-222,001 A,Indonesia,Desc A,DUP-EKS-DB,Rak 1',
      'Buku B,Penulis B,Teknologi,Penerbit Y,2024,1,999-DB-CONFLICT,002 B,Indonesia,Desc B,DUP-IN-FILE,Rak 2',
      'Buku C,Penulis C,Teknologi,Penerbit Z,2024,1,888-IN-FILE,003 C,Indonesia,Desc C,DUP-IN-FILE,Rak 3',
      'Buku D,Penulis D,Teknologi,Penerbit W,2024,1,888-IN-FILE,004 D,Indonesia,Desc D,EKS-OK,Rak 4',
    ].join('\n');

    const existing = [
      {
        id_koleksi: 10,
        judul: 'Buku Lama',
        pengarang: 'Penulis Lama',
        penerbit: 'Penerbit Lama',
        tahun_terbit: 2020,
        isbn: '999-DB-CONFLICT',
        eksemplar: [{ kode_eksemplar: 'DUP-EKS-DB' }],
      },
    ];

    const result = await parseExcelFile(makeMockFile(csvContent, 'conflicts.csv'), existing);
    expect(result.conflicts.length).toBeGreaterThanOrEqual(4);
    expect(result.conflicts.some((c) => c.includes('DUP-EKS-DB') && c.includes('database'))).toBe(
      true
    );
    expect(
      result.conflicts.some((c) => c.includes('999-DB-CONFLICT') && c.includes('database'))
    ).toBe(true);
    expect(result.conflicts.some((c) => c.includes('DUP-IN-FILE') && c.includes('duplikat'))).toBe(
      true
    );
    expect(result.conflicts.some((c) => c.includes('888-IN-FILE'))).toBe(true);
  });

  it('rejects missing file, empty csv, missing required fields, and invalid xlsx ZIPs', async () => {
    await expect(parseExcelFile(null)).rejects.toThrow('Pilih file Excel terlebih dahulu.');
    await expect(parseExcelFile(makeMockFile('a,b', 'books.csv'))).rejects.toThrow(
      'minimal 1 baris data buku'
    );
    await expect(parseExcelFile(makeMockFile('plain', 'books.txt'))).rejects.toThrow(
      'minimal 1 baris data buku'
    );
    await expect(
      parseExcelFile(makeMockFile(new Uint8Array([1, 2, 3, 4]), 'broken.xlsx'))
    ).rejects.toThrow('minimal 1 baris data buku');

    const incompleteCsv =
      'Judul,Penulis / Pengarang,Kategori,Penerbit,Tahun Terbit,ISBN,Nomor Panggil,Bahasa,Deskripsi\n' +
      'Hanya Judul,,,,,,,,\n';
    await expect(parseExcelFile(makeMockFile(incompleteCsv, 'bad.csv'))).rejects.toThrow(
      'belum lengkap'
    );

    const emptyDataCsv =
      'Judul,Penulis / Pengarang,Kategori,Penerbit,Tahun Terbit,ISBN,Nomor Panggil,Bahasa,Deskripsi\n';
    await expect(parseExcelFile(makeMockFile(emptyDataCsv, 'empty.csv'))).rejects.toThrow(
      'minimal 1 baris data buku'
    );
  });
});
