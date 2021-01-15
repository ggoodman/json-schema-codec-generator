import { ValidationError, ValidateFunction } from './validator';

export class Codec<T> {
  Type!: T;

  constructor(
    readonly name: string,
    readonly uri: string,
    private validateFn: ValidateFunction<T>
  ) {}

  /**
   * Asserts that a value matches the schema.
   */
  assert(obj: unknown): asserts obj is T {
    if (!this.validateFn(obj)) {
      throw new ValidationError(this.name, obj, this.validateFn.errors || []);
    }
  }

  /**
   * Identify function returning the given argument as a value matching the schema.
   *
   * This can be useful to use in non-TypeScript code to construct a valid object while
   * benefitting from suggestions from a TypeScript language service.
   */
  identity(obj: T): T {
    return obj;
  }

  /**
   * Check if a value matches the schema.
   */
  is(obj: unknown): obj is T {
    return this.validateFn(obj);
  }
}
