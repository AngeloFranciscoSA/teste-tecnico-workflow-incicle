export class RejectStepCommand {
  constructor(
    public readonly instanceId: string,
    public readonly stepId: string,
    public readonly actorId: string,
    public readonly tenantId: string,
    public readonly comment?: string,
  ) {}
}
