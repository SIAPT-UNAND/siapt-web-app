import './admin.css';
import HomeAdmin from './HomeAdmin.jsx';
import KelolaAkun from './KelolaAkun.jsx';
import KelolaHakAkses from './KelolaHakAkses.jsx';
import KelolaKonfigurasi from './KelolaKonfigurasi.jsx';

export default function AdminPage({
  activeMenu,
  currentUser,
  onSelectMenu,
  configurations,
  onUpdateConfig,
}) {
  return (
    <div className="page-container">
      {activeMenu === 'home' && <HomeAdmin onSelectMenu={onSelectMenu} />}

      {activeMenu === 'kelola-akun' && <KelolaAkun currentUser={currentUser} />}

      {activeMenu === 'kelola-hak-akses' && <KelolaHakAkses currentUser={currentUser} />}

      {activeMenu === 'kelola-konfigurasi' && (
        <KelolaKonfigurasi
          configurations={configurations}
          onUpdateConfig={onUpdateConfig}
        />
      )}
    </div>
  );
}
