export class CreateDelegationCommand {
  constructor(
    public readonly id: string,
    public readonly tenantId: string,
    public readonly delegatorId: string,
    public readonly delegateId: string,
    public readonly startsAt: Date,
    public readonly expiresAt: Date,
  ) {}
}
