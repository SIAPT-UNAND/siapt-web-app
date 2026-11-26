/**
 * Utilitas untuk membaca file Excel (.xlsx, .xls, .csv), membuat file Template Excel (.xlsx),
 * dan mengekspor data koleksi ke Excel (.xlsx) untuk SIAPT UNAND.
 *
 * Aturan Validasi Kolom:
 * - Boleh Kosong (Opsional): Kode Eksemplar, Edisi / Cetakan, Lokasi Rak
 * - Wajib Diisi (*): Judul Buku, Penulis / Pengarang, Kategori, Penerbit, Tahun Terbit,
 *                    ISBN, Nomor Panggil, Bahasa, Deskripsi / Sinopsis Buku
 */

export const EXCEL_TEMPLATE_COLUMNS = [
  'Judul Buku',
  'Penulis / Pengarang',
  'Kategori',
  'Penerbit',
  'Tahun Terbit',
  'ISBN',
  'Nomor Panggil',
  'Edisi / Cetakan',
  'Bahasa',
  'Lokasi Rak',
  'Kode Eksemplar',
  'Deskripsi / Sinopsis Buku',
];

export const OPTIONAL_EXCEL_COLUMNS = [
  'Edisi / Cetakan',
  'Lokasi Rak',
  'Kode Eksemplar',
];

function colLettersToIndex(letters) {
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return col - 1;
}

function indexToColLetters(index) {
  let n = index + 1;
  let str = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
}

async function inflateRawBytes(compressedBytes) {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(compressedBytes);
  writer.close();

  const reader = ds.readable.getReader();
  const chunks = [];
  let totalLen = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLen += value.length;
  }

  const out = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

async function extractZipEntries(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);
  const decoder = new TextDecoder('utf-8');

  let eocdOffset = -1;
  const minEocdOffset = Math.max(0, bytes.length - 65557);
  for (let i = bytes.length - 22; i >= minEocdOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new Error('Format file .xlsx (ZIP) tidak valid');
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  let cdOffset = view.getUint32(eocdOffset + 16, true);
  const entries = {};

  for (let i = 0; i < totalEntries; i++) {
    if (view.getUint32(cdOffset, true) !== 0x02014b50) break;

    const compressionMethod = view.getUint16(cdOffset + 10, true);
    const compressedSize = view.getUint32(cdOffset + 20, true);
    const fileNameLen = view.getUint16(cdOffset + 28, true);
    const extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    const localHeaderOffset = view.getUint32(cdOffset + 42, true);

    const fileName = decoder.decode(
      bytes.subarray(cdOffset + 46, cdOffset + 46 + fileNameLen)
    );

    const localFileNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localFileNameLen + localExtraLen;
    const rawData = bytes.subarray(dataStart, dataStart + compressedSize);

    if (
      fileName === 'xl/sharedStrings.xml' ||
      fileName.startsWith('xl/worksheets/sheet')
    ) {
      let contentBytes = rawData;
      if (compressionMethod === 8) {
        contentBytes = await inflateRawBytes(rawData);
      }
      entries[fileName] = decoder.decode(contentBytes);
    }

    cdOffset += 46 + fileNameLen + extraLen + commentLen;
  }

  return entries;
}

