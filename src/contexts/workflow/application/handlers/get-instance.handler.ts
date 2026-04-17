import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetInstanceQuery } from '../queries/get-instance.query';
import { IWorkflowInstanceRepository, WORKFLOW_INSTANCE_REPOSITORY } from '../../domain/repositories/workflow-instance.repository';
import { WorkflowInstance } from '../../domain/aggregates/workflow-instance/workflow-instance.aggregate';

@QueryHandler(GetInstanceQuery)
export class GetInstanceHandler implements IQueryHandler<GetInstanceQuery, WorkflowInstance> {
  constructor(
    @Inject(WORKFLOW_INSTANCE_REPOSITORY)
    private readonly instanceRepo: IWorkflowInstanceRepository,
  ) {}

  async execute(query: GetInstanceQuery): Promise<WorkflowInstance> {
    const instance = await this.instanceRepo.findById(query.instanceId, query.tenantId);
    if (!instance) throw new NotFoundException(`Instance "${query.instanceId}" not found`);
    return instance;
  }
}
