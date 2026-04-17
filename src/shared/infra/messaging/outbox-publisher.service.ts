import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { OutboxEventOrmEntity } from './outbox-event.orm-entity';
import { DomainEvent } from '../../domain/domain-event.base';
import { randomUUID } from 'crypto';

export const RABBITMQ_CLIENT = 'RABBITMQ_CLIENT';

@Injectable()
export class OutboxPublisherService {
  private readonly logger = new Logger(OutboxPublisherService.name);

  constructor(
    @InjectRepository(OutboxEventOrmEntity)
    private readonly outboxRepo: Repository<OutboxEventOrmEntity>,
    @Inject(RABBITMQ_CLIENT)
    private readonly client: ClientProxy,
  ) {}

  async saveToOutbox(
    aggregateType: string,
    events: DomainEvent[],
    manager?: EntityManager,
  ): Promise<void> {
    const entities = events.map((e) => {
      const entity = new OutboxEventOrmEntity();
      entity.id = randomUUID();
      entity.aggregateType = aggregateType;
      entity.aggregateId = e.aggregateId;
      entity.eventType = e.eventName;
      entity.payload = { ...e };
      entity.published = false;
      return entity;
    });
    if (manager) {
      await manager.save(OutboxEventOrmEntity, entities);
      return;
    }
    await this.outboxRepo.save(entities);
  }

  async publishPending(): Promise<void> {
    const pending = await this.outboxRepo.find({
      where: { published: false },
      order: { createdAt: 'ASC' },
      take: 100,
    });

    for (const event of pending) {
      try {
        await this.client.emit(event.eventType, event.payload).toPromise();
        event.published = true;
        await this.outboxRepo.save(event);
      } catch (err) {
        this.logger.error(`Failed to publish outbox event ${event.id}: ${err}`);
      }
    }
  }
}
