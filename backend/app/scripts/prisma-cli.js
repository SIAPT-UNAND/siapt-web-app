import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import '../src/config/database.js';

const require = createRequire(import.meta.url);
const prismaEntry = require.resolve('prisma/build/index.js');
const result = spawnSync(
  process.execPath,
  [prismaEntry, ...process.argv.slice(2)],
  { stdio: 'inherit', env: process.env },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
