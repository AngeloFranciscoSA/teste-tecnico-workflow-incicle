import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import {
  IDelegationRepository,
  DelegationEdgeSummary,
} from '../../domain/repositories/delegation.repository';
import { Delegation } from '../../domain/aggregates/delegation.aggregate';
import { DelegationPeriod } from '../../domain/value-objects/delegation-period.vo';
import { DelegationOrmEntity } from './typeorm/delegation.orm-entity';

@Injectable()
export class DelegationTypeOrmRepository implements IDelegationRepository {
  constructor(
    @InjectRepository(DelegationOrmEntity)
    private readonly repo: Repository<DelegationOrmEntity>,
  ) {}

  async findById(id: string, tenantId: string): Promise<Delegation | null> {
    const orm = await this.repo.findOne({ where: { id, companyId: tenantId } });
    return orm ? this.toDomain(orm) : null;
  }

  async findActiveForDelegate(delegateId: string, tenantId: string): Promise<Delegation | null> {
    const now = new Date();
    const orm = await this.repo.findOne({
      where: {
        delegateId,
        companyId: tenantId,
        active: true,
        startsAt: LessThanOrEqual(now),
        expiresAt: MoreThanOrEqual(now),
      },
    });
    return orm ? this.toDomain(orm) : null;
  }

  async findAllActiveEdges(tenantId: string): Promise<DelegationEdgeSummary[]> {
    const now = new Date();
    const orms = await this.repo.find({
      where: {
        companyId: tenantId,
        active: true,
        startsAt: LessThanOrEqual(now),
        expiresAt: MoreThanOrEqual(now),
      },
      select: ['delegatorId', 'delegateId'],
    });
    return orms.map((o) => ({ delegatorId: o.delegatorId, delegateId: o.delegateId }));
  }

  async save(delegation: Delegation): Promise<void> {
    const orm = this.toOrm(delegation);
    await this.repo.save(orm);
  }

  async findAll(tenantId: string): Promise<Delegation[]> {
    const orms = await this.repo.find({ where: { companyId: tenantId } });
    return orms.map((o) => this.toDomain(o));
  }

  async findActive(tenantId: string): Promise<Delegation[]> {
    const now = new Date();
    const orms = await this.repo.find({
      where: {
        companyId: tenantId,
        active: true,
        startsAt: LessThanOrEqual(now),
        expiresAt: MoreThanOrEqual(now),
      },
    });
    return orms.map((o) => this.toDomain(o));
  }

  private toDomain(orm: DelegationOrmEntity): Delegation {
    return new Delegation({
      id: orm.id,
      tenantId: orm.companyId,
      delegatorId: orm.delegatorId,
      delegateId: orm.delegateId,
      period: new DelegationPeriod({ startsAt: orm.startsAt, expiresAt: orm.expiresAt }),
    });
  }

  private toOrm(delegation: Delegation): DelegationOrmEntity {
    const orm = new DelegationOrmEntity();
    orm.id = delegation.id;
    orm.companyId = delegation.tenantId;
    orm.delegatorId = delegation.delegatorId;
    orm.delegateId = delegation.delegateId;
    orm.startsAt = delegation.period.startsAt;
    orm.expiresAt = delegation.period.expiresAt;
    orm.active = delegation.isActive();
    return orm;
  }
}
