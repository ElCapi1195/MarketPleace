import { defineConfig } from 'vitest/config';

// Cada archivo arranca su propio Postgres: con demasiados a la vez, las pruebas de concurrencia agotan el tiempo.
export default defineConfig({ test: { maxWorkers: 6, testTimeout: 20_000 } });
