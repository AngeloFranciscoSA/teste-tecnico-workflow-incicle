export class SubmitInstanceCommand {
  constructor(
    public readonly instanceId: string,
    public readonly tenantId: string,
    public readonly actorId: string,
  ) {}
}
