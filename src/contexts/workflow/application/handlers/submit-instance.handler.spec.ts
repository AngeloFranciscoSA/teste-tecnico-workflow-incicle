import { SubmitInstanceHandler } from './submit-instance.handler';
import { SubmitInstanceCommand } from '../commands/submit-instance.command';
import { SnapshotBuilderService } from '../../domain/services/snapshot-builder.service';
import { WorkflowInstance, InstanceStatus } from '../../domain/aggregates/workflow-instance/workflow-instance.aggregate';
import { TemplateVersion, VersionStatus } from '../../domain/aggregates/workflow-template/template-version.entity';
import { ApprovalRule } from '../../domain/value-objects/approval-rule.vo';

const makeInstance = () =>
  new WorkflowInstance({
    id: 'inst-1',
    tenantId: 'co-1',
    templateId: 'tpl-1',
    versionId: 'v1',
    createdBy: 'user-1',
  });

const makePublishedVersion = () =>
  new TemplateVersion({
    id: 'v1',
    templateId: 'tpl-1',
    versionNumber: 1,
    status: VersionStatus.PUBLISHED,
    steps: [
      {
        id: 'step-1',
        stepOrder: 1,
        stepName: 'Aprovação Gerência',
        approvalRule: ApprovalRule.all(),
        approvers: ['user-a'],
        slaHours: 24,
      },
    ],
  });

describe('SubmitInstanceHandler', () => {
  let handler: SubmitInstanceHandler;
  let instanceRepo: { findById: jest.Mock; save: jest.Mock; findAll: jest.Mock; findInboxForApprovers: jest.Mock };
  let templateRepo: { findById: jest.Mock; findPublishedVersion: jest.Mock; save: jest.Mock; findAll: jest.Mock };

  beforeEach(() => {
    instanceRepo = { findById: jest.fn(), save: jest.fn(), findAll: jest.fn(), findInboxForApprovers: jest.fn() };
    templateRepo = { findById: jest.fn(), findPublishedVersion: jest.fn(), save: jest.fn(), findAll: jest.fn() };
    const dataSource = {
      transaction: jest.fn(async (callback: (manager: any) => Promise<void>) => callback({})),
    } as any;
    const snapshotBuilder = new SnapshotBuilderService();
    const auditService = { log: jest.fn() } as any;
    const outboxPublisher = { saveToOutbox: jest.fn(), publishPending: jest.fn() } as any;
    handler = new SubmitInstanceHandler(
      instanceRepo,
      templateRepo,
      dataSource,
      snapshotBuilder,
      auditService,
      outboxPublisher,
    );
  });

  it('deve submeter a instância e salvar com snapshot', async () => {
    const instance = makeInstance();
    const version = makePublishedVersion();
    instanceRepo.findById.mockResolvedValue(instance);
    templateRepo.findPublishedVersion.mockResolvedValue(version);

    await handler.execute(new SubmitInstanceCommand('inst-1', 'co-1', 'user-1'));

    expect(instance.status).toBe(InstanceStatus.ACTIVE);
    expect(instance.snapshot).not.toBeNull();
    expect(instance.snapshot!.steps).toHaveLength(1);
    expect(instanceRepo.save).toHaveBeenCalledWith(instance, expect.any(Object));
  });

  it('deve lançar NotFoundException se a instância não existir', async () => {
    instanceRepo.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new SubmitInstanceCommand('nao-existe', 'co-1', 'user-1')),
    ).rejects.toThrow();
  });

  it('deve lançar erro se a versão não estiver publicada', async () => {
    const instance = makeInstance();
    instanceRepo.findById.mockResolvedValue(instance);
    templateRepo.findPublishedVersion.mockResolvedValue(null);

    await expect(
      handler.execute(new SubmitInstanceCommand('inst-1', 'co-1', 'user-1')),
    ).rejects.toThrow();
  });

  it('o snapshot deve ser imutável — cópia dos aprovadores', async () => {
    const instance = makeInstance();
    const version = makePublishedVersion();
    instanceRepo.findById.mockResolvedValue(instance);
    templateRepo.findPublishedVersion.mockResolvedValue(version);

    await handler.execute(new SubmitInstanceCommand('inst-1', 'co-1', 'user-1'));

    version.steps[0].approvers.push('user-intruso');
    expect(instance.snapshot!.steps[0].approvers).not.toContain('user-intruso');
  });

  it('deve atribuir slaDeadline aos steps criados no submit', async () => {
    const instance = makeInstance();
    const version = makePublishedVersion();
    instanceRepo.findById.mockResolvedValue(instance);
    templateRepo.findPublishedVersion.mockResolvedValue(version);

    await handler.execute(new SubmitInstanceCommand('inst-1', 'co-1', 'user-1'));

    expect(instance.steps[0].slaDeadline).toBeInstanceOf(Date);
    expect(instance.steps[0].slaBreached).toBe(false);
  });
});
