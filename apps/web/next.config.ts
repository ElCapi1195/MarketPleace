import { existsSync } from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'x-content-type-options', value: 'nosniff' },
  { key: 'x-frame-options', value: 'DENY' },
  { key: 'referrer-policy', value: 'strict-origin-when-cross-origin' },
  { key: 'permissions-policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  { key: 'strict-transport-security', value: 'max-age=31536000' },
];

const isDev = process.env.NODE_ENV === 'development';

// En desarrollo, web y API comparten el .env de la raíz; las variables ya definidas tienen prioridad.
const rootEnv = path.join(import.meta.dirname, '../../.env');
if (isDev && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const config: NextConfig = {
  poweredByHeader: false,
  // El modo standalone crea enlaces simbólicos; solo se usa al construir la imagen en Linux.
  ...(process.env.NEXT_OUTPUT === 'standalone' && { output: 'standalone' as const }),
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  headers: async () => [{ source: '/:path*', headers: securityHeaders }],
  // En producción Traefik enruta /api; en desarrollo Next hace de proxy para conservar el mismo origen.
  rewrites: async () => (isDev ? [{ source: '/api/:path*', destination: 'http://127.0.0.1:4311/api/:path*' }] : []),
};

export default config;
