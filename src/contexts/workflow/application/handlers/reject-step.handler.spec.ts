import { RejectStepHandler } from './reject-step.handler';
import { RejectStepCommand } from '../commands/reject-step.command';
import { WorkflowInstance, InstanceStatus } from '../../domain/aggregates/workflow-instance/workflow-instance.aggregate';
import { InstanceStep, StepStatus } from '../../domain/aggregates/workflow-instance/instance-step.entity';
import { Snapshot } from '../../domain/aggregates/workflow-instance/snapshot.value-object';
import { Delegation } from '../../../delegation/domain/aggregates/delegation.aggregate';
import { DelegationPeriod } from '../../../delegation/domain/value-objects/delegation-period.vo';
import { ApprovalRule } from '../../domain/value-objects/approval-rule.vo';

const makeActiveInstance = () => {
  const instance = new WorkflowInstance({
    id: 'inst-1',
    tenantId: 'co-1',
    templateId: 'tpl-1',
    versionId: 'v1',
    createdBy: 'user-1',
  });
  const step = new InstanceStep({
    id: 'step-1',
    instanceId: 'inst-1',
    stepOrder: 1,
    stepName: 'Gerência',
    approvalRule: ApprovalRule.all(),
    approvers: ['user-a'],
    slaHours: 24,
    status: StepStatus.PENDING,
    version: 0,
  });
  const snapshot = new Snapshot({
    templateId: 'tpl-1',
    versionId: 'v1',
    versionNumber: 1,
    steps: [{ stepOrder: 1, stepName: 'Gerência', approvalRule: ApprovalRule.all(), approvers: ['user-a'], slaHours: 24 }],
  });
  instance.submit(snapshot, [step]);
  instance.clearDomainEvents();
  return instance;
};

const makeActiveDelegation = (delegatorId: string, delegateId: string) =>
  new Delegation({
    id: 'del-1',
    tenantId: 'co-1',
    delegatorId,
    delegateId,
    period: new DelegationPeriod({
      startsAt: new Date(Date.now() - 3600_000),
      expiresAt: new Date(Date.now() + 3600_000),
    }),
  });

describe('RejectStepHandler', () => {
  let handler: RejectStepHandler;
  let instanceRepo: { findById: jest.Mock; save: jest.Mock; findAll: jest.Mock; findInboxForApprovers: jest.Mock };
  let delegationRepo: {
    findById: jest.Mock;
    findActiveForDelegate: jest.Mock;
    findAllActiveEdges: jest.Mock;
    save: jest.Mock;
    findAll: jest.Mock;
    findActive: jest.Mock;
  };

  beforeEach(() => {
    instanceRepo = { findById: jest.fn(), save: jest.fn(), findAll: jest.fn(), findInboxForApprovers: jest.fn() };
    delegationRepo = {
      findById: jest.fn(),
      findActiveForDelegate: jest.fn().mockResolvedValue(null),
      findAllActiveEdges: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn(async (callback: (manager: any) => Promise<void>) => callback({})),
    } as any;
    const auditService = { log: jest.fn() } as any;
    const outboxPublisher = { saveToOutbox: jest.fn(), publishPending: jest.fn() } as any;
    handler = new RejectStepHandler(
      instanceRepo,
      delegationRepo,
      dataSource,
      auditService,
      outboxPublisher,
    );
  });

  it('deve rejeitar o step e marcar a instância como rejected', async () => {
    const instance = makeActiveInstance();
    instanceRepo.findById.mockResolvedValue(instance);

    await handler.execute(new RejectStepCommand('inst-1', 'step-1', 'user-a', 'co-1'));

    expect(instance.findStep('step-1')!.status).toBe(StepStatus.REJECTED);
    expect(instance.status).toBe(InstanceStatus.REJECTED);
    expect(instanceRepo.save).toHaveBeenCalledWith(instance, expect.any(Object));
  });

  it('deve rejeitar via delegação quando o ator é delegado ativo', async () => {
    const instance = makeActiveInstance();
    instanceRepo.findById.mockResolvedValue(instance);
    delegationRepo.findActiveForDelegate.mockResolvedValue(
      makeActiveDelegation('user-a', 'user-b'),
    );

    await handler.execute(new RejectStepCommand('inst-1', 'step-1', 'user-b', 'co-1'));

    const decision = instance.findStep('step-1')!.decisions[0];
    expect(decision.actorId).toBe('user-b');
    expect(decision.isDelegated).toBe(true);
    expect(decision.originalApproverId).toBe('user-a');
  });

  it('deve bloquear rejeição de ator sem permissão no step', async () => {
    const instance = makeActiveInstance();
    instanceRepo.findById.mockResolvedValue(instance);

    await expect(
      handler.execute(new RejectStepCommand('inst-1', 'step-1', 'user-x', 'co-1')),
    ).rejects.toThrow('not allowed');
  });

  it('deve lançar NotFoundException se a instância não existir', async () => {
    instanceRepo.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new RejectStepCommand('nao-existe', 'step-1', 'user-a', 'co-1')),
    ).rejects.toThrow('not found');
  });

  it('deve emitir eventos de domínio ao rejeitar', async () => {
    const instance = makeActiveInstance();
    instanceRepo.findById.mockResolvedValue(instance);
    const outboxPublisher = { saveToOutbox: jest.fn(), publishPending: jest.fn() } as any;
    const auditService = { log: jest.fn() } as any;
    const dataSource = {
      transaction: jest.fn(async (callback: (manager: any) => Promise<void>) => callback({})),
    } as any;
    handler = new RejectStepHandler(
      instanceRepo,
      delegationRepo,
      dataSource,
      auditService,
      outboxPublisher,
    );

    await handler.execute(new RejectStepCommand('inst-1', 'step-1', 'user-a', 'co-1'));

    expect(outboxPublisher.saveToOutbox).toHaveBeenCalled();
    expect(outboxPublisher.publishPending).toHaveBeenCalled();
  });
});
