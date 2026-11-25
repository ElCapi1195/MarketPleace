import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export type Prisma = PrismaClient;

/** Token de inyección del cliente de base de datos. */
export const PRISMA = Symbol('PRISMA');

export function createPrisma(connectionString: string): Prisma {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, max: 10, connectionTimeoutMillis: 5000, statement_timeout: 10_000 }),
  });
}
