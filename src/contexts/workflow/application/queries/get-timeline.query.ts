export class GetTimelineQuery {
  constructor(
    public readonly instanceId: string,
    public readonly tenantId: string,
  ) {}
}
