import { Redis } from 'ioredis';
import { Pool } from 'pg';

export interface HealthProbe {
  readonly name: string;
  check(): Promise<void>;
  close(): Promise<void>;
}

/** Token de inyección de las sondas. */
export const HEALTH_PROBES = Symbol('HEALTH_PROBES');

export function postgresProbe(connectionString: string): HealthProbe {
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 1000, query_timeout: 1000 });
  // Sin este listener, un corte con la conexión en reposo tumbaría el proceso.
  pool.on('error', () => {});
  return {
    name: 'postgres',
    check: async () => {
      await pool.query('SELECT 1');
    },
    close: () => pool.end(),
  };
}

export function redisProbe(url: string): HealthProbe {
  const redis = new Redis(url, { lazyConnect: true, connectTimeout: 1000, commandTimeout: 1000, maxRetriesPerRequest: 0 });
  // Los fallos se reflejan en check(); ioredis exige un listener.
  redis.on('error', () => {});
  return {
    name: 'redis',
    check: async () => {
      await redis.ping();
    },
    close: async () => redis.disconnect(),
  };
}
