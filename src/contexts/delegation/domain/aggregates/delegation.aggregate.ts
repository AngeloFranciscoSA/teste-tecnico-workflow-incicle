import { AggregateRoot } from '@shared/domain';
import { DelegationPeriod } from '../value-objects/delegation-period.vo';
import { DelegationCreatedEvent, DelegationRevokedEvent } from '../events/delegation.events';

interface DelegationProps {
  id: string;
  tenantId: string;
  delegatorId: string;
  delegateId: string;
  period: DelegationPeriod;
}

export class Delegation extends AggregateRoot<string> {
  public readonly tenantId: string;
  public readonly delegatorId: string;
  public readonly delegateId: string;
  private _period: DelegationPeriod;
  private _revoked: boolean = false;

  constructor(props: DelegationProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.delegatorId = props.delegatorId;
    this.delegateId = props.delegateId;
    this._period = props.period;
  }

  static create(props: DelegationProps): Delegation {
    const delegation = new Delegation(props);
    delegation.addDomainEvent(
      new DelegationCreatedEvent(props.id, props.delegatorId, props.delegateId),
    );
    return delegation;
  }

  isActive(now: Date = new Date()): boolean {
    return !this._revoked && this._period.contains(now);
  }

  revoke(): void {
    if (!this.isActive()) {
      throw new Error('Cannot revoke an inactive or already expired delegation');
    }
    this._revoked = true;
    this.addDomainEvent(new DelegationRevokedEvent(this.id));
  }

  get period(): DelegationPeriod {
    return this._period;
  }
}
