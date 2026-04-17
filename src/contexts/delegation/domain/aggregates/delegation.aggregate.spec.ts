import { Delegation } from './delegation.aggregate';
import { DelegationPeriod } from '../value-objects/delegation-period.vo';

const activePeriod = () =>
  new DelegationPeriod({
    startsAt: new Date(Date.now() - 3600_000),
    expiresAt: new Date(Date.now() + 3600_000),
  });

const expiredPeriod = () =>
  new DelegationPeriod({
    startsAt: new Date(Date.now() - 7200_000),
    expiresAt: new Date(Date.now() - 3600_000),
  });

describe('Delegation', () => {
  it('deve estar ativa quando o período cobre o momento atual', () => {
    const delegation = new Delegation({
      id: 'del-1',
      tenantId: 'co-1',
      delegatorId: 'user-a',
      delegateId: 'user-b',
      period: activePeriod(),
    });

    expect(delegation.isActive()).toBe(true);
  });

  it('não deve estar ativa quando o período expirou', () => {
    const delegation = new Delegation({
      id: 'del-1',
      tenantId: 'co-1',
      delegatorId: 'user-a',
      delegateId: 'user-b',
      period: expiredPeriod(),
    });

    expect(delegation.isActive()).toBe(false);
  });

  it('deve emitir DelegationCreatedEvent ao criar', () => {
    const delegation = Delegation.create({
      id: 'del-1',
      tenantId: 'co-1',
      delegatorId: 'user-a',
      delegateId: 'user-b',
      period: activePeriod(),
    });

    expect(delegation.domainEvents).toHaveLength(1);
    expect(delegation.domainEvents[0].eventName).toBe('DelegationCreated');
  });

  it('deve emitir DelegationRevokedEvent ao revogar', () => {
    const delegation = new Delegation({
      id: 'del-1',
      tenantId: 'co-1',
      delegatorId: 'user-a',
      delegateId: 'user-b',
      period: activePeriod(),
    });

    delegation.revoke();

    expect(delegation.isActive()).toBe(false);
    expect(delegation.domainEvents.some((e) => e.eventName === 'DelegationRevoked')).toBe(true);
  });

  it('deve expor o período via getter', () => {
    const period = activePeriod();
    const delegation = new Delegation({
      id: 'del-1',
      tenantId: 'co-1',
      delegatorId: 'user-a',
      delegateId: 'user-b',
      period,
    });

    expect(delegation.period).toBe(period);
  });

  it('não deve permitir revogar delegação já expirada', () => {
    const delegation = new Delegation({
      id: 'del-1',
      tenantId: 'co-1',
      delegatorId: 'user-a',
      delegateId: 'user-b',
      period: expiredPeriod(),
    });

    expect(() => delegation.revoke()).toThrow();
  });
});
