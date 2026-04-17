import { AggregateRoot } from './aggregate-root.base';
import { DomainEvent } from './domain-event.base';
import { Entity } from './entity.base';
import { Result } from './result';
import { ValueObject } from './value-object.base';

// ── Fixtures ─────────────────────────────────────────────────────────────────

class Money extends ValueObject<{ amount: number; currency: string }> {}

class UserId extends Entity<string> {}

class UserCreatedEvent extends DomainEvent {
  constructor(userId: string) {
    super(userId, 'UserCreated');
  }
}

class User extends AggregateRoot<string> {
  constructor(id: string) {
    super(id);
    this.addDomainEvent(new UserCreatedEvent(id));
  }
}

// ── ValueObject ───────────────────────────────────────────────────────────────

describe('ValueObject', () => {
  it('deve ser igual quando os valores são os mesmos', () => {
    const a = new Money({ amount: 100, currency: 'BRL' });
    const b = new Money({ amount: 100, currency: 'BRL' });
    expect(a.equals(b)).toBe(true);
  });

  it('deve ser diferente quando os valores diferem', () => {
    const a = new Money({ amount: 100, currency: 'BRL' });
    const b = new Money({ amount: 200, currency: 'BRL' });
    expect(a.equals(b)).toBe(false);
  });

  it('deve ser diferente de undefined', () => {
    const a = new Money({ amount: 100, currency: 'BRL' });
    expect(a.equals(undefined)).toBe(false);
  });

  it('deve ser imutável após criação', () => {
    const a = new Money({ amount: 100, currency: 'BRL' });
    expect(() => {
      (a as any).props.amount = 999;
    }).toThrow();
  });
});

// ── Entity ────────────────────────────────────────────────────────────────────

describe('Entity', () => {
  it('deve ser igual quando os IDs são iguais', () => {
    const a = new UserId('user-1');
    const b = new UserId('user-1');
    expect(a.equals(b)).toBe(true);
  });

  it('deve ser diferente quando os IDs diferem', () => {
    const a = new UserId('user-1');
    const b = new UserId('user-2');
    expect(a.equals(b)).toBe(false);
  });
});

// ── AggregateRoot ─────────────────────────────────────────────────────────────

describe('AggregateRoot', () => {
  it('deve acumular domain events após ação', () => {
    const user = new User('user-1');
    expect(user.domainEvents).toHaveLength(1);
    expect(user.domainEvents[0].eventName).toBe('UserCreated');
    expect(user.domainEvents[0].aggregateId).toBe('user-1');
  });

  it('deve limpar domain events após clearDomainEvents()', () => {
    const user = new User('user-1');
    user.clearDomainEvents();
    expect(user.domainEvents).toHaveLength(0);
  });

  it('domainEvents deve retornar cópia, não referência interna', () => {
    const user = new User('user-1');
    const events = user.domainEvents;
    events.push(new UserCreatedEvent('outro'));
    expect(user.domainEvents).toHaveLength(1);
  });
});

// ── Result ────────────────────────────────────────────────────────────────────

describe('Result', () => {
  it('Result.ok deve conter o valor', () => {
    const result = Result.ok(42);
    expect(result.isOk).toBe(true);
    expect(result.isFail).toBe(false);
    expect(result.value).toBe(42);
  });

  it('Result.fail deve conter o erro', () => {
    const result = Result.fail('algo deu errado');
    expect(result.isFail).toBe(true);
    expect(result.isOk).toBe(false);
    expect(result.error).toBe('algo deu errado');
  });

  it('acessar .value em um Result.fail deve lançar exceção', () => {
    const result = Result.fail('erro');
    expect(() => result.value).toThrow();
  });

  it('acessar .error em um Result.ok deve lançar exceção', () => {
    const result = Result.ok('sucesso');
    expect(() => result.error).toThrow();
  });
});
