import { invitationAccept, invitationInput, memberPatch, type InvitationInput, type MemberPatch } from '@marketplace/contracts';
import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post } from '@nestjs/common';
import { Actor, type ActorData } from '../../common/actor.js';
import { UuidPipe } from '../../common/uuid.pipe.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import {
  CurrentStore,
  CurrentUser,
  RequireStore,
  RequireTwoFactor,
  type CurrentStoreData,
  type CurrentUserData,
} from '../identity/access.js';
import { MemberService } from './member.service.js';

@Controller('stores/:storeId')
export class MemberController {
  constructor(@Inject(MemberService) private readonly members: MemberService) {}

  @Get('members')
  @RequireStore('member.manage')
  team(@CurrentStore() store: CurrentStoreData) {
    return this.members.team(store.id);
  }

  @Patch('members/:userId')
  @RequireStore('member.manage')
  setRole(
    @Actor() actor: ActorData,
    @CurrentStore() store: CurrentStoreData,
    @Param('userId') userId: string,
    @Body(new ZodPipe(memberPatch)) { role }: MemberPatch,
  ) {
    return this.members.setRole(actor, store.id, userId, role);
  }

  @Delete('members/:userId')
  @HttpCode(204)
  @RequireStore('member.manage')
  remove(@Actor() actor: ActorData, @CurrentStore() store: CurrentStoreData, @Param('userId') userId: string) {
    return this.members.remove(actor, store.id, userId);
  }

  @Post('leave')
  @HttpCode(204)
  @RequireStore('store.read')
  leave(@Actor() actor: ActorData, @CurrentStore() store: CurrentStoreData) {
    return this.members.remove(actor, store.id, actor.actorId);
  }

  @Post('invitations')
  @RequireStore('member.manage')
  invite(@Actor() actor: ActorData, @CurrentStore() store: CurrentStoreData, @Body(new ZodPipe(invitationInput)) input: InvitationInput) {
    return this.members.invite(actor, store, input);
  }

  @Delete('invitations/:id')
  @HttpCode(204)
  @RequireStore('member.manage')
  revoke(@Actor() actor: ActorData, @CurrentStore() store: CurrentStoreData, @Param('id', UuidPipe) id: string) {
    return this.members.revoke(actor, store.id, id);
  }
}

@Controller('store-invitations')
export class InvitationController {
  constructor(@Inject(MemberService) private readonly members: MemberService) {}

  @Post('accept')
  @HttpCode(200)
  @RequireTwoFactor()
  accept(
    @Actor() actor: ActorData,
    @CurrentUser() user: CurrentUserData,
    @Body(new ZodPipe(invitationAccept)) { token }: { token: string },
  ) {
    return this.members.accept(actor, user, token);
  }
}
