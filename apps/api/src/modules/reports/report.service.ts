import { can } from '@marketplace/core';
import type { ReportDetail, ReportInput, ReportPage, ReportResolution, ReportView } from '@marketplace/contracts';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ActorData } from '../../common/actor.js';
import type { Report } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import type { CurrentUserData } from '../identity/access.js';
import type { Outbox } from '../mail/outbox.js';
import { ownStore } from '../stores/store.errors.js';
import { ReportRepository } from './report.repository.js';

export const REPORT_OUTBOX = Symbol('REPORT_OUTBOX');
export interface ReportMail {
  outbox: Outbox;
  brandName: string;
  publicUrl: string;
}

const MAX_OPEN = 5;
const PAGE_SIZE = 30;
const notFound = () => new NotFoundException({ code: 'NOT_FOUND', message: 'No existe.' });

/** Tipos de denuncia que cada rol puede ver: las de reservas contienen datos privados. */
function visibleTypes(role: string): string[] {
  return [...(can(role, 'listing.moderate') ? ['PRODUCT'] : []), ...(can(role, 'reservation.intervene') ? ['RESERVATION'] : [])];
}

@Injectable()
export class ReportService {
  constructor(
    @Inject(ReportRepository) private readonly reports: ReportRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(REPORT_OUTBOX) private readonly mail: ReportMail,
  ) {}

  async create(actor: ActorData, input: ReportInput): Promise<ReportView> {
    const target = 'productSlug' in input ? await this.reports.publishedProduct(input.productSlug) : await this.reports.ownReservation(input.reservationId, actor.actorId);
    if (!target) throw notFound();
    const isProduct = 'productSlug' in input;
    const result = await this.reports.create(
      {
        reporterId: actor.actorId,
        targetType: isProduct ? 'PRODUCT' : 'RESERVATION',
        productId: isProduct ? target.id : null,
        reservationId: isProduct ? null : target.id,
        storeId: target.storeId,
        reason: input.reason,
        details: input.details,
      },
      MAX_OPEN,
    );
    if (result === 'duplicate') throw new ConflictException({ code: 'ALREADY_REPORTED', message: 'Ya denunciaste esto. Te avisaremos cuando la revisemos.' });
    if (result === 'too-many') throw new ConflictException({ code: 'TOO_MANY_REPORTS', message: `Puedes tener ${MAX_OPEN} denuncias abiertas.` });
    await this.audit.record({ ...actor, action: 'report.created', targetType: 'report', targetId: result.id });
    return (await this.mine(actor.actorId)).find(({ id }) => id === result.id) ?? notFoundView();
  }

  async mine(reporterId: string): Promise<ReportView[]> {
    return this.views(await this.reports.byReporter(reporterId));
  }

  async list(user: CurrentUserData, status: string | undefined, page: number): Promise<ReportPage> {
    const rows = await this.reports.findPage(visibleTypes(user.platformRole), status, page, PAGE_SIZE + 1);
    return { items: await this.views(rows.slice(0, PAGE_SIZE)), page, hasMore: rows.length > PAGE_SIZE };
  }

  async get(user: CurrentUserData, id: string): Promise<ReportDetail> {
    const row = await this.reports.find(id, visibleTypes(user.platformRole));
    if (!row) throw notFound();
    const [[products, reservations], [view]] = await Promise.all([
      this.reports.titles(row.productId ? [row.productId] : [], row.reservationId ? [row.reservationId] : []),
      this.views([row]),
    ]);
    const product = products[0];
    const reservation = reservations[0];
    const target = product
      ? { id: product.id, storeId: row.storeId, storeName: product.store.name, slug: product.slug, status: product.status }
      : { id: reservation?.id ?? '', storeId: row.storeId, storeName: reservation?.store.name ?? '', code: reservation?.code ?? '', status: reservation?.status ?? '' };
    return { ...(view ?? notFoundView()), details: row.details, reporter: row.reporter, target };
  }

  async resolve(user: CurrentUserData, actor: ActorData, id: string, { outcome, note }: ReportResolution): Promise<ReportDetail> {
    const row = await this.reports.find(id, visibleTypes(user.platformRole));
    if (!row) throw notFound();
    if (await this.reports.isMember(row.storeId, user.id)) throw ownStore();
    if (!(await this.reports.resolve(id, { status: outcome, resolution: note, resolvedBy: actor.actorId }))) {
      throw new ConflictException({ code: 'ALREADY_RESOLVED', message: 'Otra persona ya la resolvió.' });
    }
    await this.audit.record({ ...actor, action: `report.${outcome.toLowerCase()}`, targetType: 'report', targetId: id });
    const { outbox, brandName, publicUrl } = this.mail;
    outbox.send({
      to: row.reporter.email,
      subject: `Revisamos tu denuncia · ${brandName}`,
      text: `${outcome === 'RESOLVED' ? 'Tomamos medidas.' : 'No encontramos motivos para actuar.'}\n\n${note}\n\n${publicUrl}/cuenta`,
    });
    return this.get(user, id);
  }

  private async views(rows: readonly Report[]): Promise<ReportView[]> {
    const [products, reservations] = await this.reports.titles(
      rows.flatMap(({ productId }) => productId ?? []),
      rows.flatMap(({ reservationId }) => reservationId ?? []),
    );
    const titles = new Map<string, string>([
      ...products.map(({ id, title }): [string, string] => [id, title]),
      ...reservations.map(({ id, productTitle, code }): [string, string] => [id, `Reserva ${code}: ${productTitle}`]),
    ]);
    return rows.map((row) => ({
      id: row.id,
      targetType: row.targetType as ReportView['targetType'],
      title: titles.get(row.productId ?? row.reservationId ?? '') ?? '',
      reason: row.reason as ReportView['reason'],
      status: row.status as ReportView['status'],
      resolution: row.resolution,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    }));
  }
}

function notFoundView(): never {
  throw notFound();
}
