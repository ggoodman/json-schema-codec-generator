// ------------------------------------
// WARNING: GENERATED CODE, DO NOT EDIT
// ------------------------------------

export const staticFiles: Record<string, string | undefined> = {
  "src/codec.ts": "import { ValidationError } from './validator';\nimport type { Codec, ValidateFunction } from './types';\n\nexport class CodecImpl<T> implements Codec<T> {\n  Type!: T;\n\n  constructor(\n    readonly name: string,\n    readonly uri: string,\n    private validateFn: ValidateFunction<T>\n  ) {}\n\n  /**\n   * Identify function returning the given argument as a value matching the schema.\n   *\n   * This can be useful to use in non-TypeScript code to construct a valid object while\n   * benefitting from suggestions from a TypeScript language service.\n   */\n  identity(obj: T): T {\n    return obj;\n  }\n\n  /**\n   * Check if a value matches the schema.\n   */\n  is(obj: unknown): obj is T {\n    return this.validateFn(obj);\n  }\n\n  /**\n   * Validate that a value matches the schema and throws if not.\n   */\n  validate(obj: unknown): T {\n    if (!this.validateFn(obj)) {\n      throw new ValidationError(this.name, obj, this.validateFn.errors || []);\n    }\n\n    return obj;\n  }\n}\n",
  "src/schema.ts": "type JSONPrimitive = boolean | null | number | string;\ntype JSONValue =\n  | JSONPrimitive\n  | JSONValue[]\n  | {\n      [key: string]: JSONValue;\n    };\n/**\n * Core schema meta-schema\n * @see http://json-schema.org/draft-07/schema#\n */\nexport type CoreSchemaMetaSchema = JSONSchema | boolean;\nexport interface JSONSchema {\n  $id?: string;\n  $schema?: string;\n  $ref?: string;\n  $comment?: string;\n  title?: string;\n  description?: string;\n  default?: JSONValue;\n  readOnly?: boolean;\n  writeOnly?: boolean;\n  examples?: JSONValue[];\n  multipleOf?: number;\n  maximum?: number;\n  exclusiveMaximum?: number;\n  minimum?: number;\n  exclusiveMinimum?: number;\n  maxLength?: NonNegativeInteger;\n  minLength?: NonNegativeIntegerDefault0;\n  pattern?: string;\n  additionalItems?: CoreSchemaMetaSchema;\n  items?: CoreSchemaMetaSchema | SchemaArray;\n  maxItems?: NonNegativeInteger;\n  minItems?: NonNegativeIntegerDefault0;\n  uniqueItems?: boolean;\n  contains?: CoreSchemaMetaSchema;\n  maxProperties?: NonNegativeInteger;\n  minProperties?: NonNegativeIntegerDefault0;\n  required?: StringArray;\n  additionalProperties?: CoreSchemaMetaSchema;\n  definitions?: {\n    [additionalProperties: string]: CoreSchemaMetaSchema;\n  };\n  properties?: {\n    [additionalProperties: string]: CoreSchemaMetaSchema;\n  };\n  patternProperties?: {\n    [additionalProperties: string]: CoreSchemaMetaSchema;\n  };\n  dependencies?: {\n    [additionalProperties: string]: CoreSchemaMetaSchema | StringArray;\n  };\n  propertyNames?: CoreSchemaMetaSchema;\n  const?: JSONValue;\n  enum?: JSONValue[];\n  type?: SimpleTypes | SimpleTypes[];\n  format?: string;\n  contentMediaType?: string;\n  contentEncoding?: string;\n  if?: CoreSchemaMetaSchema;\n  then?: CoreSchemaMetaSchema;\n  else?: CoreSchemaMetaSchema;\n  allOf?: SchemaArray;\n  anyOf?: SchemaArray;\n  oneOf?: SchemaArray;\n  not?: CoreSchemaMetaSchema;\n}\nexport type NonNegativeInteger = number;\nexport type NonNegativeIntegerDefault0 = NonNegativeInteger & JSONValue;\nexport type SchemaArray = CoreSchemaMetaSchema[];\nexport type StringArray = string[];\nexport type SimpleTypes = 'array' | 'boolean' | 'integer' | 'null' | 'number' | 'object' | 'string';\n",
  "src/types.ts": "export interface Codec<T> {\n  /**\n   * Identify function returning the given argument as a value matching the schema.\n   *\n   * This can be useful to use in non-TypeScript code to construct a valid object while\n   * benefitting from suggestions from a TypeScript language service.\n   */\n  identity(obj: T): T;\n\n  /**\n   * Check if a value matches the schema.\n   */\n  is(obj: unknown): obj is T;\n\n  /**\n   * Validate that a value matches the schema and throws if not.\n   */\n  validate(obj: unknown): T;\n}\n\nexport interface ErrorObject {\n  keyword: string;\n  dataPath: string;\n  schemaPath: string;\n  params: { [key: string]: unknown };\n  propertyName?: string;\n  message: string;\n  schema: unknown;\n  data: unknown;\n}\n\nexport interface ValidationErrorStatic {\n}\n\nexport declare class ValidationError extends Error {\n  static isValidationError(err: unknown): err is ValidationError;\n  \n  readonly validatorErrors: ErrorObject[];\n  readonly value: unknown;\n\n  constructor (schemaName: string, value: unknown, validatorErrors: ErrorObject[]);\n}\n\nexport interface ValidateFunction<T = unknown> {\n  (data: unknown): data is T;\n  errors?: ErrorObject[];\n}\n",
  "src/validator.ts": "import type { ErrorObject } from './types';\n\nexport class ValidationError extends Error {\n  static isValidationError(err: unknown): err is ValidationError {\n    return err instanceof this;\n  }\n\n  readonly validatorErrors: ErrorObject[];\n  readonly value: unknown;\n\n  constructor(schemaName: string, value: unknown, validatorErrors: ErrorObject[]) {\n    const errorStrings = validatorErrors.map((err) => {\n      return `  ${err.message} at ${err.dataPath || '#'}, got ${valueToShapeString(err.data)}`;\n    });\n\n    super(\n      `Validation for the schema ${JSON.stringify(\n        schemaName\n      )} failed with the following errors:\\n${errorStrings.join('\\n')}`\n    );\n\n    this.value = value;\n    this.validatorErrors = validatorErrors;\n  }\n}\n\nfunction valueToShapeString(value: unknown) {\n  return JSON.stringify(value, valueToShapeReplacer);\n}\n\nfunction valueToShapeReplacer(_key: string, value: unknown) {\n  return typeof value === 'object' && value ? value : typeof value;\n}\n",
}
