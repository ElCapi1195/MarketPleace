import { createPrisma } from '../database/prisma.js';
import { AuditRepository } from '../modules/audit/audit.repository.js';
import { AuditService } from '../modules/audit/audit.service.js';
import { RoleService } from '../modules/identity/role.service.js';
import { UserRepository } from '../modules/identity/user.repository.js';

// Uso: node dist/scripts/set-role.js <correo> <rol>, con DATABASE_URL definida.
const [email, role] = process.argv.slice(2);
const { DATABASE_URL } = process.env;
if (!email || !role || !DATABASE_URL) {
  console.error('Uso: DATABASE_URL=… set-role <correo> <customer|moderator|admin>');
  process.exit(1);
}

const prisma = createPrisma(DATABASE_URL);
try {
  await new RoleService(new UserRepository(prisma), new AuditService(new AuditRepository(prisma))).assign(email, role);
  console.log(`Rol ${role} asignado. Sus sesiones se han cerrado.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'No se pudo asignar el rol');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
