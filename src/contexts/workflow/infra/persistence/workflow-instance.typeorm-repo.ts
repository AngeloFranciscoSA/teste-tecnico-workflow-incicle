import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  IWorkflowInstanceRepository,
  InboxRow,
  ListInstancesFilters,
} from '../../domain/repositories/workflow-instance.repository';
import { WorkflowInstance, InstanceStatus } from '../../domain/aggregates/workflow-instance/workflow-instance.aggregate';
import { InstanceStep, StepStatus, StepDecision } from '../../domain/aggregates/workflow-instance/instance-step.entity';
import { Snapshot } from '../../domain/aggregates/workflow-instance/snapshot.value-object';
import { WorkflowInstanceOrmEntity } from './typeorm/workflow-instance.orm-entity';
import { InstanceStepOrmEntity } from './typeorm/instance-step.orm-entity';
import { ApprovalRule, ApprovalRuleType } from '../../domain/value-objects/approval-rule.vo';

@Injectable()
export class WorkflowInstanceTypeOrmRepository implements IWorkflowInstanceRepository {
  constructor(
    @InjectRepository(WorkflowInstanceOrmEntity)
    private readonly repo: Repository<WorkflowInstanceOrmEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: string, tenantId: string): Promise<WorkflowInstance | null> {
    const orm = await this.repo.findOne({ where: { id, companyId: tenantId } });
    return orm ? this.toDomain(orm) : null;
  }

  async save(instance: WorkflowInstance, manager?: EntityManager): Promise<void> {
    const persist = async (txManager: EntityManager) => {
      // Salva a instância (upsert)
      const instanceOrm = this.toInstanceOrm(instance);
      await txManager.save(WorkflowInstanceOrmEntity, instanceOrm);

      for (const step of instance.steps) {
        const existing = await txManager.findOne(InstanceStepOrmEntity, {
          where: { id: step.id },
          select: ['id', 'version'],
        });

        if (!existing) {
          // Novo step (após submit) — INSERT direto
          const stepOrm = this.toStepOrm(step);
          await txManager.save(InstanceStepOrmEntity, stepOrm);
        } else {
          // Step existente — UPDATE com verificação de versão (Optimistic Locking)
          const result = await txManager
            .createQueryBuilder()
            .update(InstanceStepOrmEntity)
            .set({
              status: step.status,
              slaDeadline: step.slaDeadline,
              slaBreached: step.slaBreached,
              decisions: step.decisions.map((d) => ({
                actorId: d.actorId,
                decision: d.decision,
                decidedAt: d.decidedAt.toISOString(),
                isDelegated: d.isDelegated,
                originalApproverId: d.originalApproverId,
              })),
              version: () => 'version + 1',
            })
            .where('id = :id AND version = :version', {
              id: step.id,
              version: step.version,
            })
            .execute();

          if (result.affected === 0) {
            throw new ConflictException(
              `Concurrent modification on step "${step.id}". Another decision was recorded simultaneously.`,
            );
          }
        }
      }
    };

    if (manager) {
      await persist(manager);
      return;
    }

    await this.dataSource.transaction(persist);
  }

  async findInboxForApprovers(tenantId: string, approverIds: string[], actorId: string): Promise<InboxRow[]> {
    const rows: Array<{ instanceId: string; tenantId: string; stepId: string; stepName: string; approvers: string[] }> =
      await this.dataSource.query(
        `SELECT
           i.id            AS "instanceId",
           i.company_id    AS "tenantId",
           s.id            AS "stepId",
           s.step_name     AS "stepName",
           s.approvers     AS "approvers"
         FROM workflow_instances i
         JOIN instance_steps s ON s.instance_id = i.id
         WHERE i.company_id = $1
           AND i.status    = 'active'
           AND s.status    = 'pending'
           AND s.approvers ?| $2
           AND NOT EXISTS (
             SELECT 1 FROM jsonb_array_elements(s.decisions) AS d
             WHERE d->>'actorId' = $3
           )
         ORDER BY s.sla_deadline ASC
         LIMIT 100`,
        [tenantId, approverIds, actorId],
      );
    return rows;
  }

  async findAll(tenantId: string, filters?: ListInstancesFilters): Promise<WorkflowInstance[]> {
    const where: any = { companyId: tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.createdBy) where.createdBy = filters.createdBy;
    const orms = await this.repo.find({ where });
    return orms.map((o) => this.toDomain(o));
  }