async function parseXlsxBuffer(arrayBuffer) {
  const entries = await extractZipEntries(arrayBuffer);
  const parser = new DOMParser();

  const sharedStrings = [];
  if (entries['xl/sharedStrings.xml']) {
    const sstDoc = parser.parseFromString(
      entries['xl/sharedStrings.xml'],
      'application/xml'
    );
    const siNodes = sstDoc.getElementsByTagName('si');
    for (let i = 0; i < siNodes.length; i++) {
      const tNodes = siNodes[i].getElementsByTagName('t');
      let text = '';
      for (let j = 0; j < tNodes.length; j++) {
        text += tNodes[j].textContent || '';
      }
      sharedStrings.push(text);
    }
  }

  const sheetKey =
    entries['xl/worksheets/sheet1.xml']
      ? 'xl/worksheets/sheet1.xml'
      : Object.keys(entries)
          .filter((k) => k.startsWith('xl/worksheets/sheet'))
          .sort()[0];

  if (!sheetKey) {
    throw new Error('Tidak ditemukan lembar kerja (worksheet) di dalam file Excel.');
  }

  const sheetDoc = parser.parseFromString(entries[sheetKey], 'application/xml');
  const rowNodes = sheetDoc.getElementsByTagName('row');
  const rows2D = [];

  for (let i = 0; i < rowNodes.length; i++) {
    const rowEl = rowNodes[i];
    const cellNodes = rowEl.getElementsByTagName('c');
    const rowValues = [];

    for (let j = 0; j < cellNodes.length; j++) {
      const cell = cellNodes[j];
      const ref = cell.getAttribute('r') || '';
      const colMatch = ref.match(/^[A-Z]+/i);
      const colIdx = colMatch ? colLettersToIndex(colMatch[0].toUpperCase()) : j;

      const cellType = cell.getAttribute('t');
      let val = '';

      if (cellType === 'inlineStr') {
        const tNodes = cell.getElementsByTagName('t');
        for (let k = 0; k < tNodes.length; k++) {
          val += tNodes[k].textContent || '';
        }
      } else {
        const vNode = cell.getElementsByTagName('v')[0];
        const rawVal = vNode ? vNode.textContent || '' : '';
        if (cellType === 's') {
          const sIdx = parseInt(rawVal, 10);
          val = sharedStrings[sIdx] !== undefined ? sharedStrings[sIdx] : rawVal;
        } else {
          val = rawVal;
        }
      }

      rowValues[colIdx] = String(val).trim();
    }

    for (let c = 0; c < rowValues.length; c++) {
      if (rowValues[c] === undefined) rowValues[c] = '';
    }

    if (rowValues.some((v) => v !== '')) {
      rows2D.push(rowValues);
    }
  }

  return rows2D;
}

function parseCsvText(text) {
  const cleanText = text.replace(/^\uFEFF/, '');
  const lines = cleanText.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  return lines.map((line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  });
}

