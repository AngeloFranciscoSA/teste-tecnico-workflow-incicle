import { ValueObject } from '@shared/domain';
import { ApprovalRule } from '../../value-objects/approval-rule.vo';

export interface SnapshotStep {
  stepOrder: number;
  stepName: string;
  approvalRule: ApprovalRule;
  approvers: string[];
  slaHours: number;
}

interface SnapshotProps {
  templateId: string;
  versionId: string;
  versionNumber: number;
  steps: SnapshotStep[];
}

export class Snapshot extends ValueObject<SnapshotProps> {
  get templateId(): string { return this.props.templateId; }
  get versionId(): string { return this.props.versionId; }
  get versionNumber(): number { return this.props.versionNumber; }
  get steps(): SnapshotStep[] { return this.props.steps; }
}
