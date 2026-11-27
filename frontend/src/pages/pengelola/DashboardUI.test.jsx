import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import {
  DaftarBar,
  DaftarPeringkat,
  GrafikTren,
  KepalaDashboard,
  PemilihPeriode,
  StatusMuat,
} from './DashboardUI.jsx';
import { batasAtas, geserTooltip, labelTanggal } from './dashboardUtils.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const TITIK = [
  { tanggal: '2026-11-19', jumlah: 2, total_nominal: 1000 },
  { tanggal: '2026-11-20', jumlah: 0, total_nominal: 0 },
  { tanggal: '2026-11-21', jumlah: 5, total_nominal: 7500 },
];

describe('fungsi bantu grafik', () => {
  it.each([
    [0, 1],
    [1, 1],
    [3, 5],
    [7, 10],
    [12, 20],
    [480, 500],
  ])('batasAtas(%d) = %d', (nilai, hasil) => {
    expect(batasAtas(nilai)).toBe(hasil);
  });

  it('labelTanggal dan geserTooltip', () => {
    expect(labelTanggal('2026-11-21')).toBe('21 Nov');
    expect(labelTanggal('2026-08-24', 'minggu')).toBe('mgg 24 Agu');
    expect(geserTooltip(0.05)).toBe('0%');
    expect(geserTooltip(0.5)).toBe('-50%');
    expect(geserTooltip(0.95)).toBe('-100%');
  });
});

describe('PemilihPeriode', () => {
  it('menandai periode aktif dan memanggil onGanti', () => {
    const onGanti = vi.fn();
    render(<PemilihPeriode nilai="30h" onGanti={onGanti} />);
    expect(screen.getByRole('button', { name: '30 hari' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '7 hari' })).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Bulan ini' }));
    expect(onGanti).toHaveBeenCalledWith('bulan');
  });
});

