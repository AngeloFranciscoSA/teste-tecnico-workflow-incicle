import { WorkflowInstance, InstanceStatus } from './workflow-instance.aggregate';
import { InstanceStep, StepStatus } from './instance-step.entity';
import { ApprovalRule } from '../../value-objects/approval-rule.vo';
import { Snapshot } from './snapshot.value-object';

const makeStep = (overrides: Partial<ConstructorParameters<typeof InstanceStep>[0]> = {}) =>
  new InstanceStep({
    id: 'step-1',
    instanceId: 'inst-1',
    stepOrder: 1,
    stepName: 'Gerência',
    approvalRule: ApprovalRule.all(),
    approvers: ['user-a'],
    slaHours: 24,
    status: StepStatus.PENDING,
    version: 0,
    ...overrides,
  });

const makeSnapshot = (): Snapshot =>
  new Snapshot({
    templateId: 'tpl-1',
    versionId: 'v1',
    versionNumber: 1,
    steps: [
      {
        stepOrder: 1,
        stepName: 'Gerência',
        approvalRule: ApprovalRule.all(),
        approvers: ['user-a'],
        slaHours: 24,
      },
    ],
  });

describe('WorkflowInstance', () => {
  describe('submit()', () => {
    it('deve transitar para ACTIVE e persistir o snapshot', () => {
      const instance = new WorkflowInstance({
        id: 'inst-1',
        tenantId: 'co-1',
        templateId: 'tpl-1',
        versionId: 'v1',
        createdBy: 'user-1',
      });
      const snapshot = makeSnapshot();

      instance.submit(snapshot, [makeStep()]);

      expect(instance.status).toBe(InstanceStatus.ACTIVE);
      expect(instance.snapshot).toBe(snapshot);
    });

    it('deve emitir InstanceSubmittedEvent ao submeter', () => {
      const instance = new WorkflowInstance({
        id: 'inst-1',
        tenantId: 'co-1',
        templateId: 'tpl-1',
        versionId: 'v1',
        createdBy: 'user-1',
      });

      instance.submit(makeSnapshot(), [makeStep()]);

      const event = instance.domainEvents.find((e) => e.eventName === 'InstanceSubmitted');
      expect(event).toBeDefined();
    });

    it('não deve permitir submeter uma instância já ativa', () => {
      const instance = new WorkflowInstance({
        id: 'inst-1',
        tenantId: 'co-1',
        templateId: 'tpl-1',
        versionId: 'v1',
        createdBy: 'user-1',
      });
      instance.submit(makeSnapshot(), [makeStep()]);

      expect(() => instance.submit(makeSnapshot(), [makeStep()])).toThrow();
    });
  });

  describe('decide() — regra ALL', () => {
    it('não deve marcar ator externo como apto a decidir o step', () => {
      const instance = new WorkflowInstance({
        id: 'inst-1',
        tenantId: 'co-1',
        templateId: 'tpl-1',
        versionId: 'v1',
        createdBy: 'user-1',
      });
      instance.submit(makeSnapshot(), [makeStep({ approvers: ['user-a'] })]);

      expect(instance.findStep('step-1')!.canBeDecidedBy('user-x')).toBe(false);
    });

    it('deve registrar decisão de aprovação', () => {
      const instance = new WorkflowInstance({
        id: 'inst-1',
        tenantId: 'co-1',
        templateId: 'tpl-1',
        versionId: 'v1',
        createdBy: 'user-1',
      });
      instance.submit(makeSnapshot(), [makeStep({ approvers: ['user-a', 'user-b'] })]);

      instance.decide('step-1', 'user-a', 'approve');

      const step = instance.findStep('step-1')!;
      expect(step.decisions).toHaveLength(1);
      expect(step.status).toBe(StepStatus.PENDING);
    });

    it('deve completar o step quando todos aprovam (ALL)', () => {
      const instance = new WorkflowInstance({
        id: 'inst-1',
        tenantId: 'co-1',
        templateId: 'tpl-1',
        versionId: 'v1',
        createdBy: 'user-1',
      });
      instance.submit(makeSnapshot(), [makeStep({ approvers: ['user-a'] })]);

      instance.decide('step-1', 'user-a', 'approve');

      expect(instance.findStep('step-1')!.status).toBe(StepStatus.APPROVED);
      expect(instance.status).toBe(InstanceStatus.COMPLETED);
    });

    it('deve rejeitar a instância quando um step é rejeitado', () => {
      const instance = new WorkflowInstance({
        id: 'inst-1',
        tenantId: 'co-1',
        templateId: 'tpl-1',
        versionId: 'v1',
        createdBy: 'user-1',
      });
      instance.submit(makeSnapshot(), [makeStep()]);

      instance.decide('step-1', 'user-a', 'reject');

      expect(instance.findStep('step-1')!.status).toBe(StepStatus.REJECTED);
      expect(instance.status).toBe(InstanceStatus.REJECTED);
    });

    it('deve ser idempotente — mesma decisão do mesmo ator não duplica', () => {
      const instance = new WorkflowInstance({
        id: 'inst-1',
        tenantId: 'co-1',
        templateId: 'tpl-1',
        versionId: 'v1',
        createdBy: 'user-1',
      });
      instance.submit(makeSnapshot(), [makeStep({ approvers: ['user-a', 'user-b'] })]);

      instance.decide('step-1', 'user-a', 'approve');
      instance.decide('step-1', 'user-a', 'approve');

      expect(instance.findStep('step-1')!.decisions).toHaveLength(1);
    });

    it('não deve permitir decisão em step já aprovado', () => {
      const instance = new WorkflowInstance({
        id: 'inst-1',
        tenantId: 'co-1',
        templateId: 'tpl-1',
        versionId: 'v1',
        createdBy: 'user-1',
      });
      instance.submit(makeSnapshot(), [makeStep({ approvers: ['user-a'] })]);
      instance.decide('step-1', 'user-a', 'approve');

      expect(() => instance.decide('step-1', 'user-a', 'approve')).toThrow();
    });
  });

  describe('decide() — regra ANY', () => {
    it('deve completar o step quando qualquer um aprova (ANY)', () => {
      const instance = new WorkflowInstance({
        id: 'inst-1',
        tenantId: 'co-1',
        templateId: 'tpl-1',
        versionId: 'v1',
        createdBy: 'user-1',
      });
      const step = makeStep({
        approvalRule: ApprovalRule.any(),
        approvers: ['user-a', 'user-b'],
      });
      instance.submit(makeSnapshot(), [step]);

      instance.decide('step-1', 'user-a', 'approve');

      expect(instance.findStep('step-1')!.status).toBe(StepStatus.APPROVED);
    });
  });

  describe('reconstitute()', () => {
    it('deve restaurar instância com status e steps existentes', () => {
      const step = makeStep();
      const snapshot = makeSnapshot();
      const instance = WorkflowInstance.reconstitute({
        id: 'inst-reconstituted',
        tenantId: 'co-1',
        templateId: 'tpl-1',
        versionId: 'v1',
        createdBy: 'user-1',
        status: InstanceStatus.ACTIVE,
        snapshot,
        steps: [step],
      });

      expect(instance.id).toBe('inst-reconstituted');
      expect(instance.status).toBe(InstanceStatus.ACTIVE);
      expect(instance.snapshot).toBe(snapshot);
      expect(instance.steps).toHaveLength(1);
      expect(instance.findStep('step-1')).toBe(step);
    });

    it('deve restaurar instância sem snapshot (draft)', () => {
      const instance = WorkflowInstance.reconstitute({
        id: 'inst-draft',
        tenantId: 'co-1',
        templateId: 'tpl-1',
        versionId: 'v1',
        createdBy: 'user-1',
        status: InstanceStatus.DRAFT,
        snapshot: null,
        steps: [],
      });

      expect(instance.snapshot).toBeNull();
      expect(instance.steps).toHaveLength(0);
    });
  });

  describe('decide() — regra QUORUM', () => {
    it('deve completar quando quórum é atingido', () => {
      const instance = new WorkflowInstance({
        id: 'inst-1',
        tenantId: 'co-1',
        templateId: 'tpl-1',
        versionId: 'v1',
        createdBy: 'user-1',
      });
      const step = makeStep({
        approvalRule: ApprovalRule.quorum(2),
        approvers: ['user-a', 'user-b', 'user-c'],
      });
      instance.submit(makeSnapshot(), [step]);

      instance.decide('step-1', 'user-a', 'approve');
      expect(instance.findStep('step-1')!.status).toBe(StepStatus.PENDING);

      instance.decide('step-1', 'user-b', 'approve');
      expect(instance.findStep('step-1')!.status).toBe(StepStatus.APPROVED);
    });
  });

  describe('SLA', () => {
    it('deve identificar step vencido quando slaDeadline passou', () => {
      const expiredStep = makeStep({
        slaDeadline: new Date(Date.now() - 60_000),
      });

      expect(expiredStep.isSlaBreached()).toBe(true);
    });
  });
});
