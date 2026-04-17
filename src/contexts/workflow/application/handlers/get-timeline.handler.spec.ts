import { GetTimelineHandler } from './get-timeline.handler';
import { GetTimelineQuery } from '../queries/get-timeline.query';
import { WorkflowInstance } from '../../domain/aggregates/workflow-instance/workflow-instance.aggregate';
import { InstanceStep, StepStatus } from '../../domain/aggregates/workflow-instance/instance-step.entity';
import { Snapshot } from '../../domain/aggregates/workflow-instance/snapshot.value-object';
import { ApprovalRule } from '../../domain/value-objects/approval-rule.vo';

const makeActiveInstance = () => {
  const instance = new WorkflowInstance({
    id: 'inst-1',
    tenantId: 'co-1',
    templateId: 'tpl-1',
    versionId: 'v1',
    createdBy: 'user-creator',
  });
  const step = new InstanceStep({
    id: 'step-1',
    instanceId: 'inst-1',
    stepOrder: 1,
    stepName: 'Aprovação',
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
    steps: [{ stepOrder: 1, stepName: 'Aprovação', approvalRule: ApprovalRule.all(), approvers: ['user-a'], slaHours: 24 }],
  });
  instance.submit(snapshot, [step]);
  return instance;
};

describe('GetTimelineHandler', () => {
  let handler: GetTimelineHandler;
  let instanceRepo: { findById: jest.Mock; save: jest.Mock; findAll: jest.Mock; findInboxForApprovers: jest.Mock };

  beforeEach(() => {
    instanceRepo = { findById: jest.fn(), save: jest.fn(), findAll: jest.fn(), findInboxForApprovers: jest.fn() };
    handler = new GetTimelineHandler(instanceRepo);
  });

  it('deve retornar evento SUBMITTED quando a instância tem snapshot', async () => {
    const instance = makeActiveInstance();
    instanceRepo.findById.mockResolvedValue(instance);

    const timeline = await handler.execute(new GetTimelineQuery('inst-1', 'co-1'));

    expect(Array.isArray(timeline)).toBe(true);
    expect(timeline.length).toBeGreaterThanOrEqual(1);
    const submitted = timeline.find((e) => e.type === 'SUBMITTED');
    expect(submitted).toBeDefined();
    expect(submitted!.actorId).toBe('user-creator');
  });

  it('deve retornar array vazio de eventos quando instância não tem snapshot (draft)', async () => {
    const instance = new WorkflowInstance({
      id: 'inst-draft',
      tenantId: 'co-1',
      templateId: 'tpl-1',
      versionId: 'v1',
      createdBy: 'user-creator',
    });
    instanceRepo.findById.mockResolvedValue(instance);

    const timeline = await handler.execute(new GetTimelineQuery('inst-draft', 'co-1'));

    expect(Array.isArray(timeline)).toBe(true);
    const submitted = timeline.find((e) => e.type === 'SUBMITTED');
    expect(submitted).toBeUndefined();
  });

  it('deve lançar NotFoundException se a instância não existir', async () => {
    instanceRepo.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetTimelineQuery('nao-existe', 'co-1')),
    ).rejects.toThrow('not found');
  });

  it('deve retornar timeline ordenada por occurredAt', async () => {
    const instance = makeActiveInstance();
    instanceRepo.findById.mockResolvedValue(instance);

    const timeline = await handler.execute(new GetTimelineQuery('inst-1', 'co-1'));

    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].occurredAt.getTime()).toBeGreaterThanOrEqual(
        timeline[i - 1].occurredAt.getTime(),
      );
    }
  });
});
