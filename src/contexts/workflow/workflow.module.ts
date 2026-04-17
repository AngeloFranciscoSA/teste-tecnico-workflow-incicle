import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

// ORM Entities
import { WorkflowTemplateOrmEntity } from './infra/persistence/typeorm/workflow-template.orm-entity';
import { TemplateVersionOrmEntity } from './infra/persistence/typeorm/template-version.orm-entity';
import { WorkflowInstanceOrmEntity } from './infra/persistence/typeorm/workflow-instance.orm-entity';
import { InstanceStepOrmEntity } from './infra/persistence/typeorm/instance-step.orm-entity';

// Repositories
import { WorkflowTemplateTypeOrmRepository } from './infra/persistence/workflow-template.typeorm-repo';
import { WorkflowInstanceTypeOrmRepository } from './infra/persistence/workflow-instance.typeorm-repo';
import { WORKFLOW_TEMPLATE_REPOSITORY } from './domain/repositories/workflow-template.repository';
import { WORKFLOW_INSTANCE_REPOSITORY } from './domain/repositories/workflow-instance.repository';

// Domain Services
import { SnapshotBuilderService } from './domain/services/snapshot-builder.service';

// Handlers
import { SubmitInstanceHandler } from './application/handlers/submit-instance.handler';
import { ApproveStepHandler } from './application/handlers/approve-step.handler';
import { RejectStepHandler } from './application/handlers/reject-step.handler';
import { GetInstanceHandler } from './application/handlers/get-instance.handler';
import { GetTimelineHandler } from './application/handlers/get-timeline.handler';
import { GetInboxHandler } from './application/handlers/get-inbox.handler';

// Controllers
import { TemplatesController } from './infra/http/templates.controller';
import { InstancesController } from './infra/http/instances.controller';
import { ApprovalsController } from './infra/http/approvals.controller';

// Delegation repository (cross-context)
import { DELEGATION_REPOSITORY } from '../delegation/domain/repositories/delegation.repository';
import { DelegationTypeOrmRepository } from '../delegation/infra/persistence/delegation.typeorm-repo';
import { DelegationOrmEntity } from '../delegation/infra/persistence/typeorm/delegation.orm-entity';

const commandHandlers = [SubmitInstanceHandler, ApproveStepHandler, RejectStepHandler];
const queryHandlers = [GetInstanceHandler, GetTimelineHandler, GetInboxHandler];

@Module({
  imports: [
    CqrsModule,
    TypeOrmModule.forFeature([
      WorkflowTemplateOrmEntity,
      TemplateVersionOrmEntity,
      WorkflowInstanceOrmEntity,
      InstanceStepOrmEntity,
      DelegationOrmEntity,
    ]),
  ],
  controllers: [TemplatesController, InstancesController, ApprovalsController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    SnapshotBuilderService,
    { provide: WORKFLOW_TEMPLATE_REPOSITORY, useClass: WorkflowTemplateTypeOrmRepository },
    { provide: WORKFLOW_INSTANCE_REPOSITORY, useClass: WorkflowInstanceTypeOrmRepository },
    { provide: DELEGATION_REPOSITORY, useClass: DelegationTypeOrmRepository },
  ],
  exports: [WORKFLOW_INSTANCE_REPOSITORY, WORKFLOW_TEMPLATE_REPOSITORY],
})
export class WorkflowModule {}
