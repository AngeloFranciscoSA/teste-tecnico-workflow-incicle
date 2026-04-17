import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IWorkflowTemplateRepository } from '../../domain/repositories/workflow-template.repository';
import { WorkflowTemplate } from '../../domain/aggregates/workflow-template/workflow-template.aggregate';
import { TemplateVersion, VersionStatus } from '../../domain/aggregates/workflow-template/template-version.entity';
import { WorkflowTemplateOrmEntity } from './typeorm/workflow-template.orm-entity';
import { TemplateVersionOrmEntity } from './typeorm/template-version.orm-entity';
import { ApprovalRule, ApprovalRuleType } from '../../domain/value-objects/approval-rule.vo';

@Injectable()
export class WorkflowTemplateTypeOrmRepository implements IWorkflowTemplateRepository {
  constructor(
    @InjectRepository(WorkflowTemplateOrmEntity)
    private readonly repo: Repository<WorkflowTemplateOrmEntity>,
  ) {}

  async findById(id: string, tenantId: string): Promise<WorkflowTemplate | null> {
    const orm = await this.repo.findOne({ where: { id, companyId: tenantId } });
    return orm ? this.toDomain(orm) : null;
  }

  async findPublishedVersion(templateId: string, versionId: string): Promise<TemplateVersion | null> {
    const orm = await this.repo.findOne({ where: { id: templateId } });
    if (!orm) return null;
    const versionOrm = orm.versions?.find(
      (v) => v.id === versionId && v.status === 'published',
    );
    return versionOrm ? this.toVersionDomain(versionOrm) : null;
  }

  async save(template: WorkflowTemplate): Promise<void> {
    const orm = this.toOrm(template);
    await this.repo.save(orm);
  }

  async findAll(tenantId: string): Promise<WorkflowTemplate[]> {
    const orms = await this.repo.find({ where: { companyId: tenantId } });
    return orms.map((o) => this.toDomain(o));
  }

  private toDomain(orm: WorkflowTemplateOrmEntity): WorkflowTemplate {
    const versions = (orm.versions ?? []).map((v) => this.toVersionDomain(v));
    return WorkflowTemplate.reconstitute({
      id: orm.id,
      tenantId: orm.companyId,
      name: orm.name,
      versions,
    });
  }

  private toVersionDomain(v: any): TemplateVersion {
    return new TemplateVersion({
      id: v.id,
      templateId: v.templateId,
      versionNumber: v.versionNumber,
      status: v.status as VersionStatus,
      steps: (v.config?.steps ?? []).map((s: any) => ({
        id: s.id,
        stepOrder: s.stepOrder,
        stepName: s.stepName,
        approvalRule: this.toApprovalRule(s.approvalRule, s.quorumCount),
        approvers: s.approvers,
        slaHours: s.slaHours,
      })),
    });
  }

  private toApprovalRule(type: string, quorumCount?: number): ApprovalRule {
    if (type === ApprovalRuleType.ALL) return ApprovalRule.all();
    if (type === ApprovalRuleType.ANY) return ApprovalRule.any();
    return ApprovalRule.quorum(quorumCount ?? 1);
  }

  private toOrm(template: WorkflowTemplate): WorkflowTemplateOrmEntity {
    const orm = new WorkflowTemplateOrmEntity();
    orm.id = template.id;
    orm.companyId = template.tenantId;
    orm.name = template.name;
    orm.versions = template.versions.map((v) => {
      const vOrm = Object.assign(new TemplateVersionOrmEntity(), {
        id: v.id,
        templateId: v.templateId,
        versionNumber: v.versionNumber,
        status: v.status,
        config: {
          steps: v.steps.map((s) => ({
            id: s.id,
            stepOrder: s.stepOrder,
            stepName: s.stepName,
            approvalRule: s.approvalRule.type,
            quorumCount: s.approvalRule.quorumCount,
            approvers: s.approvers,
            slaHours: s.slaHours,
          })),
        },
        publishedAt: v.status === VersionStatus.PUBLISHED ? new Date() : null,
      });
      return vOrm;
    });
    return orm;
  }
}
