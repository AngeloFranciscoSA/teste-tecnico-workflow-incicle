import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { AuditLogOrmEntity } from './audit-log.orm-entity';

export interface AuditLogParams {
  companyId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  payload?: Record<string, any>;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogOrmEntity)
    private readonly repo: Repository<AuditLogOrmEntity>,
  ) {}

  async log(params: AuditLogParams, manager?: EntityManager): Promise<void> {
    const entry = new AuditLogOrmEntity();
    entry.id = randomUUID();
    entry.companyId = params.companyId;
    entry.entityType = params.entityType;
    entry.entityId = params.entityId;
    entry.action = params.action;
    entry.actorId = params.actorId;
    entry.payload = params.payload ?? null;
    if (manager) {
      await manager.save(AuditLogOrmEntity, entry);
      return;
    }
    await this.repo.save(entry);
  }
}
