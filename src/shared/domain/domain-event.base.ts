export abstract class DomainEvent {
  public readonly occurredAt: Date;
  public readonly aggregateId: string;
  public readonly eventName: string;

  constructor(aggregateId: string, eventName: string) {
    this.aggregateId = aggregateId;
    this.eventName = eventName;
    this.occurredAt = new Date();
  }
}
