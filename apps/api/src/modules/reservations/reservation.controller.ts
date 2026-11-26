import {
  customerDecision,
  interventionInput,
  paymentInput,
  paymentReversal,
  reservationInput,
  storeDecision,
  type CustomerDecision,
  type InterventionInput,
  type PaymentInput,
  type PaymentReversal,
  type ReservationInput,
  type StoreDecision,
} from '@marketplace/contracts';
import { reservationStatuses } from '@marketplace/core';
import { Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { Actor, type ActorData } from '../../common/actor.js';
import { IdempotencyKey } from '../../common/idempotency-key.js';
import { UuidPipe } from '../../common/uuid.pipe.js';
import { ZodPipe } from '../../common/zod.pipe.js';
import { CurrentStore, CurrentUser, RequirePermission, RequireStore, type CurrentStoreData, type CurrentUserData } from '../identity/access.js';
import { AdminReservationService } from './admin-reservation.service.js';
import { CustomerReservationService } from './customer-reservation.service.js';
import { StoreReservationService } from './store-reservation.service.js';

const page = z.coerce.number().int().min(1).max(1000).default(1);
const listQuery = z.object({ page });
const storeQuery = z.object({ page, status: z.enum(reservationStatuses).optional(), refund: z.literal('pending').optional() });
const adminQuery = storeQuery.extend({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/)
    .optional(),
});

@Controller('reservations')
export class CustomerReservationController {
  constructor(@Inject(CustomerReservationService) private readonly reservations: CustomerReservationService) {}

  @Post()
  create(
    @Actor() actor: ActorData,
    @IdempotencyKey() key: string,
    @Body(new ZodPipe(reservationInput)) input: ReservationInput,
  ) {
    return this.reservations.create(actor, key, input);
  }

  @Get()
  list(@CurrentUser() user: CurrentUserData, @Query(new ZodPipe(listQuery)) query: z.output<typeof listQuery>) {
    return this.reservations.list(user.id, query.page);
  }

  @Get(':id')
  get(@CurrentUser() user: CurrentUserData, @Param('id', UuidPipe) id: string) {
    return this.reservations.get(user.id, id);
  }

  @Post(':id/accept')
  @HttpCode(200)
  accept(@Actor() actor: ActorData, @Param('id', UuidPipe) id: string, @Body(new ZodPipe(customerDecision)) input: CustomerDecision) {
    return this.reservations.accept(actor, id, input);
  }

  @Post(':id/decline')
  @HttpCode(200)
  decline(@Actor() actor: ActorData, @Param('id', UuidPipe) id: string, @Body(new ZodPipe(customerDecision)) input: CustomerDecision) {
    return this.reservations.close(actor, id, 'decline', input);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Actor() actor: ActorData, @Param('id', UuidPipe) id: string, @Body(new ZodPipe(customerDecision)) input: CustomerDecision) {
    return this.reservations.close(actor, id, 'cancel', input);
  }
}

@Controller('stores/:storeId/reservations')
export class StoreReservationController {
  constructor(@Inject(StoreReservationService) private readonly reservations: StoreReservationService) {}

  @Get()
  @RequireStore('reservation.read')
  list(@CurrentStore() store: CurrentStoreData, @Query(new ZodPipe(storeQuery)) query: z.output<typeof storeQuery>) {
    return this.reservations.list(store.id, query);
  }

  @Get(':id')
  @RequireStore('reservation.read')
  get(@CurrentStore() store: CurrentStoreData, @Param('id', UuidPipe) id: string) {
    return this.reservations.get(store.id, id);
  }

  @Post(':id/actions')
  @HttpCode(200)
  @RequireStore('reservation.approve')
  decide(
    @Actor() actor: ActorData,
    @CurrentStore() store: CurrentStoreData,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodPipe(storeDecision)) decision: StoreDecision,
  ) {
    return this.reservations.decide(actor, store, id, decision);
  }

  @Post(':id/payments')
  @RequireStore('reservation.approve')
  pay(
    @Actor() actor: ActorData,
    @CurrentStore() store: CurrentStoreData,
    @Param('id', UuidPipe) id: string,
    @Body(new ZodPipe(paymentInput)) input: PaymentInput,
  ) {
    return this.reservations.pay(actor, store, id, input);
  }

  @Post(':id/payments/:paymentId/reverse')
  @RequireStore('reservation.approve')
  reverse(
    @Actor() actor: ActorData,
    @CurrentStore() store: CurrentStoreData,
    @Param('id', UuidPipe) id: string,
    @Param('paymentId', UuidPipe) paymentId: string,
    @Body(new ZodPipe(paymentReversal)) { reason }: PaymentReversal,
  ) {
    return this.reservations.reverse(actor, store, id, paymentId, reason);
  }
}

@Controller('admin/reservations')
@RequirePermission('reservation.intervene')
export class AdminReservationController {
  constructor(@Inject(AdminReservationService) private readonly reservations: AdminReservationService) {}

  @Get()
  list(@Query(new ZodPipe(adminQuery)) query: z.output<typeof adminQuery>) {
    return this.reservations.list(query);
  }

  @Get(':id')
  get(@Actor() actor: ActorData, @Param('id', UuidPipe) id: string) {
    return this.reservations.get(actor, id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@Actor() actor: ActorData, @Param('id', UuidPipe) id: string, @Body(new ZodPipe(interventionInput)) input: InterventionInput) {
    return this.reservations.cancel(actor, id, input);
  }
}
