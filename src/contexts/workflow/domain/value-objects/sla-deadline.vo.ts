import { ValueObject } from '@shared/domain';

interface SlaDeadlineProps {
  deadline: Date;
}

export class SlaDeadline extends ValueObject<SlaDeadlineProps> {
  get deadline(): Date {
    return this.props.deadline;
  }

  static fromHours(hours: number): SlaDeadline {
    const deadline = new Date(Date.now() + hours * 3600 * 1000);
    return new SlaDeadline({ deadline });
  }

  isBreached(now: Date = new Date()): boolean {
    return now > this.props.deadline;
  }
}
