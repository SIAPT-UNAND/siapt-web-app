/** Paginasi sederhana; tidak dirender jika hanya ada satu halaman. */
export default function Paginasi({ halaman, totalHalaman, onGanti }) {
  if (totalHalaman <= 1) return null;

  return (
    <nav className="adm-pagination" aria-label="Paginasi">
      <span className="adm-pagination-info">
        Halaman {halaman} dari {totalHalaman}
      </span>
      <button
        type="button"
        className="adm-btn"
        onClick={() => onGanti(halaman - 1)}
        disabled={halaman <= 1}
      >
        Sebelumnya
      </button>
      <button
        type="button"
        className="adm-btn"
        onClick={() => onGanti(halaman + 1)}
        disabled={halaman >= totalHalaman}
      >
        Berikutnya
      </button>
    </nav>
  );
}
