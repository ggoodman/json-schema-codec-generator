export const prelude = `
export interface Codec<T> {
  /**
   * Validate that an unknown value matches the underlying schema, returning a typed
   * object.
   */
  validate(json: unknown): T;

  /**
   * Return the input value unmodified while asserting the input is correctly typed.
   * 
   * The identify function is useful to use in untyped code to facilitate
   * constructing valid values while benefitting from the type-checking
   * features of modern code editors. This function may also be useful to act as a
   * compile-time type guard that imposes no runtime validation cost, since the input
   * is simply returned unmodified.
   */
  identity(value: T): T;

  /**
   * Validate that an unknown value matches the underlying schema, and act as a boolean
   * type-guard.
   */
  is(json: unknown): json is T;
}

interface ValidatorError {
  keywordLocation: string;
  instanceLocation: string;
}

interface Validator<T> {
  (json: unknown): json is T;
  errors: ValidatorError[] | null;
}

class CodecImpl<T> implements Codec<T> {
  constructor(
    public readonly name: string,
    private readonly validator: Validator<T>
  ) {}

  validate(value: unknown): T {
    if (!this.validator(value)) {
      throw this.validationError(value, this.validator.errors);
    }

    return value;
  }

  identity(value: T): T {
    return value;
  }

  is(json: unknown): json is T {
    try {
      this.validate(json);
      return true;
    } catch {
      return false;
    }
  }

  private validationError(value: unknown, errors: ValidatorError[] | null) {
    // Defensive code to check that schemasafe produced the errors as expected
    if (!Array.isArray(errors) || !errors.length) {
      return new Error(\`Value did not match the schema \${this.name}\`);
    }

    return new ValidationError(this.name, this.schema, value, errors);
  }
}

export class ValidationError extends Error {
  static isValidationError(err: unknown): err is ValidationError {
    return err instanceof this;
  }

  public readonly schema: unknown;
  public readonly value: unknown;
  public readonly validatorErrors: ReadonlyArray<ValidatorError>;

  constructor(
    schemaName: string,
    schema: unknown,
    value: unknown,
    validatorErrors: ValidatorError[]
  ) {
    const seenValuePaths = new Set<string>();
    const errorStrings: string[] = [];

    nextError: for (const validatorError of validatorErrors) {
      const valuePath = locationToPath(validatorError.instanceLocation);
      const [foundPath, valueSlice] = getAtClosestPath(value, valuePath);
      const foundPathString = \`#/\${foundPath.join('/')}\`;

      if (seenValuePaths.has(foundPathString)) {
        continue;
      }

      for (const seenValuePath of seenValuePaths) {
        if (foundPathString.startsWith(\`\${seenValuePath}/\`)) {
          continue nextError;
        }
      }

      seenValuePaths.add(foundPathString);

      const shape = valueToShapeString(valueSlice);

      errorStrings.push(
        \`  The value at \${JSON.stringify(
          foundPathString
        )} with shape \${shape} did not match the schema defined at \${JSON.stringify(
          validatorError.keywordLocation
        )}\`
      );
    }

    super(
      \`Validation for the schema \${JSON.stringify(
        schemaName
      )} failed with the following errors:\n\${errorStrings.join('\n')}\`.replace(/"/g, "'")
    );

    this.schema = schema;
    this.value = value;
    this.validatorErrors = validatorErrors;
  }
}

/**
* Convert a json-path reference to an array of string segments
*
* @param location json-path such as \`#/path/to/value\`
*/
function locationToPath(location: string): string[] {
  const unprefixedLocation = location.startsWith('#/') ? location.slice(2) : location;

  return unprefixedLocation.split('/');
}

function getAtClosestPath(value: unknown, path: string[]): [string[], unknown] {
  const foundPath: string[] = [];
  let lastValue = value;

  for (let segment of path) {
    const nextValue = (lastValue as any)[segment] as unknown;

    if (typeof nextValue === 'undefined' || nextValue === null) {
      break;
    }

    foundPath.push(segment);
    lastValue = nextValue;
  }

  return [foundPath, lastValue];
}

function valueToShapeString(value: unknown) {
  return JSON.stringify(value, valueToShapeReplacer);
}

function valueToShapeReplacer(_key: string, value: unknown) {
  return typeof value === 'object' && value ? value : typeof value;
}
`;
