import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SharedModule } from './shared/infra/shared.module';
import { LoggerModule } from './shared/infra/logging/logger.module';
import { WorkflowModule } from './contexts/workflow/workflow.module';
import { DelegationModule } from './contexts/delegation/delegation.module';
import { AnalyticsModule } from './contexts/analytics/analytics.module';
import { HealthModule } from './health/health.module';

import { WorkflowTemplateOrmEntity } from './contexts/workflow/infra/persistence/typeorm/workflow-template.orm-entity';
import { TemplateVersionOrmEntity } from './contexts/workflow/infra/persistence/typeorm/template-version.orm-entity';
import { WorkflowInstanceOrmEntity } from './contexts/workflow/infra/persistence/typeorm/workflow-instance.orm-entity';
import { InstanceStepOrmEntity } from './contexts/workflow/infra/persistence/typeorm/instance-step.orm-entity';
import { DelegationOrmEntity } from './contexts/delegation/infra/persistence/typeorm/delegation.orm-entity';
import { AuditLogOrmEntity } from './shared/infra/audit/audit-log.orm-entity';
import { OutboxEventOrmEntity } from './shared/infra/messaging/outbox-event.orm-entity';
import { JwtAuthGuard } from './shared/infra/auth/jwt-auth.guard';
import { InitialSchema1700000000000 } from './shared/infra/database/migrations/1700000000000-InitialSchema';
import { AddGinIndexApprovers1700000000001 } from './shared/infra/database/migrations/1700000000001-AddGinIndexApprovers';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        database: config.get('DB_NAME', 'incicle_workflow'),
        username: config.get('DB_USER', 'postgres'),
        password: config.get('DB_PASSWORD', ''),
        entities: [
          WorkflowTemplateOrmEntity,
          TemplateVersionOrmEntity,
          WorkflowInstanceOrmEntity,
          InstanceStepOrmEntity,
          DelegationOrmEntity,
          AuditLogOrmEntity,
          OutboxEventOrmEntity,
        ],
        migrations: [InitialSchema1700000000000, AddGinIndexApprovers1700000000001],
        migrationsRun: true,
        synchronize: false,
        logging: config.get('LOG_LEVEL') === 'debug',
      }),
    }),

    LoggerModule,
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
export class AppModule {}