function mapHeaderToKey(headerStr, colIndex) {
  const h = String(headerStr || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (h.includes('judul') || h === 'title') return 'judul';
  if (h.includes('penulis') || h.includes('pengarang') || h === 'author') return 'pengarang';
  if (h.includes('kategori') || h === 'category') return 'kategori';
  if (h.includes('penerbit') || h === 'publisher') return 'penerbit';
  if (h.includes('tahun') || h === 'year') return 'tahun_terbit';
  if (h.includes('isbn')) return 'isbn';
  if (h.includes('panggil') || h.includes('call')) return 'nomor_panggil';
  if (h.includes('edisi') || h.includes('cetakan') || h === 'edition') return 'edisi';
  if (h.includes('bahasa') || h === 'language') return 'bahasa';
  if (h.includes('rak') || h === 'shelf') return 'lokasi_rak';
  if (h.includes('eksemplar') || h.includes('kode eksemplar') || h.includes('stok')) {
    return 'kode_eksemplar';
  }
  if (h.includes('deskripsi') || h.includes('sinopsis') || h === 'description') return 'deskripsi';

  const defaultOrder = [
    'judul',
    'pengarang',
    'kategori',
    'penerbit',
    'tahun_terbit',
    'isbn',
    'nomor_panggil',
    'edisi',
    'bahasa',
    'lokasi_rak',
    'kode_eksemplar',
    'deskripsi',
  ];
  return defaultOrder[colIndex] || null;
}

function makeBookGroupKey(judul, pengarang, penerbit, tahunTerbit) {
  const j = String(judul || '').trim().toLowerCase();
  const a = String(pengarang || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join(', ');
  const p = String(penerbit || '').trim().toLowerCase();
  const t = tahunTerbit ? String(parseInt(tahunTerbit, 10) || '') : '';
  return `${j}||${a}||${p}||${t}`;
}

/**
 * Membaca file Excel (.xlsx, .csv) dan memvalidasi bahwa:
 * - Kolom Kode Eksemplar, Edisi, dan Lokasi Rak BOLEH KOSONG (opsional).
 * - Kolom lainnya (Judul, Penulis, Kategori, Penerbit, Tahun Terbit, ISBN, Nomor Panggil, Bahasa, Deskripsi) WAJIB DIISI.
 * - Mengecek duplikat Kode Eksemplar & ISBN baik antar baris di file Excel maupun terhadap koleksi yang sudah ada di database.
 */
export async function parseExcelFile(file, existingCollections = []) {
  if (!file) {
    throw new Error('Pilih file Excel terlebih dahulu.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  let rows2D = [];

  if (bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) {
    rows2D = await parseXlsxBuffer(arrayBuffer);
  } else {
    const text = new TextDecoder('utf-8').decode(bytes);
    rows2D = parseCsvText(text);
  }

  if (rows2D.length < 2) {
    throw new Error(
      'File Excel harus memiliki baris judul kolom (header) dan minimal 1 baris data buku.'
    );
  }

  const headerRow = rows2D[0];
  const columnMap = headerRow.map((h, idx) => mapHeaderToKey(h, idx));

  // Siapkan peta ISBN dan Kode Eksemplar dari koleksi yang sudah ada di Database
  const dbIsbnMap = new Map();
  const dbEksemplarMap = new Map();

  for (const book of existingCollections || []) {
    const identityKey = makeBookGroupKey(
      book.judul,
      book.pengarang,
      book.penerbit,
      book.tahun_terbit
    );
    if (book.isbn && String(book.isbn).trim()) {
      dbIsbnMap.set(String(book.isbn).trim().toLowerCase(), {
        judul: book.judul,
        kode_koleksi: book.kode_koleksi,
        identityKey,
      });
    }
    for (const eks of book.eksemplar || []) {
      if (eks.kode_eksemplar && String(eks.kode_eksemplar).trim()) {
        dbEksemplarMap.set(String(eks.kode_eksemplar).trim().toLowerCase(), {
          kode_eksemplar: eks.kode_eksemplar,
          judul: book.judul,
        });
      }
    }
  }

  const groupedMap = new Map();
  const excelIsbnMap = new Map();
  const excelEksemplarMap = new Map();
  const conflicts = [];

  for (let r = 1; r < rows2D.length; r++) {
    const row = rows2D[r];
    if (!row || row.every((cell) => !String(cell || '').trim())) {
      continue;
    }

    const rawItem = {
      judul: '',
      pengarang: '',
      kategori: '',
      penerbit: '',
      tahun_terbit: '',
      isbn: '',
      nomor_panggil: '',
      edisi: '',
      bahasa: '',
      lokasi_rak: '',
      kode_eksemplar: '',
      deskripsi: '',
    };

    for (let c = 0; c < row.length; c++) {
      const key = columnMap[c];
      const val = row[c] !== undefined ? String(row[c]).trim() : '';
      if (!key || val === '') continue;

      if (key === 'tahun_terbit') {
        const parsedYear = parseInt(val, 10);
        if (!Number.isNaN(parsedYear)) rawItem.tahun_terbit = parsedYear;
      } else {
        rawItem[key] = val;
      }
    }

    // Validasi 9 kolom wajib (Edisi, Lokasi Rak, dan Kode Eksemplar boleh kosong)
    const missingCols = [];
    if (!rawItem.judul) missingCols.push('Judul Buku');
    if (!rawItem.pengarang) missingCols.push('Penulis / Pengarang');
    if (!rawItem.kategori) missingCols.push('Kategori');
    if (!rawItem.penerbit) missingCols.push('Penerbit');
    if (!rawItem.tahun_terbit) missingCols.push('Tahun Terbit');
    if (!rawItem.isbn) missingCols.push('ISBN');
    if (!rawItem.nomor_panggil) missingCols.push('Nomor Panggil');
    if (!rawItem.bahasa) missingCols.push('Bahasa');
    if (!rawItem.deskripsi) missingCols.push('Deskripsi / Sinopsis Buku');

    if (missingCols.length > 0) {
      throw new Error(
        `Baris ke-${r + 1} pada file Excel belum lengkap. Kolom wajib yang belum diisi: ${missingCols.join(', ')}. (Hanya kolom Edisi, Lokasi Rak, dan Kode Eksemplar yang boleh dikosongkan).`
      );
    }

    const groupKey = makeBookGroupKey(
      rawItem.judul,
      rawItem.pengarang,
      rawItem.penerbit,
      rawItem.tahun_terbit
    );

    const lowerIsbn = rawItem.isbn.toLowerCase();

    // 1. Cek apakah ISBN sudah ada pada buku lain di Database
    if (dbIsbnMap.has(lowerIsbn)) {
      const dbMatch = dbIsbnMap.get(lowerIsbn);
      if (dbMatch.identityKey !== groupKey) {
        const msg = `Baris ke-${r + 1}: ISBN "${rawItem.isbn}" pada buku "${rawItem.judul}" sudah terdaftar pada buku lain di database ("${dbMatch.judul}").`;
        if (!conflicts.includes(msg)) conflicts.push(msg);
      }
    }

    // 2. Cek apakah ISBN sama dengan buku berbeda yang akan diimport di file Excel ini
    if (excelIsbnMap.has(lowerIsbn)) {
      const prevBook = excelIsbnMap.get(lowerIsbn);
      if (prevBook.groupKey !== groupKey) {
        const msg = `Baris ke-${r + 1}: ISBN "${rawItem.isbn}" pada buku "${rawItem.judul}" sama dengan buku lain yang akan diimport pada baris ke-${prevBook.rowNum} ("${prevBook.judul}").`;
        if (!conflicts.includes(msg)) conflicts.push(msg);
      }
    } else {
      excelIsbnMap.set(lowerIsbn, {
        judul: rawItem.judul,
        groupKey,
        rowNum: r + 1,
      });
    }

    // Kode Eksemplar boleh kosong (opsional)
    const codesInRow = rawItem.kode_eksemplar
      ? rawItem.kode_eksemplar
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
      : [];

    // 3. Cek apakah Kode Eksemplar sudah ada di Database atau duplikat di dalam file Excel
    for (const code of codesInRow) {
      const lowerCode = code.toLowerCase();
      if (dbEksemplarMap.has(lowerCode)) {
        const dbEks = dbEksemplarMap.get(lowerCode);
        const msg = `Baris ke-${r + 1}: Kode Eksemplar "${code}" sudah digunakan pada buku "${dbEks.judul}" di database.`;
        if (!conflicts.includes(msg)) conflicts.push(msg);
      }
      if (excelEksemplarMap.has(lowerCode)) {
        const prevEks = excelEksemplarMap.get(lowerCode);
        const msg = `Baris ke-${r + 1}: Kode Eksemplar "${code}" duplikat dengan baris ke-${prevEks.rowNum} ("${prevEks.judul}") di dalam file Excel yang akan diimport.`;
        if (!conflicts.includes(msg)) conflicts.push(msg);
      } else {
        excelEksemplarMap.set(lowerCode, {
          judul: rawItem.judul,
          rowNum: r + 1,
        });
      }
    }

    if (!groupedMap.has(groupKey)) {
      groupedMap.set(groupKey, {
        ...rawItem,
        eksemplar: codesInRow.map((code) => ({
          kode_eksemplar: code,
          lokasi_rak: rawItem.lokasi_rak || '',
          status: 'TERSEDIA',
        })),
      });
    } else {
      const existingBook = groupedMap.get(groupKey);
      for (const code of codesInRow) {
        const alreadyInBook = existingBook.eksemplar.some(
          (e) => e.kode_eksemplar.toLowerCase() === code.toLowerCase()
        );
        if (!alreadyInBook) {
          existingBook.eksemplar.push({
            kode_eksemplar: code,
            lokasi_rak: rawItem.lokasi_rak || existingBook.lokasi_rak || '',
            status: 'TERSEDIA',
          });
        }
      }
      if (!existingBook.edisi && rawItem.edisi) existingBook.edisi = rawItem.edisi;
      if (!existingBook.lokasi_rak && rawItem.lokasi_rak) {
        existingBook.lokasi_rak = rawItem.lokasi_rak;
      }
    }
  }

  const groupedItems = Array.from(groupedMap.values()).map((book) => ({
    ...book,
    total_stok: book.eksemplar.length,
    kode_eksemplar: book.eksemplar.map((e) => e.kode_eksemplar).join(', '),
  }));

  if (groupedItems.length === 0) {
    throw new Error('Tidak ditemukan baris data buku di dalam file Excel.');
  }

  return {
    items: groupedItems,
    conflicts,
  };
}

// =========================================================================
// GENERATOR FILE EXCEL (.XLSX) UNTUK TEMPLATE & EXPORT KOLEKSI
// =========================================================================

function crc32(bytes) {
  let c = -1;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ -1) >>> 0;
}

function escapeXml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createStoredZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const cdParts = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const dataBytes = encoder.encode(file.content);
    const crc = crc32(dataBytes);

    const lh = new Uint8Array(30 + nameBytes.length);
    const lhView = new DataView(lh.buffer);
    lhView.setUint32(0, 0x04034b50, true);
    lhView.setUint16(4, 20, true);
    lhView.setUint16(6, 0, true);
    lhView.setUint16(8, 0, true);
    lhView.setUint16(10, 0, true);
    lhView.setUint16(12, 0, true);
    lhView.setUint32(14, crc, true);
    lhView.setUint32(18, dataBytes.length, true);
    lhView.setUint32(22, dataBytes.length, true);
    lhView.setUint16(26, nameBytes.length, true);
    lhView.setUint16(28, 0, true);
    lh.set(nameBytes, 30);

    const cd = new Uint8Array(46 + nameBytes.length);
    const cdView = new DataView(cd.buffer);
    cdView.setUint32(0, 0x02014b50, true);
    cdView.setUint16(4, 20, true);
    cdView.setUint16(6, 20, true);
    cdView.setUint16(8, 0, true);
    cdView.setUint16(10, 0, true);
    cdView.setUint16(12, 0, true);
    cdView.setUint16(14, 0, true);
    cdView.setUint32(16, crc, true);
    cdView.setUint32(20, dataBytes.length, true);
    cdView.setUint32(24, dataBytes.length, true);
    cdView.setUint16(28, nameBytes.length, true);
    cdView.setUint16(30, 0, true);
    cdView.setUint16(32, 0, true);
    cdView.setUint16(34, 0, true);
    cdView.setUint16(36, 0, true);
    cdView.setUint32(38, 0, true);
    cdView.setUint32(42, offset, true);
    cd.set(nameBytes, 46);

    localParts.push(lh, dataBytes);
    cdParts.push(cd);
    offset += lh.length + dataBytes.length;
  }

  let cdSize = 0;
  for (const part of cdParts) cdSize += part.length;

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, 0x06054b50, true);
  eocdView.setUint16(4, 0, true);
  eocdView.setUint16(6, 0, true);
  eocdView.setUint16(8, files.length, true);
  eocdView.setUint16(10, files.length, true);
  eocdView.setUint32(12, cdSize, true);
  eocdView.setUint32(16, offset, true);
  eocdView.setUint16(20, 0, true);

  return new Blob([...localParts, ...cdParts, eocd], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

function downloadRowsAsXlsx(rows, filename, sheetName = 'Koleksi Buku') {
  let sheetRowsXml = '';
  for (let r = 0; r < rows.length; r++) {
    const rowNum = r + 1;
    let cellsXml = '';
    for (let c = 0; c < rows[r].length; c++) {
      const colRef = `${indexToColLetters(c)}${rowNum}`;
      const val = escapeXml(rows[r][c]);
      cellsXml += `<c r="${colRef}" t="inlineStr"><is><t>${val}</t></is></c>`;
    }
    sheetRowsXml += `<row r="${rowNum}">${cellsXml}</row>`;
  }

  const files = [
    {
      name: '[Content_Types].xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '</Types>',
    },
    {
      name: '_rels/.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    },
    {
      name: 'xl/workbook.xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>` +
        '</workbook>',
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '</Relationships>',
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        `<sheetData>${sheetRowsXml}</sheetData>` +
        '</worksheet>',
    },
  ];

  const blob = createStoredZip(files);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Mengunduh langsung file template_import_buku.xlsx dari folder public/template di backend.
 */
export function downloadExcelTemplate() {
  const a = document.createElement('a');
  a.href = '/public/template/template_import_buku.xlsx';
  a.download = 'template_import_buku.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function exportCollectionsToExcel(collections = []) {
  const rows = [EXCEL_TEMPLATE_COLUMNS];

  for (const book of collections) {
    const eksList =
      Array.isArray(book.eksemplar) && book.eksemplar.length > 0
        ? book.eksemplar
        : [{ kode_eksemplar: '', lokasi_rak: book.lokasi_rak || '' }];

    for (const eks of eksList) {
      rows.push([
        book.judul || '',
        book.pengarang || '',
        book.kategori || '',
        book.penerbit || '',
        book.tahun_terbit ? String(book.tahun_terbit) : '',
        book.isbn || '',
        book.nomor_panggil || '',
        book.edisi || '',
        book.bahasa || 'Indonesia',
        eks.lokasi_rak || book.lokasi_rak || '',
        eks.kode_eksemplar || '',
        book.deskripsi || '',
      ]);
    }
  }

  downloadRowsAsXlsx(rows, 'Data_Koleksi_Eksemplar_SIAPT.xlsx', 'Data Koleksi');
}
