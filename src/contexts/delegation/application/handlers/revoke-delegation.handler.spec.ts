import { RevokeDelegationHandler } from './revoke-delegation.handler';
import { RevokeDelegationCommand } from '../commands/revoke-delegation.command';
import { Delegation } from '../../domain/aggregates/delegation.aggregate';
import { DelegationPeriod } from '../../domain/value-objects/delegation-period.vo';

const makeActiveDelegation = (delegatorId = 'user-a', delegateId = 'user-b') =>
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

describe('RevokeDelegationHandler', () => {
  let handler: RevokeDelegationHandler;
  let delegationRepo: {
    findById: jest.Mock;
    findActiveForDelegate: jest.Mock;
    findAllActiveEdges: jest.Mock;
    save: jest.Mock;
    findAll: jest.Mock;
    findActive: jest.Mock;
  };

  beforeEach(() => {
    delegationRepo = {
      findById: jest.fn(),
      findActiveForDelegate: jest.fn(),
      findAllActiveEdges: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
    };
    handler = new RevokeDelegationHandler(delegationRepo);
  });

  it('deve revogar delegação existente quando o ator é o delegador', async () => {
    const delegation = makeActiveDelegation('user-a', 'user-b');
    delegationRepo.findById.mockResolvedValue(delegation);

    await handler.execute(new RevokeDelegationCommand('del-1', 'co-1', 'user-a'));

    expect(delegation.isActive()).toBe(false);
    expect(delegationRepo.save).toHaveBeenCalledWith(delegation);
  });

  it('deve lançar NotFoundException se a delegação não existir', async () => {
    delegationRepo.findById.mockResolvedValue(null);

    await expect(
      handler.execute(new RevokeDelegationCommand('nao-existe', 'co-1', 'user-a')),
    ).rejects.toThrow('not found');
  });

  it('deve lançar ForbiddenException se o ator não for o delegador', async () => {
    const delegation = makeActiveDelegation('user-a', 'user-b');
    delegationRepo.findById.mockResolvedValue(delegation);

    await expect(
      handler.execute(new RevokeDelegationCommand('del-1', 'co-1', 'user-b')),
    ).rejects.toThrow('Only the delegator');
  });
});
