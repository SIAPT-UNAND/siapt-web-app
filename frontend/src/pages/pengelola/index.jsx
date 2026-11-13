import DashboardAnalitik from './DashboardAnalitik.jsx';

export default function PengelolaPage({ collections, loans }) {
  return (
    <div className="page-container">
      <DashboardAnalitik collections={collections} loans={loans} />
    </div>
  );
}

