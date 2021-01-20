# JSON-Schema Codec Generator

> Generate typed codec validator code from collections of json-schema

Generate typed codecs from collections of json-schema using the included library or the bundled CLI.

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

1. `./codecs/index.js` -- JavaScript code that exports a [`Codec`](#Codec) instance for each discovered schema. These codecs have no runtime dependencies and thus can be used in any JavaScript runtime.
1. `./codecs/index.d.ts` -- TypeScript definition files for the generated codecs. These type definitions ensure that code consuming the codecs will benefit from compile-time and edit-time type hinting.

```sh
json-schema-codec-generator --input ./path/to/my/schema/dir --output ./codecs/
```

## `Codec`

The `Codec` objects exported by the generated code have the following methods and properties:

- `.identity(obj)` -- A no-op function at runtime that is provided for developer ergonomics in a JavaScript environment where you want to construct a conforming object while benefitting from all the glory of modern type hinting provided by TypeScript language services.

- `.is(obj)` -- Check that `obj` value conforms to the JSON-Schema at **runtime** returning `true` or `false`. This also acts as a [user-defined type guard](https://www.typescriptlang.org/docs/handbook/advanced-types.html#user-defined-type-guards) so that if this function is used as a condition, anything within the consequent block will be correctly typed.

- `.validate(obj)` -- Ensures that `obj` value conforms to the JSON-Schema at **runtime**, throwing a `ValidationError` if not. Returns the validated object when valid.
