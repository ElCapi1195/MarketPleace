import { Inject, Injectable } from '@nestjs/common';
import { AuditRepository, type AuditRecord } from './audit.repository.js';

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

  async list({ limit, cursor }: { limit: number; cursor?: string | undefined }) {
    const size = Math.min(MAX_PAGE, Math.max(1, limit));
    const items = await this.repository.findPage(size, cursor);
    return { items, nextCursor: items.length === size ? (items.at(-1)?.id ?? null) : null };
  }
}
