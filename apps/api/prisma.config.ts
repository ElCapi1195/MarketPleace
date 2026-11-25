import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Rol propietario, distinto del de la aplicación. Generar el cliente no necesita conexión.
  datasource: { url: process.env.MIGRATION_DATABASE_URL ?? '' },
});
