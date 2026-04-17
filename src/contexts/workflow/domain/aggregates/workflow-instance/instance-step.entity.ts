import { Entity } from '@shared/domain';
import { ApprovalRule } from '../../value-objects/approval-rule.vo';

export enum StepStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface StepDecision {
  actorId: string;
  decision: 'approve' | 'reject';
  decidedAt: Date;
  isDelegated: boolean;
  originalApproverId?: string;
}

interface InstanceStepProps {
  id: string;
  instanceId: string;
  stepOrder: number;
  stepName: string;
  approvalRule: ApprovalRule;
  approvers: string[];
  slaHours: number;
  slaDeadline?: Date | null;
  slaBreached?: boolean;
  status: StepStatus;
  version: number;
}

export class InstanceStep extends Entity<string> {
  public readonly instanceId: string;
  public readonly stepOrder: number;
  public readonly stepName: string;
  public readonly approvalRule: ApprovalRule;
  public readonly approvers: string[];
  public readonly slaHours: number;
  public readonly slaDeadline: Date | null;
  private _slaBreached: boolean;
  private _status: StepStatus;
  private _decisions: StepDecision[] = [];
  public version: number;

  constructor(props: InstanceStepProps) {
    super(props.id);
    this.instanceId = props.instanceId;
    this.stepOrder = props.stepOrder;
    this.stepName = props.stepName;
    this.approvalRule = props.approvalRule;
    this.approvers = props.approvers;
    this.slaHours = props.slaHours;
    this.slaDeadline = props.slaDeadline ?? null;
    this._slaBreached = props.slaBreached ?? false;
    this._status = props.status;
    this.version = props.version;
  }

  get status(): StepStatus {
    return this._status;
  }

  get decisions(): StepDecision[] {
    return [...this._decisions];
  }

  get slaBreached(): boolean {
    return this._slaBreached;
  }

  hasDecisionFrom(actorId: string): boolean {
    return this._decisions.some((d) => d.actorId === actorId);
  }

  canBeDecidedBy(actorId: string, representedApproverId?: string): boolean {
    if (this.approvers.includes(actorId)) return true;
    return representedApproverId ? this.approvers.includes(representedApproverId) : false;
  }

  addDecision(decision: StepDecision): void {
    this._decisions.push(decision);
  }

  approve(): void {
    this._status = StepStatus.APPROVED;
  }

  reject(): void {
    this._status = StepStatus.REJECTED;
  }

  get approvedCount(): number {
    return this._decisions.filter((d) => d.decision === 'approve').length;
  }

  isSlaBreached(reference = new Date()): boolean {
    if (this._slaBreached) return true;
    return this.slaDeadline ? reference > this.slaDeadline : false;
  }
}
