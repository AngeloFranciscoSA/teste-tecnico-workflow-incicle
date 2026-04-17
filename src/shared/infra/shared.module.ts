import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ScheduleModule } from '@nestjs/schedule';

import { AuditService } from './audit/audit.service';
import { AuditLogOrmEntity } from './audit/audit-log.orm-entity';
import { OutboxPublisherService, RABBITMQ_CLIENT } from './messaging/outbox-publisher.service';
import { OutboxEventOrmEntity } from './messaging/outbox-event.orm-entity';
import { OutboxSchedulerService } from './messaging/outbox-scheduler.service';

@Global()
@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([AuditLogOrmEntity, OutboxEventOrmEntity]),
    ClientsModule.registerAsync([
      {
        name: RABBITMQ_CLIENT,
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.get<string>('ASYNC_URL', 'amqp://guest:guest@localhost:5672')],
            queue: 'workflow_events',
            queueOptions: { durable: true },
            noAck: true,
          },
        }),
      },
    ]),
  ],
  providers: [AuditService, OutboxPublisherService, OutboxSchedulerService],
  exports: [ClientsModule, AuditService, OutboxPublisherService],
})
export class SharedModule {}
