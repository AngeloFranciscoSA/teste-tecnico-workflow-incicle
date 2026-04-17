import { Injectable } from '@nestjs/common';

export interface DelegationEdge {
  delegatorId: string;
  delegateId: string;
}

@Injectable()
export class CycleDetectorService {
  /**
   * Verifica se adicionar a delegação (newDelegator → newDelegate)
   * criaria um ciclo no grafo de delegações ativas.
   *
   * Algoritmo: BFS a partir de newDelegate, seguindo as arestas existentes.
   * Se algum nó visitado for igual a newDelegator, há ciclo.
   */
  wouldCreateCycle(
    newDelegator: string,
    newDelegate: string,
    activeDelegations: DelegationEdge[],
  ): boolean {
    // Auto-delegação é sempre um ciclo
    if (newDelegator === newDelegate) return true;

    const graph = this.buildGraph(activeDelegations);

    const visited = new Set<string>();
    const queue: string[] = [newDelegate];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === newDelegator) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const neighbors = graph.get(current) ?? [];
      queue.push(...neighbors);
    }

    return false;
  }

  private buildGraph(delegations: DelegationEdge[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    for (const { delegatorId, delegateId } of delegations) {
      if (!graph.has(delegatorId)) graph.set(delegatorId, []);
      graph.get(delegatorId)!.push(delegateId);
    }
    return graph;
  }
}
