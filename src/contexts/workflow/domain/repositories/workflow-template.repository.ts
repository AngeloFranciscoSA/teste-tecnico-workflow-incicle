import { WorkflowTemplate } from '../aggregates/workflow-template/workflow-template.aggregate';
import { TemplateVersion } from '../aggregates/workflow-template/template-version.entity';

export const WORKFLOW_TEMPLATE_REPOSITORY = Symbol('IWorkflowTemplateRepository');

export interface IWorkflowTemplateRepository {
  findById(id: string, tenantId: string): Promise<WorkflowTemplate | null>;
  findPublishedVersion(templateId: string, versionId: string): Promise<TemplateVersion | null>;
  save(template: WorkflowTemplate): Promise<void>;
  findAll(tenantId: string): Promise<WorkflowTemplate[]>;
}
