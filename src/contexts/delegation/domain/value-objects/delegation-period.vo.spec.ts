import { DelegationPeriod } from './delegation-period.vo';

describe('DelegationPeriod', () => {
  const now = new Date('2025-06-01T12:00:00Z');

  it('deve estar ativo quando a data está dentro do período', () => {
    const period = new DelegationPeriod({
      startsAt: new Date('2025-06-01T10:00:00Z'),
      expiresAt: new Date('2025-06-01T14:00:00Z'),
    });
    expect(period.contains(now)).toBe(true);
  });

  it('não deve estar ativo antes do início', () => {
    const period = new DelegationPeriod({
      startsAt: new Date('2025-06-01T13:00:00Z'),
      expiresAt: new Date('2025-06-01T14:00:00Z'),
    });
    expect(period.contains(now)).toBe(false);
  });

  it('não deve estar ativo após a expiração', () => {
    const period = new DelegationPeriod({
      startsAt: new Date('2025-06-01T10:00:00Z'),
      expiresAt: new Date('2025-06-01T11:00:00Z'),
    });
    expect(period.contains(now)).toBe(false);
  });

  it('deve lançar erro se expiresAt for anterior a startsAt', () => {
    expect(
      () =>
        new DelegationPeriod({
          startsAt: new Date('2025-06-01T14:00:00Z'),
          expiresAt: new Date('2025-06-01T10:00:00Z'),
        }),
    ).toThrow();
  });

  it('deve expor startsAt via getter', () => {
    const startsAt = new Date('2025-06-01T10:00:00Z');
    const period = new DelegationPeriod({
      startsAt,
      expiresAt: new Date('2025-06-01T14:00:00Z'),
    });
    expect(period.startsAt).toEqual(startsAt);
  });

  it('deve expor expiresAt via getter', () => {
    const expiresAt = new Date('2025-06-01T14:00:00Z');
    const period = new DelegationPeriod({
      startsAt: new Date('2025-06-01T10:00:00Z'),
      expiresAt,
    });
    expect(period.expiresAt).toEqual(expiresAt);
  });

  it('dois períodos com as mesmas datas devem ser iguais', () => {
    const a = new DelegationPeriod({
      startsAt: new Date('2025-06-01T10:00:00Z'),
      expiresAt: new Date('2025-06-01T14:00:00Z'),
    });
    const b = new DelegationPeriod({
      startsAt: new Date('2025-06-01T10:00:00Z'),
      expiresAt: new Date('2025-06-01T14:00:00Z'),
    });
    expect(a.equals(b)).toBe(true);
  });
});
