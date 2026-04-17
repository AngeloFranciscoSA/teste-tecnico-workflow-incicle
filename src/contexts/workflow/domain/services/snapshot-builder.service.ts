import { Injectable } from '@nestjs/common';
import { TemplateVersion, VersionStatus } from '../aggregates/workflow-template/template-version.entity';
import { Snapshot } from '../aggregates/workflow-instance/snapshot.value-object';

@Injectable()
export class SnapshotBuilderService {
  build(version: TemplateVersion): Snapshot {
    if (version.status !== VersionStatus.PUBLISHED) {
      throw new Error(`Cannot build snapshot from a "${version.status}" version`);
    }

    return new Snapshot({
      templateId: version.templateId,
      versionId: version.id,
      versionNumber: version.versionNumber,
      // Cópia profunda para garantir imutabilidade do snapshot
      steps: version.steps.map((s) => ({
        stepOrder: s.stepOrder,
        stepName: s.stepName,
        approvalRule: s.approvalRule,
        approvers: [...s.approvers],
        slaHours: s.slaHours,
      })),
    });
  }
}
