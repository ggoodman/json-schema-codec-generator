export interface Codec<T> {
  /**
   * Identify function returning the given argument as a value matching the schema.
   *
   * This can be useful to use in non-TypeScript code to construct a valid object while
   * benefitting from suggestions from a TypeScript language service.
   */
  identity(obj: T): T;

  /**
   * Check if a value matches the schema.
   */
  is(obj: unknown): obj is T;

  /**
   * Validate that a value matches the schema and throws if not.
   */
  validate(obj: unknown): T;
}

export interface ErrorObject {
  keyword: string;
  instancePath: string;
  schemaPath: string;
  params: { [key: string]: unknown };
  propertyName?: string;
  message?: string;
  schema?: unknown;
  data: unknown;
}

{
  // The following is designed to catch type compatibility issues between our local
  // ErrorObject definition and the canonical definition in ajv. This code block
  // is designed to be compiled out, and if not, be a no-op.
  ((_t: import('ajv').ErrorObject) => {})({} as ErrorObject);
}

export declare class ValidationError extends Error {
  static isValidationError(err: unknown): err is ValidationError;

  readonly validatorErrors: ErrorObject[];
  readonly value: unknown;

  constructor(schemaName: string, value: unknown, validatorErrors: ErrorObject[]);
}

export interface ValidateFunction<T = unknown> {
  (data: unknown): data is T;
  errors?: ErrorObject[];
}
