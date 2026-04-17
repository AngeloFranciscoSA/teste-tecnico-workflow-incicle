export class Result<T, E = string> {
  private constructor(
    private readonly _isOk: boolean,
    private readonly _value?: T,
    private readonly _error?: E,
  ) {}

  static ok<T>(value: T): Result<T, never> {
    return new Result<T, never>(true, value);
  }

  static fail<E>(error: E): Result<never, E> {
    return new Result<never, E>(false, undefined, error);
  }

  get isOk(): boolean {
    return this._isOk;
  }

  get isFail(): boolean {
    return !this._isOk;
  }

  get value(): T {
    if (!this._isOk) throw new Error('Cannot get value of a failed Result');
    return this._value as T;
  }

  get error(): E {
    if (this._isOk) throw new Error('Cannot get error of a successful Result');
    return this._error as E;
  }
}
