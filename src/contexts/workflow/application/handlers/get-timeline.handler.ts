import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetTimelineQuery } from '../queries/get-timeline.query';
import { IWorkflowInstanceRepository, WORKFLOW_INSTANCE_REPOSITORY } from '../../domain/repositories/workflow-instance.repository';
import { StepStatus } from '../../domain/aggregates/workflow-instance/instance-step.entity';

export interface TimelineEvent {
  occurredAt: Date;
  type: string;
  actorId?: string;
  stepName?: string;
  decision?: string;
  isDelegated?: boolean;
}

@QueryHandler(GetTimelineQuery)
export class GetTimelineHandler implements IQueryHandler<GetTimelineQuery, TimelineEvent[]> {
  constructor(
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly instanceRepo: IWorkflowInstanceRepository,
  ) {}

  async execute(query: GetTimelineQuery): Promise<TimelineEvent[]> {
    const instance = await this.instanceRepo.findById(query.instanceId, query.tenantId);
    if (!instance) throw new NotFoundException(`Instance "${query.instanceId}" not found`);

    const events: TimelineEvent[] = [];

    if (instance.snapshot) {
      events.push({
        occurredAt: new Date(),
        type: 'SUBMITTED',
        actorId: instance.createdBy,
      });
    }

    // Coleta decisões de todos os steps
    const domainEvents = instance.domainEvents;
    for (const event of domainEvents) {
      if (event.eventName === 'StepApproved' || event.eventName === 'StepRejected') {
        events.push({
          occurredAt: event.occurredAt,
          type: event.eventName,
        });
      }
    }

    return events.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  }
}
