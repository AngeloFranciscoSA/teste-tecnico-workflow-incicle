import { AggregateRoot } from '@shared/domain';
import { TemplateVersion } from './template-version.entity';
import { TemplateVersionPublishedEvent } from '../../events/workflow.events';

interface WorkflowTemplateProps {
  id: string;
  tenantId: string;
  name: string;
}

export class WorkflowTemplate extends AggregateRoot<string> {
  public readonly tenantId: string;
  public readonly name: string;
  private readonly _versions: Map<string, TemplateVersion> = new Map();

  constructor(props: WorkflowTemplateProps) {
    super(props.id);
    this.tenantId = props.tenantId;
    this.name = props.name;
  }

  addVersion(version: TemplateVersion): void {
    if (this._versions.has(version.id)) {
      throw new Error(`Version "${version.id}" already exists on this template`);
    }
    this._versions.set(version.id, version);
  }

  publish(versionId: string): void {
    const version = this._versions.get(versionId);
    if (!version) {
      throw new Error(`Version "${versionId}" not found`);
    }
    version.publish();
    this.addDomainEvent(new TemplateVersionPublishedEvent(this.id, versionId));
  }

  findVersion(versionId: string): TemplateVersion | null {
    return this._versions.get(versionId) ?? null;
  }

  get versions(): TemplateVersion[] {
    return [...this._versions.values()];
  }

  static reconstitute(props: WorkflowTemplateProps & { versions: TemplateVersion[] }): WorkflowTemplate {
    const template = new WorkflowTemplate(props);
    props.versions.forEach((v) => template._versions.set(v.id, v));
    return template;
  }
}
