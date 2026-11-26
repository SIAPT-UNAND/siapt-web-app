import dotenv from 'dotenv';

dotenv.config();

const {
  DB_HOST = 'localhost',
  DB_PORT = '3306',
  DB_NAME = 'siapt',
  DB_USER = 'root',
  DB_PASSWORD = '',
  DATABASE_URL,
} = process.env;

export const databaseUrl =
  DATABASE_URL ||
  `mysql://${encodeURIComponent(DB_USER)}:${encodeURIComponent(DB_PASSWORD)}@${DB_HOST}:${DB_PORT}/${encodeURIComponent(DB_NAME)}`;

if (!DATABASE_URL) {
  process.env.DATABASE_URL = databaseUrl;
}
