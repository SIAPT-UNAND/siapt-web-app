import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// PrismaClient ditiru supaya test tidak membutuhkan database.
vi.mock('@prisma/client', () => ({
  PrismaClient: class PrismaClient {
    constructor(options) {
      this.options = options;
    }
  },
}));

const muatPrisma = async () => {
  vi.resetModules();
  return import('./prisma.js');
};

describe('prisma client', () => {
  beforeEach(() => {
    delete globalThis.prisma;
  });

  afterEach(() => {
    delete globalThis.prisma;
    vi.unstubAllEnvs();
  });

  it('development: mencatat query, error, dan warn lalu menyimpan instance di globalThis', async () => {
    vi.stubEnv('NODE_ENV', 'development');

    const { prisma, default: bawaan } = await muatPrisma();

    expect(prisma.options.log).toEqual(['query', 'error', 'warn']);
    expect(globalThis.prisma).toBe(prisma);
    expect(bawaan).toBe(prisma);
  });

  it('selain development: hanya mencatat error', async () => {
    vi.stubEnv('NODE_ENV', 'test');

    const { prisma } = await muatPrisma();

    expect(prisma.options.log).toEqual(['error']);
    expect(globalThis.prisma).toBe(prisma);
  });

  it('production: tidak menyimpan instance di globalThis', async () => {
    vi.stubEnv('NODE_ENV', 'production');

    const { prisma } = await muatPrisma();

    expect(prisma.options.log).toEqual(['error']);
    expect(globalThis.prisma).toBeUndefined();
  });

  it('memakai instance yang sudah ada di globalThis', async () => {
    const lama = { nama: 'instance-lama' };
    globalThis.prisma = lama;

    const { prisma } = await muatPrisma();

    expect(prisma).toBe(lama);
  });
});