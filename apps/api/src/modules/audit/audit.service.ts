import { Inject, Injectable } from '@nestjs/common';
import { AuditRepository, type AuditFilter, type AuditRecord } from './audit.repository.js';

const SENSITIVE = /password|token|secret|email|code|cookie|authorization/i;
const MAX_PAGE = 100;

@Injectable()
export class AuditService {
  constructor(@Inject(AuditRepository) private readonly repository: AuditRepository) {}

  /** Registra un hecho. Las claves sensibles se descartan aunque quien llama las incluya por error. */
  async record({ metadata = {}, ...event }: AuditRecord): Promise<void> {
    const safe = Object.fromEntries(Object.entries(metadata).filter(([key]) => !SENSITIVE.test(key)));
    await this.repository.insert({ ...event, metadata: safe });
  }

  async list({ limit, cursor, ...filter }: { limit: number; cursor?: string | undefined } & AuditFilter) {
    const size = Math.min(MAX_PAGE, Math.max(1, limit));
    const rows = await this.repository.findPage(size, cursor, filter);
    const actors = new Map((await this.repository.actors([...new Set(rows.flatMap(({ actorId }) => actorId ?? []))])).map((user) => [user.id, user]));
    const items = rows.map((row) => ({ ...row, actor: row.actorId ? (actors.get(row.actorId) ?? null) : null }));
    return { items, nextCursor: rows.length === size ? (rows.at(-1)?.id ?? null) : null };
  }
}
