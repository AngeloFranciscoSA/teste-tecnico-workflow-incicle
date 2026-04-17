import { CycleDetectorService } from './cycle-detector.service';

describe('CycleDetectorService', () => {
  let service: CycleDetectorService;

  beforeEach(() => {
    service = new CycleDetectorService();
  });

  it('não deve detectar ciclo quando não há delegações', () => {
    const hasCycle = service.wouldCreateCycle('user-a', 'user-b', []);
    expect(hasCycle).toBe(false);
  });

  it('não deve detectar ciclo em cadeia linear A→B→C', () => {
    const activeDelegations = [
      { delegatorId: 'user-a', delegateId: 'user-b' },
      { delegatorId: 'user-b', delegateId: 'user-c' },
    ];
    // Tentativa: user-c → user-d (sem ciclo)
    const hasCycle = service.wouldCreateCycle('user-c', 'user-d', activeDelegations);
    expect(hasCycle).toBe(false);
  });

  it('deve detectar ciclo direto A→B, tentativa B→A', () => {
    const activeDelegations = [{ delegatorId: 'user-a', delegateId: 'user-b' }];
    // Tentativa: user-b → user-a cria ciclo
    const hasCycle = service.wouldCreateCycle('user-b', 'user-a', activeDelegations);
    expect(hasCycle).toBe(true);
  });

  it('deve detectar ciclo em cadeia A→B→C, tentativa C→A', () => {
    const activeDelegations = [
      { delegatorId: 'user-a', delegateId: 'user-b' },
      { delegatorId: 'user-b', delegateId: 'user-c' },
    ];
    // Tentativa: user-c → user-a fecha o ciclo
    const hasCycle = service.wouldCreateCycle('user-c', 'user-a', activeDelegations);
    expect(hasCycle).toBe(true);
  });

  it('deve detectar ciclo em grafo maior A→B→C→D, tentativa D→A', () => {
    const activeDelegations = [
      { delegatorId: 'user-a', delegateId: 'user-b' },
      { delegatorId: 'user-b', delegateId: 'user-c' },
      { delegatorId: 'user-c', delegateId: 'user-d' },
    ];
    const hasCycle = service.wouldCreateCycle('user-d', 'user-a', activeDelegations);
    expect(hasCycle).toBe(true);
  });

  it('deve detectar auto-delegação como ciclo', () => {
    const hasCycle = service.wouldCreateCycle('user-a', 'user-a', []);
    expect(hasCycle).toBe(true);
  });

  it('não deve detectar ciclo em grafo diamante sem caminho de volta ao delegador', () => {
    // Grafo: A→B, A→C, B→D, C→D (diamante)
    // Tentativa: X→A (sem ciclo, D não aponta para nada)
    const activeDelegations = [
      { delegatorId: 'user-a', delegateId: 'user-b' },
      { delegatorId: 'user-a', delegateId: 'user-c' },
      { delegatorId: 'user-b', delegateId: 'user-d' },
      { delegatorId: 'user-c', delegateId: 'user-d' },
    ];
    // Cobre linha do guard `visited.has(current)` (user-d aparece duas vezes na fila)
    // e cobre o branch onde graph.has(delegatorId) já é true (user-a aparece duas vezes)
    const hasCycle = service.wouldCreateCycle('user-x', 'user-a', activeDelegations);
    expect(hasCycle).toBe(false);
  });

  it('deve detectar ciclo em grafo diamante com caminho de retorno', () => {
    // Grafo: A→B, A→C, B→D, C→D, D→X
    // Tentativa: X→A (D→X→A fecha ciclo)
    const activeDelegations = [
      { delegatorId: 'user-a', delegateId: 'user-b' },
      { delegatorId: 'user-a', delegateId: 'user-c' },
      { delegatorId: 'user-b', delegateId: 'user-d' },
      { delegatorId: 'user-c', delegateId: 'user-d' },
      { delegatorId: 'user-d', delegateId: 'user-x' },
    ];
    const hasCycle = service.wouldCreateCycle('user-x', 'user-a', activeDelegations);
    expect(hasCycle).toBe(true);
  });
});
