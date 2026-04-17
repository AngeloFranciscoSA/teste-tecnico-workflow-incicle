export class ListInstancesQuery {
  constructor(
    public readonly tenantId: string,
    public readonly status?: string,
    public readonly createdBy?: string,
  ) {}
}
