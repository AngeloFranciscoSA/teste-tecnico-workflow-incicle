import { SnapshotBuilderService } from './snapshot-builder.service';
import { TemplateVersion, VersionStatus } from '../aggregates/workflow-template/template-version.entity';
import { ApprovalRule } from '../value-objects/approval-rule.vo';

const makePublishedVersion = (): TemplateVersion =>
  new TemplateVersion({
    id: 'v1',
    templateId: 'tpl-1',
    versionNumber: 1,
    status: VersionStatus.PUBLISHED,
    steps: [
      {
        id: 'step-1',
        stepOrder: 1,
        stepName: 'Gerência',
        approvalRule: ApprovalRule.all(),
        approvers: ['user-a', 'user-b'],
        slaHours: 24,
      },
    ],
  });

describe('SnapshotBuilderService', () => {
  let service: SnapshotBuilderService;

  beforeEach(() => {
    service = new SnapshotBuilderService();
  });

  it('deve construir snapshot com dados da versão publicada', () => {
    const version = makePublishedVersion();
    const snapshot = service.build(version);

    expect(snapshot.templateId).toBe('tpl-1');
    expect(snapshot.versionId).toBe('v1');
    expect(snapshot.versionNumber).toBe(1);
    expect(snapshot.steps).toHaveLength(1);
    expect(snapshot.steps[0].stepName).toBe('Gerência');
    expect(snapshot.steps[0].approvers).toEqual(['user-a', 'user-b']);
  });

  it('deve lançar erro se a versão não estiver publicada', () => {
    const version = new TemplateVersion({
      id: 'v1',
      templateId: 'tpl-1',
      versionNumber: 1,
      status: VersionStatus.DRAFT,
      steps: [],
    });

    expect(() => service.build(version)).toThrow();
  });

  it('snapshot deve ser imutável — alteração nos aprovadores da versão não afeta o snapshot', () => {
    const version = makePublishedVersion();
    const snapshot = service.build(version);

    // Tenta alterar os approvers originais
    version.steps[0].approvers.push('user-intruso');

    // Snapshot não deve ter sido afetado
    expect(snapshot.steps[0].approvers).toHaveLength(2);
    expect(snapshot.steps[0].approvers).not.toContain('user-intruso');
  });
});
