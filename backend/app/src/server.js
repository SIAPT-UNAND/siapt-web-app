import dotenv from 'dotenv';

dotenv.config();
import './config/database.js';

const [{ default: app }, { default: prisma }, { startMidnightDendaScheduler }] =
  await Promise.all([
    import('./app.js'),
    import('./lib/prisma.js'),
    import('./controllers/pengembalian.controller.js'),
  ]);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await prisma.$connect();

  const server = app.listen(PORT);

  await new Promise((resolve, reject) => {
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    server.once('listening', onListening);
    server.once('error', onError);
  });

  console.log(`🚀 [Express] Server running on http://localhost:${PORT}`);
  console.log(`🔗 [Express] Health check: http://localhost:${PORT}/api/health`);

  // Aktifkan penjadwal sinkronisasi denda otomatis setiap tengah malam (00:00)
  startMidnightDendaScheduler();

  const shutdown = (signal) => {
    console.log(`Received ${signal}. Shutting down gracefully.`);
    server.close(async (error) => {
      await prisma.$disconnect();
      if (error) {
        console.error('Error while shutting down the server:', error);
        process.exit(1);
      }
      process.exit(0);
    });
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
};

startServer().catch(async (error) => {
  console.error('Failed to start the application:', error);
  await prisma.$disconnect();
  process.exit(1);
});
