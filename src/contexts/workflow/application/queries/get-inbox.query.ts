export class GetInboxQuery {
  constructor(
    public readonly actorId: string,
    public readonly tenantId: string,
  ) {}
}
