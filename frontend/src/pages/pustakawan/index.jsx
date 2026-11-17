import DaftarKoleksi from './DaftarKoleksi.jsx';
import PeminjamanBuku from './PeminjamanBuku.jsx';
import PengembalianBuku from './PengembalianBuku.jsx';

export default function PustakawanPage({
  activeMenu,
  collections,
  dbCategories,
  dbAuthors,
  dbPublishers,
  isLoadingCollections,
  collectionError,
  onRefreshCollections,
  onAddCollection,
  onImportCollections,
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
          dbCategories={dbCategories}
          dbAuthors={dbAuthors}
          dbPublishers={dbPublishers}
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
