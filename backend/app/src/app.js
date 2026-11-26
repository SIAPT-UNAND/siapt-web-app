import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import fs, { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import routes from './routes/index.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Pastikan direktori public/upload dan public/template tersedia di backend
const publicDir = path.resolve(__dirname, '../public');
const legacyQrisDir = path.resolve(__dirname, '../qris');
const uploadDir = path.resolve(__dirname, '../public/upload');
const templateDir = path.resolve(__dirname, '../public/template');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(templateDir)) {
  fs.mkdirSync(templateDir, { recursive: true });
}

const app = express();
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(moduleDirectory, '../../../frontend/dist');

// Middlewares
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(morgan('dev'));

// Static files (QRIS, Bukti Pembayaran Denda, Upload Sampul Buku, dan Template)
app.use('/upload', express.static(uploadDir));
app.use('/public/upload', express.static(uploadDir));
app.use('/template', express.static(templateDir));
app.use('/public/template', express.static(templateDir));
app.use('/public', express.static(publicDir));
app.use('/api/public', express.static(publicDir));
app.use('/public/qris', express.static(legacyQrisDir));
app.use('/api/public/qris', express.static(legacyQrisDir));

// API Routes
app.use('/api', routes);

if (existsSync(frontendDirectory)) {
  app.use(express.static(frontendDirectory));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    return res.sendFile(path.join(frontendDirectory, 'index.html'));
  });
}

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'SIAPT UNAND Application API is running',
      version: '1.0.0',
      docs: '/api/health',
    },
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
