import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import SampulBuku from './SampulBuku.jsx';

afterEach(() => {
  cleanup(); // vitest tanpa globals: bersihkan tampilan setiap selesai test
});

describe('SampulBuku', () => {
  it('tanpa gambar: menampilkan huruf awal judul dengan warna', () => {
    const { container } = render(<SampulBuku judul="clean code" />);
    const sampul = container.querySelector('.sampul-buku');
    expect(sampul).toHaveTextContent('C');
    expect(sampul.style.background).not.toBe('');
    expect(container.querySelector('img')).toBeNull();
  });

  it('dengan gambar: menampilkan gambar sampul', () => {
    const { container } = render(<SampulBuku judul="Clean Code" src="/covers/clean-code.jpg" />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/covers/clean-code.jpg');
  });

  it('gambar gagal dimuat: kembali ke huruf awal judul', () => {
    const { container } = render(<SampulBuku judul="Refactoring" src="/covers/tidak-ada.jpg" />);
    fireEvent.error(container.querySelector('img'));
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.sampul-buku')).toHaveTextContent('R');
  });
});
