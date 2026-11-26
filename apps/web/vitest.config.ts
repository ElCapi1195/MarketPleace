import { defineConfig } from 'vitest/config';

// El mismo alias que usa Next.
export default defineConfig({ resolve: { alias: { '@': import.meta.dirname } } });
