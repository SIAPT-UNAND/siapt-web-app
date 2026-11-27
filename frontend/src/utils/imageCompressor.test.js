import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compressImageToWebp } from './imageCompressor';

describe('compressImageToWebp', () => {
  const originalImage = globalThis.Image;
  const originalFileReader = globalThis.FileReader;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.Image = originalImage;
    globalThis.FileReader = originalFileReader;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('rejects null or non-image files', async () => {
    await expect(compressImageToWebp(null)).rejects.toThrow('Mohon pilih file gambar yang valid');
    await expect(
      compressImageToWebp(new File(['hello'], 'doc.pdf', { type: 'application/pdf' }))
    ).rejects.toThrow('Mohon pilih file gambar yang valid');
  });

  it('compresses large image across quality/scale steps into a base64 WebP result', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:preview-cover');
    URL.revokeObjectURL = vi.fn();

    const drawImageMock = vi.fn();
    const clearRectMock = vi.fn();
    let blobAttempt = 0;
    const toBlobMock = vi.fn((cb) => {
      blobAttempt += 1;
      // Pertama besar (> 10KB target), attempt ke-6 cukup kecil (<= 10KB)
      const size = blobAttempt < 6 ? 25 * 1024 : 5 * 1024;
      cb(new Blob([new Uint8Array(size)], { type: 'image/webp' }));
    });

    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: drawImageMock, clearRect: clearRectMock }),
          toBlob: toBlobMock,
        };
      }
      return {};
    });

    globalThis.Image = class MockImage {
      constructor() {
        this.width = 2400;
        this.height = 1600;
      }
      set src(_val) {
        setTimeout(() => this.onload && this.onload(), 0);
      }
    };

    globalThis.FileReader = class MockFileReader {
      readAsDataURL() {
        const result = 'data:image/webp;base64,UklGRh4AAABXRUJQ';
        this.result = result;
        setTimeout(() => this.onload && this.onload({ target: { result } }), 0);
      }
    };

    const imageFile = new File([new Uint8Array(100)], 'cover.png', { type: 'image/png' });
    const result = await compressImageToWebp(imageFile, 10);

    expect(drawImageMock).toHaveBeenCalled();
    expect(toBlobMock.mock.calls.length).toBeGreaterThanOrEqual(6);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview-cover');
    expect(result).toEqual({
      dataUrl: 'data:image/webp;base64,UklGRh4AAABXRUJQ',
      sizeBytes: 5 * 1024,
      sizeKB: '5.0',
    });
  });

  it('rejects when image fails to load, canvas context is missing, or toBlob returns null', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:bad');
    URL.revokeObjectURL = vi.fn();

    globalThis.Image = class FailingImage {
      set src(_val) {
        setTimeout(() => this.onerror && this.onerror(new Error('decode failed')), 0);
      }
    };

    const imgFile = new File(['x'], 'bad.png', { type: 'image/png' });
    await expect(compressImageToWebp(imgFile)).rejects.toThrow('File gambar tidak dapat dimuat');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:bad');

    globalThis.Image = class ValidImage {
      constructor() {
        this.width = 400;
        this.height = 600;
      }
      set src(_val) {
        setTimeout(() => this.onload && this.onload(), 0);
      }
    };

    vi.spyOn(document, 'createElement').mockImplementation(() => ({
      width: 0,
      height: 0,
      getContext: () => null,
    }));
    await expect(compressImageToWebp(imgFile)).rejects.toThrow();

    vi.spyOn(document, 'createElement').mockImplementation(() => ({
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: vi.fn(), clearRect: vi.fn() }),
      toBlob: (cb) => cb(null),
    }));
    await expect(compressImageToWebp(imgFile)).rejects.toThrow(
      'Gagal mengonversi gambar ke format WebP'
    );
  });
});
