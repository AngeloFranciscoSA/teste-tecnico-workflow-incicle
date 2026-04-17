import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RejectStepCommand } from '../commands/reject-step.command';
import { IWorkflowInstanceRepository, WORKFLOW_INSTANCE_REPOSITORY } from '../../domain/repositories/workflow-instance.repository';
import { IDelegationRepository, DELEGATION_REPOSITORY } from '../../../delegation/domain/repositories/delegation.repository';
import { AuditService } from '../../../../shared/infra/audit/audit.service';
import { OutboxPublisherService } from '../../../../shared/infra/messaging/outbox-publisher.service';

@CommandHandler(RejectStepCommand)
export class RejectStepHandler implements ICommandHandler<RejectStepCommand> {
  constructor(
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly instanceRepo: IWorkflowInstanceRepository,
    @Inject(DELEGATION_REPOSITORY)
    private readonly delegationRepo: IDelegationRepository,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly outboxPublisher: OutboxPublisherService,
  ) {}

  async execute(command: RejectStepCommand): Promise<void> {
    const { instanceId, stepId, actorId, tenantId, comment } = command;

    const instance = await this.instanceRepo.findById(instanceId, tenantId);
    if (!instance) throw new NotFoundException(`Instance "${instanceId}" not found`);

    const delegation = await this.delegationRepo.findActiveForDelegate(actorId, tenantId);
    const isDelegated = !!delegation;
    const originalApproverId = delegation?.delegatorId;
    const step = instance.findStep(stepId);

    if (!step) throw new BadRequestException(`Step "${stepId}" not found`);

    if (!step.canBeDecidedBy(actorId, originalApproverId)) {
      throw new ForbiddenException(
        `Actor "${actorId}" is not allowed to reject step "${stepId}"`,
      );
    }

    try {
      instance.decide(stepId, actorId, 'reject', isDelegated, originalApproverId);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }

    const events = instance.domainEvents;
    await this.dataSource.transaction(async (manager) => {
      await this.instanceRepo.save(instance, manager);
      await this.auditService.log(
        {
          companyId: tenantId,
          entityType: 'WorkflowInstance',
          entityId: instanceId,
          action: 'STEP_REJECTED',
          actorId,
          payload: { stepId, isDelegated, originalApproverId, comment },
        },
        manager,
      );
      if (events.length > 0) {
        await this.outboxPublisher.saveToOutbox('WorkflowInstance', events, manager);
      }
    });

    if (events.length > 0) {
      instance.clearDomainEvents();
      await this.outboxPublisher.publishPending();
    }
  }
}
