export abstract class Entity<TId> {
  constructor(public readonly id: TId) {}

  equals(other?: Entity<TId>): boolean {
    if (!other || other.constructor !== this.constructor) return false;
    return this.id === other.id;
  }
}
