import type { AdminUserDetail, AdminUserView } from '@marketplace/contracts';
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ActorData } from '../../common/actor.js';
import { AuditService } from '../audit/audit.service.js';
import { AdminUserRepository } from './admin-user.repository.js';

type Row = NonNullable<Awaited<ReturnType<AdminUserRepository['findById']>>>;

const notFound = () => new NotFoundException({ code: 'NOT_FOUND', message: 'No hay ninguna cuenta con ese correo.' });

const view = (row: Row): AdminUserView => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  suspendedAt: row.suspendedAt?.toISOString() ?? null,
});

/** Gestión de cuentas. Se busca por correo exacto: no hay listado de personas. */
@Injectable()
export class AdminUserService {
  constructor(
    @Inject(AdminUserRepository) private readonly users: AdminUserRepository,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async find(email: string): Promise<AdminUserView> {
    const row = await this.users.findByEmail(email);
    if (!row) throw notFound();
    return view(row);
  }

  async get(actor: ActorData, id: string): Promise<AdminUserDetail> {
    const row = await this.users.findById(id);
    if (!row) throw notFound();
    const { stores, byStatus, reports } = await this.users.details(id);
    const count = (status: string) => byStatus.find((item) => item.status === status)?._count._all ?? 0;
    await this.audit.record({ ...actor, action: 'user.viewed', targetType: 'user', targetId: id });
    return {
      ...view(row),
      stores: stores.map(({ role, store }) => ({ ...store, role })),
      reservations: {
        total: byStatus.reduce((sum, item) => sum + item._count._all, 0),
        completed: count('COMPLETED'),
        noShow: count('NO_SHOW'),
        cancelled: count('CANCELLED'),
      },
      reports,
    };
  }

  async suspend(actor: ActorData, id: string, reason: string): Promise<AdminUserView> {
    const row = await this.users.findById(id);
    if (!row) throw notFound();
    // A un administrador solo se le retira el rol desde la línea de órdenes.
    if (row.id === actor.actorId || row.platformRole === 'admin') {
      throw new ForbiddenException({ code: 'PROTECTED_ACCOUNT', message: 'Esta cuenta no se puede suspender desde aquí.' });
    }
    await this.audit.record({ ...actor, action: 'user.suspended', targetType: 'user', targetId: id, metadata: { reason } });
    await this.users.suspend(id, reason);
    return this.find(row.email);
  }

  async reinstate(actor: ActorData, id: string, reason: string): Promise<AdminUserView> {
    const row = await this.users.findById(id);
    if (!row) throw notFound();
    await this.audit.record({ ...actor, action: 'user.reinstated', targetType: 'user', targetId: id, metadata: { reason } });
    await this.users.reinstate(id);
    return this.find(row.email);
  }
}
