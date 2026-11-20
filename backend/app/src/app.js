import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import routes from './routes/index.js';
import { notFoundHandler } from './middleware/notFoundHandler.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();
const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(moduleDirectory, '../../../frontend/dist');

// Middlewares
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

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
