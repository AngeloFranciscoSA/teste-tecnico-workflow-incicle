import { CreateDelegationHandler } from './create-delegation.handler';
import { CreateDelegationCommand } from '../commands/create-delegation.command';
import { CycleDetectorService } from '../../domain/services/cycle-detector.service';

describe('CreateDelegationHandler', () => {
  let handler: CreateDelegationHandler;
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
      findAllActiveEdges: jest.fn().mockResolvedValue([]),
      save: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
    };
    const cycleDetector = new CycleDetectorService();
    const auditService = { log: jest.fn() } as any;
    handler = new CreateDelegationHandler(delegationRepo, cycleDetector, auditService);
  });

  const futureDate = (offsetMs: number) => new Date(Date.now() + offsetMs);

  it('deve criar e salvar uma delegação válida', async () => {
    const cmd = new CreateDelegationCommand(
      'del-1', 'co-1', 'user-a', 'user-b',
      futureDate(-3600_000), futureDate(3600_000),
    );

    await handler.execute(cmd);

    expect(delegationRepo.save).toHaveBeenCalledTimes(1);
    const saved = delegationRepo.save.mock.calls[0][0];
    expect(saved.delegatorId).toBe('user-a');
    expect(saved.delegateId).toBe('user-b');
  });

  it('deve lançar erro ao detectar ciclo A→B + B→A', async () => {
    delegationRepo.findAllActiveEdges.mockResolvedValue([
      { delegatorId: 'user-a', delegateId: 'user-b' },
    ]);

    const cmd = new CreateDelegationCommand(
      'del-2', 'co-1', 'user-b', 'user-a',
      futureDate(-3600_000), futureDate(3600_000),
    );

    await expect(handler.execute(cmd)).rejects.toThrow(/ciclo/i);
  });

  it('deve lançar erro ao detectar ciclo em cadeia A→B→C + C→A', async () => {
    delegationRepo.findAllActiveEdges.mockResolvedValue([
      { delegatorId: 'user-a', delegateId: 'user-b' },
      { delegatorId: 'user-b', delegateId: 'user-c' },
    ]);

    const cmd = new CreateDelegationCommand(
      'del-3', 'co-1', 'user-c', 'user-a',
      futureDate(-3600_000), futureDate(3600_000),
    );

    await expect(handler.execute(cmd)).rejects.toThrow(/ciclo/i);
  });

  it('deve lançar erro em auto-delegação', async () => {
    const cmd = new CreateDelegationCommand(
      'del-4', 'co-1', 'user-a', 'user-a',
      futureDate(-3600_000), futureDate(3600_000),
    );

    await expect(handler.execute(cmd)).rejects.toThrow(/ciclo/i);
  });

  it('deve emitir DelegationCreatedEvent ao salvar', async () => {
    const cmd = new CreateDelegationCommand(
      'del-1', 'co-1', 'user-a', 'user-b',
      futureDate(-3600_000), futureDate(3600_000),
    );

    await handler.execute(cmd);

    const saved = delegationRepo.save.mock.calls[0][0];
    expect(saved.domainEvents[0].eventName).toBe('DelegationCreated');
  });
});
