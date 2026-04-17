import { AggregateRoot } from '@shared/domain';
import { InstanceStep, StepStatus } from './instance-step.entity';
import { Snapshot } from './snapshot.value-object';
import {
  InstanceSubmittedEvent,
  StepApprovedEvent,
  StepRejectedEvent,
  InstanceCompletedEvent,
  InstanceRejectedEvent,
} from '../../events/workflow.events';

export enum InstanceStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

interface WorkflowInstanceProps {
  id: string;
  tenantId: string;
  templateId: string;
  versionId: string;
  createdBy: string;
}

interface WorkflowInstanceReconstitute extends WorkflowInstanceProps {
  status: InstanceStatus;
  snapshot: Snapshot | null;
  steps: InstanceStep[];
}

export class WorkflowInstance extends AggregateRoot<string> {
  public readonly tenantId: string;
  public readonly templateId: string;
  public readonly versionId: string;
  public readonly createdBy: string;
  private _status: InstanceStatus = InstanceStatus.DRAFT;
  private _snapshot: Snapshot | null = null;
  private _steps: Map<string, InstanceStep> = new Map();

  constructor(props: WorkflowInstanceProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.templateId = props.templateId;
    this.versionId = props.versionId;
    this.createdBy = props.createdBy;
  }

  get status(): InstanceStatus {
    return this._status;
  }

  get snapshot(): Snapshot | null {
    return this._snapshot;
  }

  submit(snapshot: Snapshot, steps: InstanceStep[]): void {
    if (this._status !== InstanceStatus.DRAFT) {
      throw new Error(`Instance "${this.id}" has already been submitted`);
    }
    this._snapshot = snapshot;
    steps.forEach((s) => this._steps.set(s.id, s));
    this._status = InstanceStatus.ACTIVE;
    this.addDomainEvent(new InstanceSubmittedEvent(this.id, this.tenantId));
  }

  decide(
    stepId: string,
    actorId: string,
    decision: 'approve' | 'reject',
    isDelegated = false,
    originalApproverId?: string,
  ): void {
    const step = this._steps.get(stepId);
    if (!step) throw new Error(`Step "${stepId}" not found`);

    if (step.status !== StepStatus.PENDING) {
      throw new Error(`Step "${stepId}" is already ${step.status}`);
    }

    // Idempotência: mesma decisão do mesmo ator não tem efeito
    if (step.hasDecisionFrom(actorId)) return;

    step.addDecision({ actorId, decision, decidedAt: new Date(), isDelegated, originalApproverId });

    if (decision === 'reject') {
      step.reject();
      this._status = InstanceStatus.REJECTED;
      this.addDomainEvent(new StepRejectedEvent(this.id, stepId, actorId));
      this.addDomainEvent(new InstanceRejectedEvent(this.id));
      return;
    }

    this.addDomainEvent(new StepApprovedEvent(this.id, stepId, actorId));

    const satisfied = step.approvalRule.isSatisfiedBy(step.approvedCount, step.approvers.length);
    if (satisfied) {
      step.approve();
      this.tryComplete();
    }
  }

  findStep(stepId: string): InstanceStep | null {
    return this._steps.get(stepId) ?? null;
  }

  get steps(): InstanceStep[] {
    return [...this._steps.values()];
  }

  static reconstitute(props: WorkflowInstanceReconstitute): WorkflowInstance {
    const instance = new WorkflowInstance(props);
    instance._status = props.status;
    instance._snapshot = props.snapshot;
    props.steps.forEach((s) => instance._steps.set(s.id, s));
    return instance;
  }

  private tryComplete(): void {
    const allApproved = [...this._steps.values()].every(
      (s) => s.status === StepStatus.APPROVED,
    );
    if (allApproved) {
      this._status = InstanceStatus.COMPLETED;
      this.addDomainEvent(new InstanceCompletedEvent(this.id));
    }
  }
}
