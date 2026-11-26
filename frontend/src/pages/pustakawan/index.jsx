import DaftarKoleksi from './DaftarKoleksi.jsx';
import PeminjamanBuku from './PeminjamanBuku.jsx';
import PengembalianBuku from './PengembalianBuku.jsx';

export default function PustakawanPage({
  activeMenu,
  currentUser,
  collections,
  dbCategories,
  dbAuthors,
  dbPublishers,
  nextBookId,
  isLoadingCollections,
  collectionError,
  onRefreshCollections,
  onAddCollection,
  onImportCollections,
  onUpdateCollection,
  onDeleteCollection,
  loans,
  onReturnLoan,
}) {
  return (
    <div className="page-container">
      {activeMenu === 'daftar-koleksi' && (
        <DaftarKoleksi
          collections={collections}
          dbCategories={dbCategories}
          dbAuthors={dbAuthors}
          dbPublishers={dbPublishers}
          nextBookId={nextBookId}
          isLoadingCollections={isLoadingCollections}
          collectionError={collectionError}
          onRefreshCollections={onRefreshCollections}
          onAddCollection={onAddCollection}
          onImportCollections={onImportCollections}
          onUpdateCollection={onUpdateCollection}
          onDeleteCollection={onDeleteCollection}
        />
      )}

      {activeMenu === 'peminjaman-buku' && (
        <PeminjamanBuku
          currentUser={currentUser}
          collections={collections}
          loans={loans}
        />
      )}

      {activeMenu === 'pengembalian-buku' && (
        <PengembalianBuku
          loans={loans}
          onReturnLoan={onReturnLoan}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
