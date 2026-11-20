import './permintaan.css';

export default function StatusPermintaan({ status }) {
  const label = status || 'Baru';
  return <span className={`permintaan-badge ${label.toLowerCase()}`}>{label}</span>;
}