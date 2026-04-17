import { GetInboxHandler } from './get-inbox.handler';
import { GetInboxQuery } from '../queries/get-inbox.query';
import { Delegation } from '../../../delegation/domain/aggregates/delegation.aggregate';
import { DelegationPeriod } from '../../../delegation/domain/value-objects/delegation-period.vo';

const makeInboxRow = (approvers: string[]) => ({
  instanceId: 'inst-1',
  tenantId: 'co-1',
  stepId: 'step-1',
  stepName: 'Gerência',
  approvers,
});

describe('GetInboxHandler', () => {
  let handler: GetInboxHandler;
  let instanceRepo: { findById: jest.Mock; save: jest.Mock; findAll: jest.Mock; findInboxForApprovers: jest.Mock };
  let delegationRepo: { findActiveForDelegate: jest.Mock; findById: jest.Mock; findAllActiveEdges: jest.Mock; save: jest.Mock; findAll: jest.Mock; findActive: jest.Mock };

  beforeEach(() => {
    instanceRepo = { findById: jest.fn(), save: jest.fn(), findAll: jest.fn(), findInboxForApprovers: jest.fn() };
    delegationRepo = {
      findActiveForDelegate: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
      findAllActiveEdges: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
    };
    handler = new GetInboxHandler(instanceRepo, delegationRepo);
  });

  it('deve retornar instâncias em que o ator é aprovador pendente', async () => {
    instanceRepo.findInboxForApprovers.mockResolvedValue([makeInboxRow(['user-a', 'user-b'])]);

    const result = await handler.execute(new GetInboxQuery('user-a', 'co-1'));

    expect(result).toHaveLength(1);
    expect(result[0].instanceId).toBe('inst-1');
    expect(result[0].isDelegated).toBe(false);
  });

  it('não deve retornar instâncias onde o ator não é aprovador', async () => {
    instanceRepo.findInboxForApprovers.mockResolvedValue([]);

    const result = await handler.execute(new GetInboxQuery('user-a', 'co-1'));

    expect(result).toHaveLength(0);
  });

  it('deve incluir instâncias onde o ator é delegado de um aprovador pendente', async () => {
    instanceRepo.findInboxForApprovers.mockResolvedValue([makeInboxRow(['user-a'])]);
    delegationRepo.findActiveForDelegate.mockResolvedValue(
      new Delegation({
        id: 'del-1',
        tenantId: 'co-1',
        delegatorId: 'user-a',
        delegateId: 'user-b',
        period: new DelegationPeriod({
          startsAt: new Date(Date.now() - 3600_000),
          expiresAt: new Date(Date.now() + 3600_000),
        }),
      }),
    );

    const result = await handler.execute(new GetInboxQuery('user-b', 'co-1'));

    expect(result).toHaveLength(1);
    expect(result[0].isDelegated).toBe(true);
  });

  it('deve marcar isDelegated=false quando o ator é o próprio aprovador (não delegado)', async () => {
    instanceRepo.findInboxForApprovers.mockResolvedValue([makeInboxRow(['user-a', 'user-b'])]);
    delegationRepo.findActiveForDelegate.mockResolvedValue(
      new Delegation({
        id: 'del-1',
        tenantId: 'co-1',
        delegatorId: 'user-c',
        delegateId: 'user-a',
        period: new DelegationPeriod({
          startsAt: new Date(Date.now() - 3600_000),
          expiresAt: new Date(Date.now() + 3600_000),
        }),
      }),
    );

    const result = await handler.execute(new GetInboxQuery('user-a', 'co-1'));

    expect(result[0].isDelegated).toBe(false);
  });

  it('passa tenantId e actorId corretos para o repositório', async () => {
    instanceRepo.findInboxForApprovers.mockResolvedValue([]);

    await handler.execute(new GetInboxQuery('user-a', 'co-1'));

    expect(instanceRepo.findInboxForApprovers).toHaveBeenCalledWith('co-1', ['user-a'], 'user-a');
  });
});