describe('KepalaDashboard dan StatusMuat', () => {
  it('subjudul mengikuti periode, waktu hitung saja, atau keterangan bawaan', () => {
    const { rerender } = render(
      <KepalaDashboard
        judul="Sirkulasi"
        keterangan="Bawaan"
        data={{ periode: { label: '7 hari terakhir', mulai: '2026-11-15', akhir: '2026-11-21' }, dihitung_pada: '2026-11-21T08:49:00Z' }}
        memuat={false}
        onMuatUlang={vi.fn()}
      />,
    );
    expect(screen.getByText('7 hari terakhir (2026-11-15 s.d. 2026-11-21), dihitung pukul 15.49 WIB')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Periode' })).not.toBeInTheDocument();

    rerender(<KepalaDashboard judul="K" keterangan="Bawaan" data={{ dihitung_pada: '2026-11-21T08:49:00Z' }} memuat onMuatUlang={vi.fn()} />);
    expect(screen.getByText('Kondisi saat ini, dihitung pukul 15.49 WIB')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Memuat...' })).toBeDisabled();

    rerender(<KepalaDashboard judul="K" keterangan="Bawaan" data={null} memuat={false} onMuatUlang={vi.fn()} />);
    expect(screen.getByText('Bawaan')).toBeInTheDocument();
  });

  it('StatusMuat: memuat, error dengan Coba lagi, atau tidak tampil', () => {
    const onCobaLagi = vi.fn();
    const { rerender, container } = render(<StatusMuat memuat adaData={false} onCobaLagi={onCobaLagi} />);
    expect(screen.getByText('Menghitung indikator...')).toBeInTheDocument();

    rerender(<StatusMuat memuat={false} error="Gagal." adaData onCobaLagi={onCobaLagi} />);
    fireEvent.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(onCobaLagi).toHaveBeenCalled();

    rerender(<StatusMuat memuat adaData error="" onCobaLagi={onCobaLagi} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('DaftarBar dan DaftarPeringkat', () => {
  it('kosong menampilkan pesan', () => {
    render(<DaftarBar judul="A" baris={[]} kosong="Belum ada A." />);
    render(<DaftarPeringkat judul="B" baris={[]} kosong="Belum ada B." />);
    expect(screen.getByText('Belum ada A.')).toBeInTheDocument();
    expect(screen.getByText('Belum ada B.')).toBeInTheDocument();
  });

  it('DaftarBar menghitung total sendiri jika tidak diberikan', () => {
    render(<DaftarBar judul="Jalur" baris={[{ label: 'Mandiri', nilai: 3 }, { label: 'Loket', nilai: 1 }]} />);
    expect(screen.getByRole('row', { name: /Mandiri/ })).toHaveTextContent('75%');
  });

  it('DaftarPeringkat bernomor urut dengan bar relatif terhadap peringkat pertama', () => {
    render(
      <DaftarPeringkat
        judul="Top"
        baris={[
          { kunci: 1, label: 'Clean Code', nilai: 4 },
          { kunci: 2, label: 'Refactoring', nilai: 2 },
        ]}
      />,
    );
    const item = screen.getAllByRole('listitem');
    expect(item[0]).toHaveTextContent('1Clean Code4');
    expect(item[1].querySelector('.dsb-bar-fill')).toHaveStyle({ width: '50%' });
  });
});

describe('GrafikTren', () => {
  function tampilkan(props = {}) {
    return render(
      <GrafikTren
        judul="Tren peminjaman"
        titik={TITIK}
        satuan="hari"
        namaNilai="transaksi"
        formatTambahan={(t) => `Rp ${t.total_nominal}`}
        {...props}
      />,
    );
  }

  it('punya label aksesibel, sumbu bulat, dan tabel alternatif', () => {
    const { container } = tampilkan();
    const grafik = screen.getByRole('img', { name: /Tren peminjaman: total 7 transaksi dalam 3 hari/ });
    expect(grafik).toHaveAttribute('tabindex', '0');
    const sumbuY = [...container.querySelectorAll('.dsb-tren-axis')].map((t) => t.textContent);
    // Maksimum 5 -> garis bantu hanya 0 dan 5 (2,5 bukan bilangan bulat); lalu label tanggal sumbu X.
    expect(sumbuY.slice(0, 3)).toEqual(['0', '5', '19 Nov']);
    const tabel = within(container.querySelector('details'));
    expect(tabel.getAllByRole('row')).toHaveLength(4);
    expect(tabel.getByText('Rp 7500')).toBeInTheDocument();
  });

  it('hover menampilkan tooltip dan garis bantu; keluar menyembunyikannya', () => {
    const { container } = tampilkan();
    const area = container.querySelectorAll('.dsb-tren-hit');
    fireEvent.mouseEnter(area[2]);
    const tooltip = screen.getByRole('status');
    expect(tooltip).toHaveTextContent('21 Nov');
    expect(tooltip).toHaveTextContent('5 transaksi');
    expect(tooltip).toHaveTextContent('Rp 7500');
    expect(container.querySelector('.dsb-tren-cross')).not.toBeNull();

    fireEvent.mouseLeave(screen.getByRole('img'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keyboard: panah kanan/kiri berpindah titik, Escape dan blur menutup', () => {
    tampilkan();
    const grafik = screen.getByRole('img');
    fireEvent.keyDown(grafik, { key: 'ArrowRight' });
    expect(screen.getByRole('status')).toHaveTextContent('19 Nov');
    fireEvent.keyDown(grafik, { key: 'ArrowRight' });
    fireEvent.keyDown(grafik, { key: 'ArrowRight' });
    fireEvent.keyDown(grafik, { key: 'ArrowRight' });
    expect(screen.getByRole('status')).toHaveTextContent('21 Nov');
    fireEvent.keyDown(grafik, { key: 'ArrowLeft' });
    expect(screen.getByRole('status')).toHaveTextContent('20 Nov');
    fireEvent.keyDown(grafik, { key: 'Escape' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.keyDown(grafik, { key: 'ArrowLeft' });
    expect(screen.getByRole('status')).toHaveTextContent('21 Nov');
    fireEvent.keyDown(grafik, { key: 'Enter' });
    fireEvent.blur(grafik);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('semua nol menampilkan catatan; per minggu memakai label minggu; satu titik tetap tergambar', () => {
    render(<GrafikTren judul="T" titik={[{ tanggal: '2026-08-24', jumlah: 0 }]} satuan="minggu" namaNilai="x" />);
    expect(screen.getByText('Belum ada data pada periode ini.')).toBeInTheDocument();
    expect(screen.getAllByText('mgg 24 Agu').length).toBeGreaterThan(0);
    expect(screen.getByText('Minggu mulai')).toBeInTheDocument();
  });

  it('satu titik digambar sebagai lingkaran; lebih dari satu tidak', () => {
    const { container, rerender } = render(
      <GrafikTren judul="T" titik={[{ tanggal: '2026-11-21', jumlah: 3 }]} satuan="hari" namaNilai="x" />,
    );
    const tunggal = container.querySelector('.dsb-tren-tunggal');
    expect(tunggal).toBeInTheDocument();
    expect(tunggal).toHaveAttribute('cx', String(36 + (640 - 36 - 12) / 2));

    rerender(
      <GrafikTren
        judul="T"
        titik={[
          { tanggal: '2026-11-20', jumlah: 1 },
          { tanggal: '2026-11-21', jumlah: 3 },
        ]}
        satuan="hari"
        namaNilai="x"
      />,
    );
    expect(container.querySelector('.dsb-tren-tunggal')).not.toBeInTheDocument();
  });

  it('tanpa titik, keyboard tidak melakukan apa pun', () => {
    render(<GrafikTren judul="T" titik={[]} satuan="hari" namaNilai="x" />);
    fireEvent.keyDown(screen.getByRole('img'), { key: 'ArrowRight' });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('mengikuti lebar wadah lewat ResizeObserver', () => {
    let panggil;
    const putus = vi.fn();
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb) {
          panggil = cb;
        }
        observe() {}
        disconnect = putus;
      },
    );
    const { unmount } = tampilkan();
    act(() => panggil([{ contentRect: { width: 900.4 } }]));
    expect(screen.getByRole('img')).toHaveAttribute('width', '900');
    act(() => panggil([{ contentRect: { width: 0 } }]));
    expect(screen.getByRole('img')).toHaveAttribute('width', '900');
    unmount();
    expect(putus).toHaveBeenCalled();
  });
});

describe('komponen grafik tambahan', () => {
  it('hitungPerubahan: naik, turun, sama, dan dari nol', async () => {
    const { hitungPerubahan } = await import('./dashboardUtils.js');
    expect(hitungPerubahan(12, 10, '30 hari sebelumnya')).toEqual({ arah: 'naik', teks: 'naik 20% dari 30 hari sebelumnya (10)' });
    expect(hitungPerubahan(5, 10, 'x')).toEqual({ arah: 'turun', teks: 'turun 50% dari x (10)' });
    expect(hitungPerubahan(0, 0, 'x')).toEqual({ arah: 'sama', teks: 'sama dengan x (0)' });
    expect(hitungPerubahan(3, undefined, 'x')).toEqual({ arah: 'naik', teks: 'naik dari 0 pada x' });
  });

  it('GrafikKolom: angka di semua kolom jika sedikit, hanya yang tertinggi jika banyak', async () => {
    const { GrafikKolom } = await import('./DashboardUI.jsx');
    const { container, rerender } = render(
      <GrafikKolom judul="Per hari" baris={[{ label: 'Sen', jumlah: 2 }, { label: 'Sel', jumlah: 0 }, { label: 'Rab', jumlah: 4 }]} namaNilai="x" />,
    );
    expect([...container.querySelectorAll('.dsb-kolom-angka')].map((e) => e.textContent)).toEqual(['2', '4']);
    expect(container.querySelectorAll('.dsb-kolom-batang')[1]).toHaveStyle({ height: '0%' });

    const jam = Array.from({ length: 24 }, (_, j) => ({ label: String(j).padStart(2, '0'), jumlah: j === 5 ? 9 : 1 }));
    rerender(<GrafikKolom judul="Per jam" baris={jam} namaNilai="x" labelSetiap={6} />);
    expect([...container.querySelectorAll('.dsb-kolom-angka')].map((e) => e.textContent)).toEqual(['9']);
    expect([...container.querySelectorAll('.dsb-kolom-label')].filter((e) => e.textContent).map((e) => e.textContent)).toEqual([
      '00',
      '06',
      '12',
      '18',
    ]);
    // batang kecil tetap terlihat (minimal 3%)
    expect(container.querySelectorAll('.dsb-kolom-batang')[0]).toHaveStyle({ height: `${Math.max(3, (1 / 9) * 100)}%` });
  });

  it('GrafikKolom: tabel data bisa dibuka lewat "Lihat sebagai tabel"', async () => {
    const { GrafikKolom } = await import('./DashboardUI.jsx');
    const { container } = render(
      <GrafikKolom judul="Per hari" baris={[{ label: 'Sen', jumlah: 1200 }, { label: 'Sel', jumlah: 0 }]} namaNilai="x" />,
    );
    const ringkas = screen.getByText('Lihat sebagai tabel');
    expect(ringkas.tagName).toBe('SUMMARY');
    expect(container.querySelector('details.dsb-tabel-alt')).not.toHaveAttribute('open');
    fireEvent.click(ringkas);
    expect(container.querySelector('details.dsb-tabel-alt')).toHaveAttribute('open');

    const tabel = screen.getByRole('table', { name: 'Per hari' });
    expect(within(tabel).getByRole('columnheader', { name: 'Jumlah' })).toBeInTheDocument();
    expect(within(tabel).getByRole('rowheader', { name: 'Sen' })).toBeInTheDocument();
    expect(within(tabel).getAllByRole('row').slice(1).map((r) => r.textContent)).toEqual(['Sen1.200', 'Sel0']);
  });

  it('GrafikKolom semua nol', async () => {
    const { GrafikKolom } = await import('./DashboardUI.jsx');
    render(<GrafikKolom judul="Kosong" baris={[{ label: 'Sen', jumlah: 0 }]} namaNilai="x" />);
    expect(screen.getByRole('img')).toHaveAccessibleName('Kosong: total 0 x.');
    expect(screen.getByText('Belum ada data pada periode ini.')).toBeInTheDocument();
  });

  it('BarKomposisi: gaya sama dengan panel lain (bar hijau), dengan persentase dan keterangan', async () => {
    const { BarKomposisi } = await import('./DashboardUI.jsx');
    const { container } = render(
      <BarKomposisi
        judul="Status"
        bagian={[
          { label: 'A', nilai: 3 },
          { label: 'B', nilai: 0 },
          { label: 'C', nilai: 1 },
        ]}
        formatTambahan={(b) => `Rp ${b.nilai}`}
      />,
    );
    expect(container.querySelector('.dsb-komposisi')).toBeNull();
    expect(screen.getByRole('row', { name: /^A/ })).toHaveTextContent('75% · Rp 3');
    expect(screen.getByRole('row', { name: /^B/ })).toHaveTextContent('0% · Rp 0');
    expect(screen.getByRole('row', { name: /^A/ }).querySelector('.dsb-bar-fill')).toHaveStyle({ width: '75%' });
  });

  it('BarKomposisi tanpa bagian menampilkan pesan kosong', async () => {
    const { BarKomposisi } = await import('./DashboardUI.jsx');
    render(<BarKomposisi judul="Kosong" bagian={[]} />);
    expect(screen.getByText('Belum ada data.')).toBeInTheDocument();
  });
});
