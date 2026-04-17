import { DomainEvent } from '@shared/domain';

export class TemplateVersionPublishedEvent extends DomainEvent {
  constructor(
    public readonly templateId: string,
    public readonly versionId: string,
  ) {
    super(templateId, 'TemplateVersionPublished');
  }
}

export class InstanceSubmittedEvent extends DomainEvent {
  constructor(
    public readonly instanceId: string,
    public readonly tenantId: string,
  ) {
    super(instanceId, 'InstanceSubmitted');
  }
}

export class StepApprovedEvent extends DomainEvent {
  constructor(
    public readonly instanceId: string,
    public readonly stepId: string,
    public readonly actorId: string,
  ) {
    super(instanceId, 'StepApproved');
  }
}

export class StepRejectedEvent extends DomainEvent {
  constructor(
    public readonly instanceId: string,
    public readonly stepId: string,
    public readonly actorId: string,
  ) {
    super(instanceId, 'StepRejected');
  }
}

export class InstanceCompletedEvent extends DomainEvent {
  constructor(public readonly instanceId: string) {
    super(instanceId, 'InstanceCompleted');
  }
}

export class InstanceRejectedEvent extends DomainEvent {
  constructor(public readonly instanceId: string) {
    super(instanceId, 'InstanceRejected');
  }
}
