import { useState } from 'react';

const CATEGORY_THEMES = {
  'Ilmu Komputer': {
    bg: 'linear-gradient(145deg, #1e3a8a, #0284c7)',
    accent: '#38bdf8',
  },
  'Ilmu Komputer & Sistem Informasi': {
    bg: 'linear-gradient(145deg, #1e3a8a, #0284c7)',
    accent: '#38bdf8',
  },
  'Sastra & Fiksi': {
    bg: 'linear-gradient(145deg, #7c2d12, #c2410c)',
    accent: '#fdba74',
  },
  'Sastra & Humaniora': {
    bg: 'linear-gradient(145deg, #7c2d12, #c2410c)',
    accent: '#fdba74',
  },
  'Sains & Data': {
    bg: 'linear-gradient(145deg, #312e81, #4f46e5)',
    accent: '#a5b4fc',
  },
  'Sains & Teknologi Terapan': {
    bg: 'linear-gradient(145deg, #312e81, #4f46e5)',
    accent: '#a5b4fc',
  },
  'Sosial & Humaniora': {
    bg: 'linear-gradient(145deg, #064e3b, #059669)',
    accent: '#6ee7b7',
  },
  'Teknik & Rekayasa': {
    bg: 'linear-gradient(145deg, #0f172a, #334155)',
    accent: '#94a3b8',
  },
};

export default function BookCover({
  src,
  title = 'Buku',
  author = '',
  category = '',
  size = 'md',
  className = '',
}) {
  // Lacak src yang gagal dimuat agar saat src diganti ke gambar baru, gambar baru tetap dirender
  const [failedSrc, setFailedSrc] = useState(null);
  const hasError = Boolean(src && failedSrc === src);

  // Jika src valid dan tidak error, render gambar sampul asli
  if (src && !hasError) {
    return (
      <div className={`book-cover-wrapper size-${size} ${className}`}>
        <img
          src={src}
          alt={`Sampul ${title}`}
          className="book-cover-image"
          onError={() => setFailedSrc(src)}
          loading="lazy"
        />
      </div>
    );
  }

  // Fallback styled book cover
  const theme = CATEGORY_THEMES[category] || {
    bg: 'linear-gradient(145deg, #134e4a, #047857)',
    accent: '#34d399',
  };

  return (
    <div
      className={`book-cover-wrapper book-cover-fallback size-${size} ${className}`}
      style={{ background: theme.bg }}
      title={`${title} oleh ${author}`}
    >
      <div className="book-cover-spine"></div>
      <div className="book-cover-content">
        <div className="book-cover-top">
          <svg
            className="book-cover-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
          </svg>
          {size !== 'sm' && category && (
            <span className="book-cover-category" style={{ color: theme.accent }}>
              {category}
            </span>
          )}
        </div>

        <div className="book-cover-text">
          <div className="book-cover-title">{title}</div>
          {size !== 'sm' && author && (
            <div className="book-cover-author">{author}</div>
          )}
        </div>

        {size !== 'sm' && (
          <div className="book-cover-footer">
            <span className="book-cover-logo">SIAPT UNAND</span>
          </div>
        )}
      </div>
    </div>
  );
}
