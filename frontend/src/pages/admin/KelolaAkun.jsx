import { useState } from 'react';
import Modal from '../../components/Modal.jsx';

export default function KelolaAkun({
  users,
  onAddUser,
  onToggleUserStatus,
}) {
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    pengenal: '',
    nama: '',
    role: 'Anggota',
  });

  const handleSubmitAddUser = (e) => {
    e.preventDefault();
    if (!userForm.pengenal.trim() || !userForm.nama.trim()) {
      alert('Pengenal dan Nama wajib diisi.');
      return;
    }

    onAddUser({
      id_pengguna: Date.now(),
      pengenal: userForm.pengenal.trim(),
      nama: userForm.nama.trim(),
      role: userForm.role,
      status_aktif: true,
      dibuat_pada: new Date().toISOString().split('T')[0],
    });

    setUserForm({ pengenal: '', nama: '', role: 'Anggota' });
    setIsAddUserModalOpen(false);
  };

  return (
    <section className="admin-accounts-section">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Kelola Akun Pengguna</h2>
          <p className="page-subtitle">
            Atur hak akses, registrasi pengguna baru, dan kontrol status aktif keanggotaan
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setIsAddUserModalOpen(true)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          <span>+ Tambah Pengguna</span>
        </button>
      </div>

      <div className="table-responsive-wrapper">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Pengenal (NIM/NIP)</th>
              <th>Nama Lengkap</th>
              <th>Peran (Role)</th>
              <th>Status Akun</th>
              <th>Tgl Dibuat</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id_pengguna}>
                <td>
                  <code>{u.pengenal}</code>
                </td>
                <td>
                  <strong>{u.nama}</strong>
                </td>
                <td>
                  <span className={`role-pill role-${u.role.toLowerCase()}`}>
                    {u.role}
                  </span>
                </td>
                <td>
                  <span
                    className={`status-pill ${
                      u.status_aktif ? 'status-active' : 'status-danger'
                    }`}
                  >
                    {u.status_aktif ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td>{u.dibuat_pada}</td>
                <td className="text-right">
                  <button
                    type="button"
                    className={`btn-action-status ${
                      u.status_aktif ? 'btn-warn-sm' : 'btn-success-sm'
                    }`}
                    onClick={() => onToggleUserStatus(u.id_pengguna)}
                  >
                    {u.status_aktif ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah User */}
      <Modal
        isOpen={isAddUserModalOpen}
        title="Tambah Akun Pengguna Baru"
        onClose={() => setIsAddUserModalOpen(false)}
      >
        <form onSubmit={handleSubmitAddUser} className="modal-form">
          <div className="form-group">
            <label className="form-label">Peran (Role) *</label>
            <select
              className="form-control"
              value={userForm.role}
              onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
            >
              <option value="Anggota">Anggota</option>
              <option value="Pustakawan">Pustakawan</option>
              <option value="Pengelola">Pengelola</option>
              <option value="Admin">Admin</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">
              Nomor Pengenal (NIM / NIP / ID) *
            </label>
            <input
              type="text"
              className="form-control"
              placeholder="Contoh: 2211523003 atau 19850101..."
              value={userForm.pengenal}
              onChange={(e) => setUserForm({ ...userForm, pengenal: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Nama Lengkap *</label>
            <input
              type="text"
              className="form-control"
              placeholder="Nama Lengkap dengan Gelar jika ada"
              value={userForm.nama}
              onChange={(e) => setUserForm({ ...userForm, nama: e.target.value })}
              required
            />
          </div>

          <div className="modal-actions-row">
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => setIsAddUserModalOpen(false)}
            >
              Batal
            </button>
            <button type="submit" className="btn-primary">
              Simpan Pengguna
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

