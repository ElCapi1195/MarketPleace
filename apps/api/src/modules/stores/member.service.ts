import { createHash, randomBytes } from 'node:crypto';
import type { StoreRole } from '@marketplace/core';
import type { InvitationInput, InvitationView, TeamView } from '@marketplace/contracts';
import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ActorData } from '../../common/actor.js';
import type { StoreInvitation } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import type { CurrentStoreData, CurrentUserData } from '../identity/access.js';
import { MemberRepository, type MemberChange } from './member.repository.js';
import type { StoreEmails } from './store.emails.js';
import { notApproved, notFound } from './store.errors.js';
import { STORE_EMAILS } from './store.tokens.js';

const VALID_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PENDING = 20;

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

const invitationView = ({ id, email, role, expiresAt }: StoreInvitation): InvitationView => ({
  id,
  email,
  role: role as StoreRole,
  expiresAt: expiresAt.toISOString(),
});

@Injectable()
export class MemberService {
  constructor(
    @Inject(MemberRepository) private readonly members: MemberRepository,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(STORE_EMAILS) private readonly emails: StoreEmails,
  ) {}

  async team(storeId: string): Promise<TeamView> {
    const [members, invitations] = await Promise.all([this.members.members(storeId), this.members.invitations(storeId, new Date())]);
    return {
      members: members.map(({ userId, role, user }) => ({ userId, role: role as StoreRole, ...user, twoFactorEnabled: user.twoFactorEnabled ?? false })),
      invitations: invitations.map(invitationView),
    };
  }

  /** Solo una tienda verificada envía correos a terceros. */
  async invite(actor: ActorData, store: CurrentStoreData, { email, role }: InvitationInput): Promise<InvitationView> {
    if (store.status !== 'APPROVED') throw notApproved();
    if (await this.members.isMember(store.id, email)) {
      throw new ConflictException({ code: 'ALREADY_MEMBER', message: 'Esa persona ya forma parte de la tienda.' });
    }
    const pending = await this.members.invitations(store.id, new Date());
    if (pending.length >= MAX_PENDING && !pending.some((invitation) => invitation.email === email)) {
      throw new ConflictException({ code: 'TOO_MANY_INVITATIONS', message: `Máximo ${MAX_PENDING} invitaciones pendientes.` });
    }
    const token = randomBytes(32).toString('base64url');
    const invitation = await this.members.putInvitation({
      storeId: store.id,
      email,
      role,
      tokenHash: hash(token),
      invitedBy: actor.actorId,
      expiresAt: new Date(Date.now() + VALID_MS),
    });
    await this.record(actor, 'store.member_invited', store.id, { role });
    this.emails.invitation(email, (await this.members.storeName(store.id)).name, token);
    return invitationView(invitation);
  }

  async revoke(actor: ActorData, storeId: string, id: string): Promise<void> {
    if (!(await this.members.removeInvitation(storeId, id))) throw notFound();
    await this.record(actor, 'store.invitation_revoked', storeId);
  }

  /** Un único mensaje para todo fallo: no distingue vencida, usada o de otra persona. */
  async accept(actor: ActorData, user: CurrentUserData, token: string): Promise<{ storeId: string }> {
    const result = await this.members.accept(hash(token), user, new Date());
    if (!result) {
      throw new NotFoundException({ code: 'INVITATION_INVALID', message: 'El enlace venció, ya se usó o es para otro correo.' });
    }
    await this.record(actor, 'store.member_joined', result.storeId);
    return result;
  }

  async setRole(actor: ActorData, storeId: string, userId: string, role: StoreRole): Promise<TeamView> {
    this.assertDone(await this.members.setRole(storeId, userId, role));
    await this.record(actor, 'store.member_role_changed', storeId, { member: userId, role });
    return this.team(storeId);
  }

  async remove(actor: ActorData, storeId: string, userId: string): Promise<void> {
    this.assertDone(await this.members.remove(storeId, userId));
    await this.record(actor, 'store.member_removed', storeId, { member: userId });
  }

  private assertDone(result: MemberChange): void {
    if (result === 'missing') throw notFound();
    if (result === 'last-owner') {
      throw new ConflictException({ code: 'LAST_OWNER', message: 'La tienda necesita al menos un propietario. Nombra a otro antes.' });
    }
  }

  private record(actor: ActorData, action: string, storeId: string, metadata: Record<string, string> = {}): Promise<void> {
    return this.audit.record({ ...actor, action, targetType: 'store', targetId: storeId, metadata });
  }
}
