import { isPlatformRole, platformRoles } from '@marketplace/core';
import { Inject, Injectable } from '@nestjs/common';
import { AuditService } from '../audit/audit.service.js';
import { UserRepository } from './user.repository.js';

/** Asignación de roles de plataforma. Se usa desde la línea de órdenes: ningún endpoint la expone. */
@Injectable()
export class RoleService {
  constructor(
    @Inject(UserRepository) private readonly users: UserRepository,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async assign(email: string, role: string): Promise<void> {
    if (!isPlatformRole(role)) throw new Error(`Rol desconocido "${role}". Disponibles: ${platformRoles.join(', ')}`);
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (!user) throw new Error('No existe una cuenta con ese correo');
    if (!user.emailVerified) throw new Error('La cuenta debe estar verificada');

    // Primero el rastro: si no se puede auditar, el cambio no ocurre.
    await this.audit.record({
      action: 'user.role_assigned',
      targetType: 'user',
      targetId: user.id,
      metadata: { from: user.platformRole, to: role, via: 'cli' },
    });
    await this.users.setRole(user.id, role);
  }
}
