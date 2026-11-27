import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import fs, { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import routes from './routes/index.js';
import authChatbotRouter, { bodyParserModul } from './modules/auth-chatbot/index.mjs';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Pastikan direktori public/upload dan public/template tersedia di backend
const publicDir = path.resolve(__dirname, '../public');
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
app.use('/api', bodyParserModul);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(morgan('dev'));

// Static files untuk akses gambar sampul buku di public/upload dan template di public/template
app.use('/upload', express.static(uploadDir));
app.use('/public/upload', express.static(uploadDir));
app.use('/template', express.static(templateDir));
app.use('/public/template', express.static(templateDir));
app.use('/public', express.static(publicDir));

// API Routes
app.use('/api', routes);

app.use('/api', authChatbotRouter);

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