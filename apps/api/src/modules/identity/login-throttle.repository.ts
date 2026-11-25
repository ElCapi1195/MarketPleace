import { Inject, Injectable } from '@nestjs/common';
import { PRISMA, type Prisma } from '../../database/prisma.js';

@Injectable()
export class LoginThrottleRepository {
  constructor(@Inject(PRISMA) private readonly prisma: Prisma) {}

  async insert(emailHash: string, at: Date): Promise<bigint> {
    const { id } = await this.prisma.loginFailure.create({ data: { emailHash, at } });
    return id;
  }

  countSince(emailHash: string, since: Date): Promise<number> {
    return this.prisma.loginFailure.count({ where: { emailHash, at: { gt: since } } });
  }

  async remove(id: bigint): Promise<void> {
    await this.prisma.loginFailure.deleteMany({ where: { id } });
  }

  async removeAll(emailHash: string): Promise<void> {
    await this.prisma.loginFailure.deleteMany({ where: { emailHash } });
  }

  async removeOlderThan(date: Date): Promise<void> {
    await this.prisma.loginFailure.deleteMany({ where: { at: { lte: date } } });
  }
}
