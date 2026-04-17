import { WorkflowTemplate } from './workflow-template.aggregate';
import { TemplateVersion, VersionStatus } from './template-version.entity';
import { ApprovalRule } from '../../value-objects/approval-rule.vo';

const makeVersion = (overrides: Partial<ConstructorParameters<typeof TemplateVersion>[0]> = {}) =>
  new TemplateVersion({
    id: 'v1',
    templateId: 'tpl-1',
    versionNumber: 1,
    status: VersionStatus.DRAFT,
    steps: [],
    ...overrides,
  });

describe('WorkflowTemplate', () => {
  describe('publish()', () => {
    it('deve publicar uma versão em draft', () => {
      const tpl = new WorkflowTemplate({ id: 'tpl-1', tenantId: 'co-1', name: 'Onboarding' });
      const version = makeVersion();
      tpl.addVersion(version);

      tpl.publish('v1');

      expect(tpl.findVersion('v1')!.status).toBe(VersionStatus.PUBLISHED);
    });

    it('deve lançar erro ao tentar publicar versão já publicada', () => {
      const tpl = new WorkflowTemplate({ id: 'tpl-1', tenantId: 'co-1', name: 'Onboarding' });
      const version = makeVersion({ status: VersionStatus.PUBLISHED });
      tpl.addVersion(version);

      expect(() => tpl.publish('v1')).toThrow();
    });

    it('deve lançar erro ao publicar versão inexistente', () => {
      const tpl = new WorkflowTemplate({ id: 'tpl-1', tenantId: 'co-1', name: 'Onboarding' });

      expect(() => tpl.publish('nao-existe')).toThrow();
    });

    it('deve emitir TemplateVersionPublishedEvent ao publicar', () => {
      const tpl = new WorkflowTemplate({ id: 'tpl-1', tenantId: 'co-1', name: 'Onboarding' });
      tpl.addVersion(makeVersion());

      tpl.publish('v1');

      expect(tpl.domainEvents).toHaveLength(1);
      expect(tpl.domainEvents[0].eventName).toBe('TemplateVersionPublished');
    });
  });

  describe('addVersion()', () => {
    it('deve lançar erro ao adicionar versão com ID duplicado', () => {
      const tpl = new WorkflowTemplate({ id: 'tpl-1', tenantId: 'co-1', name: 'Onboarding' });
      tpl.addVersion(makeVersion());

      expect(() => tpl.addVersion(makeVersion())).toThrow();
    });
  });

  describe('findVersion()', () => {
    it('deve retornar null para versão inexistente', () => {
      const tpl = new WorkflowTemplate({ id: 'tpl-1', tenantId: 'co-1', name: 'Onboarding' });
      expect(tpl.findVersion('nao-existe')).toBeNull();
    });
  });

  describe('reconstitute()', () => {
    it('deve restaurar template com versões existentes', () => {
      const version = makeVersion({ status: VersionStatus.PUBLISHED });
      const tpl = WorkflowTemplate.reconstitute({
        id: 'tpl-1',
        tenantId: 'co-1',
        name: 'Onboarding',
        versions: [version],
      });

      expect(tpl.id).toBe('tpl-1');
      expect(tpl.versions).toHaveLength(1);
      expect(tpl.findVersion('v1')).toBe(version);
    });

    it('deve restaurar template sem versões', () => {
      const tpl = WorkflowTemplate.reconstitute({
        id: 'tpl-2',
        tenantId: 'co-1',
        name: 'Vazio',
        versions: [],
      });

      expect(tpl.versions).toHaveLength(0);
    });
  });
});
