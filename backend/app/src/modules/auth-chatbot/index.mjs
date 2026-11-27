import express, { Router } from 'express';
import authRoutes from './auth.routes.mjs';
import chatbotRoutes from './chatbot.routes.mjs';
import permintaanRoutes from './permintaan.routes.mjs';
import { sendFail } from './http.mjs';

const router = Router();

// Body JSON hanya untuk jalur milik modul ini
router.use(['/auth', '/chatbot', '/permintaan', '/pustakawan'], express.json({ limit: '10kb' }));

router.use(authRoutes);
router.use(chatbotRoutes);
router.use(permintaanRoutes);

router.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    return sendFail(res, 400, 'Format permintaan tidak valid.');
  }
  if (err?.type === 'entity.too.large') {
    return sendFail(res, 413, 'Permintaan terlalu besar.');
  }
  return next(err);
});

export default router;
export { requireAuth, requireRole } from './auth.middleware.mjs';