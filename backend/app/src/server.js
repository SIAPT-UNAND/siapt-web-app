import dotenv from 'dotenv';
import app from './app.js';
import { startMidnightDendaScheduler } from './controllers/pengembalian.controller.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 [Express] Server running on http://localhost:${PORT}`);
  console.log(`🔗 [Express] Health check: http://localhost:${PORT}/api/health`);

  // Aktifkan penjadwal sinkronisasi denda otomatis setiap tengah malam (00:00)
  startMidnightDendaScheduler();
});
