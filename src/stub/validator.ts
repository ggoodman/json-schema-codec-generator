export interface ErrorObject {
  keyword: string;
  dataPath: string;
  schemaPath: string;
  params: { [key: string]: unknown };
  propertyName?: string;
  message: string;
  schema: unknown;
  data: unknown;
}

export class ValidationError extends Error {
  static isValidationError(err: unknown): err is ValidationError {
    return err instanceof this;
  }

  readonly validatorErrors: ErrorObject[];
  readonly value: unknown;

  constructor(schemaName: string, value: unknown, validatorErrors: ErrorObject[]) {
    const errorStrings = validatorErrors.map((err) => {
      return `  ${err.message} at ${err.dataPath || '#'}, got ${valueToShapeString(err.data)}`;
    });

    super(
      `Validation for the schema ${JSON.stringify(
        schemaName
      )} failed with the following errors:\n${errorStrings.join('\n')}`
    );

    this.value = value;
    this.validatorErrors = validatorErrors;
  }
}

export interface ValidateFunction<T = unknown> {
  (data: unknown): data is T;
  errors?: ErrorObject[];
}

function valueToShapeString(value: unknown) {
  return JSON.stringify(value, valueToShapeReplacer);
}

function valueToShapeReplacer(_key: string, value: unknown) {
  return typeof value === 'object' && value ? value : typeof value;
}
