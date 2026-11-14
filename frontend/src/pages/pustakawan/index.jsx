import DaftarKoleksi from './DaftarKoleksi.jsx';
import PeminjamanBuku from './PeminjamanBuku.jsx';
import PengembalianBuku from './PengembalianBuku.jsx';

export default function PustakawanPage({
  activeMenu,
  currentUser,
  collections,
  onAddCollection,
  onUpdateCollection,
  onDeleteCollection,
  loans,
  onAddLoan,
  onReturnLoan,
}) {
  return (
    <div className="page-container">
      {activeMenu === 'daftar-koleksi' && (
        <DaftarKoleksi
          collections={collections}
          onAddCollection={onAddCollection}
          onUpdateCollection={onUpdateCollection}
          onDeleteCollection={onDeleteCollection}
        />
      )}

      {activeMenu === 'peminjaman-buku' && (
        <PeminjamanBuku
          currentUser={currentUser}
          collections={collections}
          loans={loans}
          onAddLoan={onAddLoan}
        />
      )}

      {activeMenu === 'pengembalian-buku' && (
        <PengembalianBuku
          loans={loans}
          onReturnLoan={onReturnLoan}
        />
      )}
    </div>
  );
}

