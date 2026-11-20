/**
 * Utilitas kompresi gambar menjadi format WebP dengan ukuran maksimal tertentu (default 100 KB).
 * Menggunakan HTML5 Canvas di browser sebelum dikirim ke backend untuk disimpan di public/upload.
 */

const canvasToWebpBlob = (canvas, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Gagal mengonversi gambar ke format WebP'));
        }
      },
      'image/webp',
      quality
    );
  });

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Gagal membaca hasil kompresi gambar'));
    reader.readAsDataURL(blob);
  });

const loadImageFromFile = (file) =>
  new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('File gambar tidak dapat dimuat'));
    };
    img.src = objectUrl;
  });

/**
 * Mengompres file gambar ke format WebP dengan batas ukuran maksimal (default 100 KB).
 * @param {File} file File gambar input
 * @param {number} maxSizeKB Ukuran maksimal dalam KB (default: 100)
 * @returns {Promise<{ dataUrl: string, sizeBytes: number, sizeKB: string }>}
 */
export async function compressImageToWebp(file, maxSizeKB = 100) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Mohon pilih file gambar yang valid (JPG, PNG, WebP).');
  }

  const maxBytes = maxSizeKB * 1024;
  const img = await loadImageFromFile(file);

  // Ukuran awal proporsional untuk sampul buku (maks lebar 600px, maks tinggi 850px)
  const MAX_INITIAL_WIDTH = 600;
  const MAX_INITIAL_HEIGHT = 850;

  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > MAX_INITIAL_WIDTH || height > MAX_INITIAL_HEIGHT) {
    const ratio = Math.min(MAX_INITIAL_WIDTH / width, MAX_INITIAL_HEIGHT / height);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  let finalBlob = null;
  let scale = 1.0;

  // Iterasi penurunan skala & kualitas hingga ukuran file <= 100 KB
  for (let attempt = 0; attempt < 5; attempt++) {
    const targetW = Math.max(80, Math.round(width * scale));
    const targetH = Math.max(110, Math.round(height * scale));

    canvas.width = targetW;
    canvas.height = targetH;
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const qualities = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25, 0.15];
    for (const q of qualities) {
      const blob = await canvasToWebpBlob(canvas, q);
      finalBlob = blob;
      if (blob.size <= maxBytes) {
        break;
      }
    }

    if (finalBlob && finalBlob.size <= maxBytes) {
      break;
    }

    // Jika masih > 100 KB pada kualitas terendah, perkecil dimensi 20% dan ulangi
    scale *= 0.8;
  }

  const dataUrl = await blobToDataUrl(finalBlob);

  return {
    dataUrl,
    sizeBytes: finalBlob.size,
    sizeKB: (finalBlob.size / 1024).toFixed(1),
  };
}

