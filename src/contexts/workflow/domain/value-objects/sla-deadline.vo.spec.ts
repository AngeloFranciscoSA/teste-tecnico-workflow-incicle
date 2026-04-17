import { SlaDeadline } from './sla-deadline.vo';

describe('SlaDeadline', () => {
  it('não deve estar estourado quando o prazo é no futuro', () => {
    const future = new Date(Date.now() + 60_000);
    const sla = new SlaDeadline({ deadline: future });
    expect(sla.isBreached()).toBe(false);
  });

  it('deve estar estourado quando o prazo é no passado', () => {
    const past = new Date(Date.now() - 60_000);
    const sla = new SlaDeadline({ deadline: past });
    expect(sla.isBreached()).toBe(true);
  });

  it('deve criar a partir de horas corretamente', () => {
    const before = new Date();
    const sla = SlaDeadline.fromHours(24);
    const after = new Date();

    const expectedMin = before.getTime() + 24 * 3600 * 1000;
    const expectedMax = after.getTime() + 24 * 3600 * 1000;

    expect(sla.deadline.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(sla.deadline.getTime()).toBeLessThanOrEqual(expectedMax);
  });

  it('dois SlaDeadline com mesmo prazo devem ser iguais', () => {
    const date = new Date('2025-01-01T00:00:00Z');
    const a = new SlaDeadline({ deadline: date });
    const b = new SlaDeadline({ deadline: date });
    expect(a.equals(b)).toBe(true);
  });
});