  // ── Mappers ────────────────────────────────────────────────────────────────

  private toDomain(orm: WorkflowInstanceOrmEntity): WorkflowInstance {
    const steps = (orm.steps ?? []).map((s) => this.toStepDomain(s));
    const snapshot = orm.snapshot ? this.toSnapshotDomain(orm.snapshot) : null;

    return WorkflowInstance.reconstitute({
      id: orm.id,
      tenantId: orm.companyId,
      templateId: orm.templateId,
      versionId: orm.versionId,
      createdBy: orm.createdBy,
      status: orm.status as InstanceStatus,
      snapshot,
      steps,
    });
  }

  private toStepDomain(s: InstanceStepOrmEntity): InstanceStep {
    const step = new InstanceStep({
      id: s.id,
      instanceId: s.instanceId,
      stepOrder: s.stepOrder,
      stepName: s.stepName,
      approvalRule: this.toApprovalRule(s.approvalRule, s.quorumCount),
      approvers: s.approvers,
      slaHours: s.slaHours,
      slaDeadline: s.slaDeadline,
      slaBreached: s.slaBreached,
      status: s.status as StepStatus,
      version: s.version,
    });
    (s.decisions ?? []).forEach((d) =>
      step.addDecision({
        actorId: d.actorId,
        decision: d.decision,
        decidedAt: new Date(d.decidedAt),
        isDelegated: d.isDelegated,
        originalApproverId: d.originalApproverId,
      } as StepDecision),
    );
    return step;
  }

  private toSnapshotDomain(raw: Record<string, any>): Snapshot {
    return new Snapshot({
      templateId: raw.templateId,
      versionId: raw.versionId,
      versionNumber: raw.versionNumber,
      steps: raw.steps.map((s: any) => ({
        stepOrder: s.stepOrder,
        stepName: s.stepName,
        approvalRule: this.toApprovalRule(s.approvalRule, s.quorumCount),
        approvers: s.approvers,
        slaHours: s.slaHours,
      })),
    });
  }

  private toApprovalRule(type: string, quorumCount?: number | null): ApprovalRule {
    if (type === ApprovalRuleType.ALL) return ApprovalRule.all();
    if (type === ApprovalRuleType.ANY) return ApprovalRule.any();
    return ApprovalRule.quorum(quorumCount ?? 1);
  }

  private toInstanceOrm(instance: WorkflowInstance): WorkflowInstanceOrmEntity {
    const orm = new WorkflowInstanceOrmEntity();
    orm.id = instance.id;
    orm.companyId = instance.tenantId;
    orm.templateId = instance.templateId;
    orm.versionId = instance.versionId;
    orm.status = instance.status;
    orm.createdBy = instance.createdBy;
    orm.snapshot = instance.snapshot
      ? {
          templateId: instance.snapshot.templateId,
          versionId: instance.snapshot.versionId,
          versionNumber: instance.snapshot.versionNumber,
          steps: instance.snapshot.steps.map((s) => ({
            stepOrder: s.stepOrder,
            stepName: s.stepName,
            approvalRule: s.approvalRule.type,
            quorumCount: s.approvalRule.quorumCount,
            approvers: s.approvers,
            slaHours: s.slaHours,
          })),
        }
      : null;
    return orm;
  }

  private toStepOrm(step: InstanceStep): InstanceStepOrmEntity {
    const orm = new InstanceStepOrmEntity();
    orm.id = step.id;
    orm.instanceId = step.instanceId;
    orm.stepOrder = step.stepOrder;
    orm.stepName = step.stepName;
    orm.approvalRule = step.approvalRule.type;
    orm.quorumCount = step.approvalRule.quorumCount ?? null;
    orm.approvers = step.approvers;
    orm.slaHours = step.slaHours;
    orm.slaDeadline = step.slaDeadline;
    orm.slaBreached = step.slaBreached;
    orm.status = step.status;
    orm.version = step.version;
    orm.decisions = step.decisions.map((d) => ({
      actorId: d.actorId,
      decision: d.decision,
      decidedAt: d.decidedAt.toISOString(),
      isDelegated: d.isDelegated,
      originalApproverId: d.originalApproverId,
    }));
    return orm;
  }
}
