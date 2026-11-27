import { useState } from 'react';
import { ajukanPermintaan } from '../services/permintaanService.js';

// Eskalasi pertanyaan yang tidak terjawab chatbot ke antrian Pustakawan
export default function TombolAjukan({ idPesan, isi, diajukan, onDiajukan }) {
  const [mengirim, setMengirim] = useState(false);
  const [error, setError] = useState('');

  if (diajukan) {
    return <p className="chatbot-note">Sudah diajukan ke Pustakawan.</p>;
  }

  async function ajukan() {
    setMengirim(true);
    setError('');
    try {
      await ajukanPermintaan(idPesan, isi.slice(0, 1000));
      onDiajukan();
    } catch (err) {
      // 409: pesan ini sudah pernah diajukan
      if (err.status === 409) onDiajukan();
      else setError(err.message);
    } finally {
      setMengirim(false);
    }
  }

  return (
    <>
      <button type="button" className="chatbot-chip" onClick={ajukan} disabled={mengirim}>
        {mengirim ? 'Mengajukan…' : 'Ajukan ke Pustakawan'}
      </button>
      {error && <p className="chatbot-note chatbot-note-error">{error}</p>}
    </>
  );
}
