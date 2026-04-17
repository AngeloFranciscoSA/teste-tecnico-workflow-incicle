import { EntityManager } from 'typeorm';
import { WorkflowInstance } from '../aggregates/workflow-instance/workflow-instance.aggregate';

export const WORKFLOW_INSTANCE_REPOSITORY = Symbol('IWorkflowInstanceRepository');

export interface ListInstancesFilters {
  status?: string;
  createdBy?: string;
}

export interface InboxRow {
  instanceId: string;
  tenantId: string;
  stepId: string;
  stepName: string;
  approvers: string[];
}

export interface IWorkflowInstanceRepository {
  findById(id: string, tenantId: string): Promise<WorkflowInstance | null>;
  save(instance: WorkflowInstance, manager?: EntityManager): Promise<void>;
  findAll(tenantId: string, filters?: ListInstancesFilters): Promise<WorkflowInstance[]>;
  findInboxForApprovers(tenantId: string, approverIds: string[], actorId: string): Promise<InboxRow[]>;
}
