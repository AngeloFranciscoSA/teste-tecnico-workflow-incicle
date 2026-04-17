import { ValueObject } from '@shared/domain';

interface DelegationPeriodProps {
  startsAt: Date;
  expiresAt: Date;
}

export class DelegationPeriod extends ValueObject<DelegationPeriodProps> {
  constructor(props: DelegationPeriodProps) {
    if (props.expiresAt <= props.startsAt) {
      throw new Error('expiresAt must be after startsAt');
    }
    super(props);
  }

  get startsAt(): Date {
    return this.props.startsAt;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  contains(date: Date): boolean {
    return date >= this.props.startsAt && date <= this.props.expiresAt;
  }
}
