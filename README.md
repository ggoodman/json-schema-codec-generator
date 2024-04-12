# JSON-Schema Codec Generator

> Generate typed codec validator code from collections of inter-related json-schema

Generate typed codecs from collections of json-schema using the included library or the bundled CLI.

- Supports collections of schemas having `$reference`s between one-another.
- Produces type-safe validator functions via [ajv](https://npm.im/ajv).
- Designed for code-generation to maximize runtime performance.

## Installation

To install the CLI, the recommended approach is to install it globally.

```sh
npm install -g json-schema-codec-generator
```

Alternatively, you can use `npx` to install and run it on-demand.

```sh
npx json-schema-codec-generator --help
```

## CLI Usage

Given a folder full of `.json` files containing JSON-Schema definitions in `./path/to/my/schema/dir`, the following will produce:

1. `./codecs/index.js` -- JavaScript code that exports a `ValidatorFunction<T>` function for each discovered schema. These functions have no runtime dependencies and thus can be used in any JavaScript runtime.

   Each Schema passed in will have a corresponding [ValidatorFunction](#ValidatorFunction) generated.

1. `./codecs/index.d.ts` -- TypeScript definition files for the generated codecs. These type definitions ensure that code consuming the codecs will benefit from compile-time and edit-time type hinting.

```sh
json-schema-codec-generator --input ./path/to/my/schema/dir --output ./codecs/
```

## ValidatorFunction

```ts
export interface ErrorObject {
  instancePath: string;
  message?: string;
  data?: unknown;
}

export interface ValidatorFunction<T> {
  (obj: unknown): obj is T;
  errors?: ErrorObject[];
}
```

For a given schema named `Bookmark`, a validator function named `validateBookmark` of type `ValidatorFunction<Bookmark>` will be exported as well as a `Bookmark` type. These functions can be used as type assertions. Immediately after calling a validator function and seeing a validation failure, the validation errors can be recovered from `validateBookmark.errors`.
