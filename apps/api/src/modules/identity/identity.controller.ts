import { requiresTwoFactor } from '@marketplace/core';
import { Controller, Get } from '@nestjs/common';
import { CurrentUser, type CurrentUserData } from './access.js';

@Controller('me')
export class IdentityController {
  @Get()
  me(@CurrentUser() user: CurrentUserData) {
    return { ...user, twoFactorRequired: requiresTwoFactor(user.platformRole) };
  }
}
