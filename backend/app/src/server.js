import dotenv from 'dotenv';
import app from './app.js';
import {
  startMidnightDendaScheduler,
  syncDendaHarian,
} from './controllers/pengembalian.controller.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 [Express] Server running on http://localhost:${PORT}`);
  console.log(`🔗 [Express] Health check: http://localhost:${PORT}/api/health`);

  // Sinkronisasi awal denda keterlambatan & aktifkan penjadwal tengah malam (00:00)
  syncDendaHarian(new Date())
    .then((res) => {
      console.log(
        `📅 [Denda Sync] Sinkronisasi denda harian aktif (${res.date_key}): ${res.updated_count} data diperbarui.`
      );
    })
    .catch((err) => {
      console.warn(`⚠️ [Denda Sync] Sinkronisasi awal dilewati: ${err.message}`);
    });

  startMidnightDendaScheduler();
});
