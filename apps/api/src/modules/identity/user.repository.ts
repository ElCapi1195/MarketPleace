import { Inject, Injectable } from '@nestjs/common';
import { PRISMA, type Prisma } from '../../database/prisma.js';

@Injectable()
export class UserRepository {
  constructor(@Inject(PRISMA) private readonly prisma: Prisma) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /** Cambia el rol y cierra las sesiones abiertas, todo o nada. */
  async setRole(id: string, platformRole: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { platformRole } }),
      this.prisma.session.deleteMany({ where: { userId: id } }),
    ]);
  }
}
