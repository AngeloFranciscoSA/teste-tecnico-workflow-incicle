import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';

import { SharedModule } from '../../src/shared/infra/shared.module';
import { WorkflowModule } from '../../src/contexts/workflow/workflow.module';
import { DelegationModule } from '../../src/contexts/delegation/delegation.module';
import { AnalyticsModule } from '../../src/contexts/analytics/analytics.module';
import { HealthModule } from '../../src/health/health.module';

import { WorkflowTemplateOrmEntity } from '../../src/contexts/workflow/infra/persistence/typeorm/workflow-template.orm-entity';
import { TemplateVersionOrmEntity } from '../../src/contexts/workflow/infra/persistence/typeorm/template-version.orm-entity';
import { WorkflowInstanceOrmEntity } from '../../src/contexts/workflow/infra/persistence/typeorm/workflow-instance.orm-entity';
import { InstanceStepOrmEntity } from '../../src/contexts/workflow/infra/persistence/typeorm/instance-step.orm-entity';
import { DelegationOrmEntity } from '../../src/contexts/delegation/infra/persistence/typeorm/delegation.orm-entity';
import { AuditLogOrmEntity } from '../../src/shared/infra/audit/audit-log.orm-entity';
import { OutboxEventOrmEntity } from '../../src/shared/infra/messaging/outbox-event.orm-entity';
import { RABBITMQ_CLIENT } from '../../src/shared/infra/messaging/outbox-publisher.service';
import { JwtAuthGuard } from '../../src/shared/infra/auth/jwt-auth.guard';
import { InitialSchema1700000000000 } from '../../src/shared/infra/database/migrations/1700000000000-InitialSchema';

const ALL_ENTITIES = [
  WorkflowTemplateOrmEntity,
  TemplateVersionOrmEntity,
  WorkflowInstanceOrmEntity,
  InstanceStepOrmEntity,
  DelegationOrmEntity,
  AuditLogOrmEntity,
  OutboxEventOrmEntity,
];

interface CreateTestAppOptions {
  brokerMock?: {
    emit?: () => { toPromise: () => Promise<unknown> };
    connect?: () => Promise<unknown>;
  };
}

export async function createTestApp(options: CreateTestAppOptions = {}): Promise<INestApplication> {
  const brokerMock = options.brokerMock ?? {
    emit: () => ({ toPromise: () => Promise.resolve() }),
    connect: () => Promise.resolve(),
  };

  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        entities: ALL_ENTITIES,
        migrations: [InitialSchema1700000000000],
        migrationsRun: true,
        synchronize: false,
        dropSchema: false,
        logging: false,
      }),
      SharedModule,
      WorkflowModule,
      DelegationModule,
      AnalyticsModule,
      HealthModule,
    ],
    providers: [
      {
        provide: APP_GUARD,
        useClass: JwtAuthGuard,
      },
    ],
  })
    .overrideProvider(RABBITMQ_CLIENT)
    .useValue(brokerMock)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  await app.init();
  return app;
}

export async function cleanDatabase(app: INestApplication): Promise<void> {
  const dataSource = app.get<DataSource>(getDataSourceToken());
  // Limpa na ordem inversa para respeitar FK
  await dataSource.query('DELETE FROM instance_steps');
  await dataSource.query('DELETE FROM workflow_instances');
  await dataSource.query('DELETE FROM template_versions');
  await dataSource.query('DELETE FROM templates');
  await dataSource.query('DELETE FROM delegations');
  await dataSource.query('DELETE FROM audit_logs');
  await dataSource.query('DELETE FROM outbox_events');
}
