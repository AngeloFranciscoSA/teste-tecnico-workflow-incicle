import { Entity } from '@shared/domain';
import { ApprovalRule } from '../../value-objects/approval-rule.vo';

export enum VersionStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export interface TemplateStepData {
  id: string;
  stepOrder: number;
  stepName: string;
  approvalRule: ApprovalRule;
  approvers: string[];
  slaHours: number;
}

interface TemplateVersionProps {
  id: string;
  templateId: string;
  versionNumber: number;
  status: VersionStatus;
  steps: TemplateStepData[];
}

export class TemplateVersion extends Entity<string> {
  public templateId: string;
  public versionNumber: number;
  private _status: VersionStatus;
  public readonly steps: TemplateStepData[];

  constructor(props: TemplateVersionProps) {
    super(props.id);
    this.templateId = props.templateId;
    this.versionNumber = props.versionNumber;
    this._status = props.status;
    this.steps = props.steps;
  }

  get status(): VersionStatus {
    return this._status;
  }

  publish(): void {
    if (this._status !== VersionStatus.DRAFT) {
      throw new Error(`Cannot publish a version with status "${this._status}"`);
    }
    this._status = VersionStatus.PUBLISHED;
  }
}
