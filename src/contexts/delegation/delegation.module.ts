import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DelegationOrmEntity } from './infra/persistence/typeorm/delegation.orm-entity';
import { DelegationTypeOrmRepository } from './infra/persistence/delegation.typeorm-repo';
import { DELEGATION_REPOSITORY } from './domain/repositories/delegation.repository';

import { CycleDetectorService } from './domain/services/cycle-detector.service';

import { CreateDelegationHandler } from './application/handlers/create-delegation.handler';
import { RevokeDelegationHandler } from './application/handlers/revoke-delegation.handler';

import { DelegationsController } from './infra/http/delegations.controller';

@Module({
  imports: [CqrsModule, TypeOrmModule.forFeature([DelegationOrmEntity])],
  controllers: [DelegationsController],
  providers: [
    CreateDelegationHandler,
    RevokeDelegationHandler,
    CycleDetectorService,
    { provide: DELEGATION_REPOSITORY, useClass: DelegationTypeOrmRepository },
  ],
  exports: [DELEGATION_REPOSITORY],
})
export class DelegationModule {}
