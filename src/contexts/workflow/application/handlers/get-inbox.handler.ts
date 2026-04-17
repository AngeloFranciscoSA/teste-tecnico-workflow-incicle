import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { GetInboxQuery } from '../queries/get-inbox.query';
import { IWorkflowInstanceRepository, WORKFLOW_INSTANCE_REPOSITORY } from '../../domain/repositories/workflow-instance.repository';
import { IDelegationRepository, DELEGATION_REPOSITORY } from '../../../delegation/domain/repositories/delegation.repository';

export interface InboxItem {
  instanceId: string;
  tenantId: string;
  stepId: string;
  stepName: string;
  isDelegated: boolean;
}

@QueryHandler(GetInboxQuery)
export class GetInboxHandler implements IQueryHandler<GetInboxQuery, InboxItem[]> {
  constructor(
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly instanceRepo: IWorkflowInstanceRepository,
    @Inject(DELEGATION_REPOSITORY)
    private readonly delegationRepo: IDelegationRepository,
  ) {}

  async execute(query: GetInboxQuery): Promise<InboxItem[]> {
    const { actorId, tenantId } = query;

    const delegation = await this.delegationRepo.findActiveForDelegate(actorId, tenantId);

    const approverIds = [actorId];
    if (delegation) approverIds.push(delegation.delegatorId);

    const rows = await this.instanceRepo.findInboxForApprovers(tenantId, approverIds, actorId);

    return rows.map((row) => ({
      instanceId: row.instanceId,
      tenantId: row.tenantId,
      stepId: row.stepId,
      stepName: row.stepName,
      isDelegated: !!delegation && !row.approvers.includes(actorId),
    }));
  }
}
