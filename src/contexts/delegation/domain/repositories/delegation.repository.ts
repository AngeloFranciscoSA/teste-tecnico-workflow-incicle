import { Delegation } from '../aggregates/delegation.aggregate';

export const DELEGATION_REPOSITORY = Symbol('IDelegationRepository');

export interface DelegationEdgeSummary {
  delegatorId: string;
  delegateId: string;
}

export interface IDelegationRepository {
  findById(id: string, tenantId: string): Promise<Delegation | null>;
  findActiveForDelegate(delegateId: string, tenantId: string): Promise<Delegation | null>;
  findAllActiveEdges(tenantId: string): Promise<DelegationEdgeSummary[]>;
  save(delegation: Delegation): Promise<void>;
  findAll(tenantId: string): Promise<Delegation[]>;
  findActive(tenantId: string): Promise<Delegation[]>;
}
