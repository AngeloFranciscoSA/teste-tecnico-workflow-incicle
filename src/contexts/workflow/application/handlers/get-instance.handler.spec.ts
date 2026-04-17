import { GetInstanceHandler } from './get-instance.handler';
import { GetInstanceQuery } from '../queries/get-instance.query';
import { WorkflowInstance } from '../../domain/aggregates/workflow-instance/workflow-instance.aggregate';

describe('GetInstanceHandler', () => {
  let handler: GetInstanceHandler;
  let instanceRepo: { findById: jest.Mock; save: jest.Mock; findAll: jest.Mock; findInboxForApprovers: jest.Mock };

  beforeEach(() => {
    instanceRepo = { findById: jest.fn(), save: jest.fn(), findAll: jest.fn(), findInboxForApprovers: jest.fn() };
    handler = new GetInstanceHandler(instanceRepo);
  });

  it('deve retornar a instância quando encontrada', async () => {
    const instance = new WorkflowInstance({
      id: 'inst-1',
      tenantId: 'co-1',
      templateId: 'tpl-1',
      versionId: 'v1',
      createdBy: 'user-1',
    });
    instanceRepo.findById.mockResolvedValue(instance);

    const result = await handler.execute(new GetInstanceQuery('inst-1', 'co-1'));

    expect(result).toBe(instance);
    expect(instanceRepo.findById).toHaveBeenCalledWith('inst-1', 'co-1');
  });

  it('deve lançar NotFoundException quando a instância não existir', async () => {
    instanceRepo.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new GetInstanceQuery('nao-existe', 'co-1')),
    ).rejects.toThrow();
  });
});
