import HomeAdmin from './HomeAdmin.jsx';
import KelolaAkun from './KelolaAkun.jsx';
import KelolaKonfigurasi from './KelolaKonfigurasi.jsx';

export default function AdminPage({
  activeMenu,
  users,
  onAddUser,
  onToggleUserStatus,
  configurations,
  onUpdateConfig,
}) {
  return (
    <div className="page-container">
      {activeMenu === 'home' && (
        <HomeAdmin users={users} configurations={configurations} />
      )}

      {activeMenu === 'kelola-akun' && (
        <KelolaAkun
          users={users}
          onAddUser={onAddUser}
          onToggleUserStatus={onToggleUserStatus}
        />
      )}

      {activeMenu === 'kelola-konfigurasi' && (
        <KelolaKonfigurasi
          configurations={configurations}
          onUpdateConfig={onUpdateConfig}
        />
      )}
    </div>
  );
}

