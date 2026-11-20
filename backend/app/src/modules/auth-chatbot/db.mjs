import { PrismaClient } from '@prisma/client';

const KEY = '__siaptAuthChatbotPrisma';

export const prisma = globalThis[KEY] ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis[KEY] = prisma;
}