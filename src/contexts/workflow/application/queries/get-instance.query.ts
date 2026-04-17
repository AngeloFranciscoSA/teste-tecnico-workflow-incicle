export class GetInstanceQuery {
  constructor(
    public readonly instanceId: string,
    public readonly tenantId: string,
  ) {}
}
