import { randomUUID } from 'crypto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SubmitInstanceCommand } from '../commands/submit-instance.command';
import { IWorkflowInstanceRepository, WORKFLOW_INSTANCE_REPOSITORY } from '../../domain/repositories/workflow-instance.repository';
import { IWorkflowTemplateRepository, WORKFLOW_TEMPLATE_REPOSITORY } from '../../domain/repositories/workflow-template.repository';
import { SnapshotBuilderService } from '../../domain/services/snapshot-builder.service';
import { InstanceStep, StepStatus } from '../../domain/aggregates/workflow-instance/instance-step.entity';
import { AuditService } from '../../../../shared/infra/audit/audit.service';
import { OutboxPublisherService } from '../../../../shared/infra/messaging/outbox-publisher.service';

@CommandHandler(SubmitInstanceCommand)
export class SubmitInstanceHandler implements ICommandHandler<SubmitInstanceCommand> {
  constructor(
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly instanceRepo: IWorkflowInstanceRepository,
    @Inject(WORKFLOW_TEMPLATE_REPOSITORY)
    private readonly templateRepo: IWorkflowTemplateRepository,
    private readonly dataSource: DataSource,
    private readonly snapshotBuilder: SnapshotBuilderService,
    private readonly auditService: AuditService,
    private readonly outboxPublisher: OutboxPublisherService,
  ) {}

  async execute(command: SubmitInstanceCommand): Promise<void> {
    const { instanceId, tenantId, actorId } = command;

    const instance = await this.instanceRepo.findById(instanceId, tenantId);
    if (!instance) throw new NotFoundException(`Instance "${instanceId}" not found`);

    const version = await this.templateRepo.findPublishedVersion(instance.templateId, instance.versionId);
    if (!version) {
      throw new UnprocessableEntityException(
        `Template version "${instance.versionId}" is not published`,
      );
    }

    const snapshot = this.snapshotBuilder.build(version);

    const steps = snapshot.steps.map(
      (s) =>
        new InstanceStep({
          id: randomUUID(),
          instanceId,
          stepOrder: s.stepOrder,
          stepName: s.stepName,
          approvalRule: s.approvalRule,
          approvers: s.approvers,
          slaHours: s.slaHours,
          slaDeadline: new Date(Date.now() + s.slaHours * 3600_000),
          slaBreached: false,
          status: StepStatus.PENDING,
          version: 0,
        }),
    );

    instance.submit(snapshot, steps);

    const events = instance.domainEvents;
    await this.dataSource.transaction(async (manager) => {
      await this.instanceRepo.save(instance, manager);
      await this.auditService.log(
        {
          companyId: tenantId,
          entityType: 'WorkflowInstance',
          entityId: instanceId,
          action: 'SUBMITTED',
          actorId,
          payload: { versionId: instance.versionId, stepsCount: steps.length },
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
