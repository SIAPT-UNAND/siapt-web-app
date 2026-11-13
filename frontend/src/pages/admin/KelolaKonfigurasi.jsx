import { useState } from 'react';
import Modal from '../../components/Modal.jsx';

export default function KelolaKonfigurasi({
  configurations,
  onUpdateConfig,
}) {
  const [isEditConfigModalOpen, setIsEditConfigModalOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [configValueInput, setConfigValueInput] = useState('');

  const handleOpenEditConfig = (config) => {
    setSelectedConfig(config);
    setConfigValueInput(config.nilai);
    setIsEditConfigModalOpen(true);
  };

  const handleSubmitEditConfig = (e) => {
    e.preventDefault();
    if (!selectedConfig) return;

    onUpdateConfig(selectedConfig.id_konfigurasi, configValueInput);
    setIsEditConfigModalOpen(false);
  };

  return (
    <section className="admin-config-section">
      <div className="page-header-row">
        <div>
          <h2 className="page-title">Kelola Konfigurasi Sistem</h2>
          <p className="page-subtitle">
            Sesuaikan parameter operasional perpustakaan, batas durasi pinjam, tarif denda, dan aturan sirkulasi
          </p>
        </div>
      </div>

      <div className="table-responsive-wrapper">
        <table className="custom-table">
          <thead>
            <tr>
              <th>Kunci Parameter</th>
              <th>Nilai Saat Ini</th>
              <th>Satuan</th>
              <th>Rentang Valid (Min - Maks)</th>
              <th>Deskripsi Parameter</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {configurations.map((cfg) => (
              <tr key={cfg.id_konfigurasi}>
                <td>
                  <code className="config-key">{cfg.kunci_parameter}</code>
                </td>
                <td>
                  <strong className="config-value-badge">{cfg.nilai}</strong>
                </td>
                <td>{cfg.satuan}</td>
                <td>
                  {cfg.nilai_min} - {cfg.nilai_maks}
                </td>
                <td>
                  <span className="text-subtle">{cfg.deskripsi}</span>
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    className="btn-action-primary-sm"
                    onClick={() => handleOpenEditConfig(cfg)}
                  >
                    Ubah Nilai
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Edit Konfigurasi */}
      <Modal
        isOpen={isEditConfigModalOpen}
        title="Ubah Parameter Konfigurasi"
        onClose={() => setIsEditConfigModalOpen(false)}
      >
        <form onSubmit={handleSubmitEditConfig} className="modal-form">
          <div className="form-group">
            <label className="form-label">Parameter:</label>
            <input
              type="text"
              className="form-control bg-disabled"
              value={selectedConfig?.kunci_parameter || ''}
              disabled
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              Nilai Baru ({selectedConfig?.satuan}):
            </label>
            <input
              type="text"
              className="form-control"
              value={configValueInput}
              onChange={(e) => setConfigValueInput(e.target.value)}
              required
            />
            <small className="form-hint">
              Batas minimum: {selectedConfig?.nilai_min}, maksimum:{' '}
              {selectedConfig?.nilai_maks}.
            </small>
          </div>

          <div className="modal-actions-row">
            <button
              type="button"
              className="btn-outline-sm"
              onClick={() => setIsEditConfigModalOpen(false)}
            >
              Batal
            </button>
            <button type="submit" className="btn-primary">
              Simpan Perubahan
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}

