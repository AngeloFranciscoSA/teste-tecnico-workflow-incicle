import { DomainEvent } from '@shared/domain';

export class DelegationCreatedEvent extends DomainEvent {
  constructor(
    public readonly delegationId: string,
    public readonly delegatorId: string,
    public readonly delegateId: string,
  ) {
    super(delegationId, 'DelegationCreated');
  }
}

export class DelegationRevokedEvent extends DomainEvent {
  constructor(public readonly delegationId: string) {
    super(delegationId, 'DelegationRevoked');
  }
}
