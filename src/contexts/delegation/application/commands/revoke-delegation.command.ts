export class RevokeDelegationCommand {
  constructor(
    public readonly delegationId: string,
    public readonly tenantId: string,
    public readonly actorId: string,
  ) {}
}
