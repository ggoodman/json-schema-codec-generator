# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Add support for the `omitEmitField` option in the `generateCodecCode` method. When specified, schemas having a truthy value in the field indicated by the `omitEmitField` value will not be added to the type emit.

## [0.7.0-0] - 2022-05-20
### Added
- Added support for the `externalizeValidatorLibrary` option in `generateCodecCode`. When a value of `true` is supplied for this option, the dependency on `@ggoodman/typed-validator` will be treated as a runtime dependency.

## [0.6.1] - 2021-04-08
### Fixed
- Fixed check for type-level compatibility between the local `ErrorObject` and the `ajv` equivalent.
  
  This was tripping up downstream build tools and so it was moved from the runtime code to the test suite (where it should have been from the beginning).

## [0.6.0] - 2021-04-08
### Changed
- Upgrade to `ajv@8.x` and `ajv-formats@2.x`.
  
  These upgrades dramatically reduce the amount of messy code manipulation needed to preprocess the 'standalone' code produced by ajv. This should make it simpler and less risky to upgrade ajv versions on an ongoing basis.

## [0.5.0] - 2021-04-08
### Added
- Introduce the `anyType` option for chosing the type to be used for unconstained JSON Schemas, object values and array items.
  
  This is useful, for example, if the restrictiveness of the default `"JSONValue"` (designed to represent any valid JSON value) is getting in the way. We introduce the following new options:
  
  - `"any"` - Unconstrained values will be typed as `any`.
  - `"unknown"` - Unconstrained values will be typed as `unknown`.

### Changed
- Bump `json-schema-to-dts` to a version allowing the selection of an `anyType`.

### Fixed
- Export a reference to `ValidationError` as indicated by the generated type definitions.
  
  This may be helpful for logic consuming the code produced by this library if it wants to be able to use an `instanceof` check to identify `ValidationError` instances. Alternatively, the `ValidationError.isValidationError` method can be used as a TypeScript type guard to perform a similar check.

## [0.4.5] - 2021-03-18
### Fixed
- Dropped superfluous `ValidationErrorStatic` interface.

## [0.4.4] - 2021-03-17
### Fixed
- Re-add missing dev dependencies.

## [0.4.3] - 2021-03-17
### Changed
- Dramatic simplification of internals, deletion of a lot of code and dependencies.

## [0.4.2] - 2021-03-17
### Fixed
- Another attempt to fix the release process.

## [0.4.1] - 2021-03-17
### Fixed
- Fixed publishing workflow.

## [0.4.0] - 2021-03-17
### Added
- Added optional for validating the `"format"` keyword for `"type": "string"` values.
  
  To opt into this feature, set the `validateFormats` option to `true` when compiling your schemas:
  
  ```js
  const {
    javaScript,
    schamaPathsToCodecNames,
    typeDefinitions,
  } = await generateCodecCode(schemas, {
    validateFormats: true,
  });
  ```
  
  Format validation code will only be included in the generated JavaScript code when this feature is enabled.
  
  To tweak the behaviour of these format validators, the `ajvFormatsOptions` setting can adjust the runtime behaviour of [`ajv-formats`](https://github.com/ajv-validator/ajv-formats). For a description of what options can be tweaked, please see the [`ajv-formats` options documentation](https://github.com/ajv-validator/ajv-formats#options).
- Choose between any of [Rollup's supported module formats](https://rollupjs.org/guide/en/#outputformat) for the generated JavaScript.
  
  Previously, `json-schema-codec-generator` would only produce ESM code, however this may be difficult to run in certain environments. To produce CommonJS code (suitable for running on any Node.js version), you can set `moduleFormat: 'cjs'`.

### Changed
- **BREAKING**: The shape of the options accepted by `generateCodecCode` has been changed. The options that were previously exposed at the top level of the options object are now nested within the `ajvOptions` sub-option.

## [0.3.2] - 2021-03-16
### Fixed
- Fixed working directory used for call to `npm publish` in release automation.

## [0.3.1] - 2021-03-16
### Fixed
- Fixed release and CI automation

## 0.3.0 - 2021-01-22
### Added
- Added support for passing a `preferredName` adjacent to the input `schema` to have better control over generated type names. [#1]

### Changed
- The `schemas` argument to `generateCodecCode` must now be an array of `SchemaEntry` objects, requiring `.uri` and `.schema` properties and supporting an optional `.preferredName` value. [#1]

[#1]: https://github.com/ggoodman/json-schema-codec-generator/issues/1

[Unreleased]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.7.0-0...HEAD
[0.7.0-0]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.6.1...v0.7.0-0
[0.6.1]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.4.5...v0.5.0
[0.4.5]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.4.4...v0.4.5
[0.4.4]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.4.3...v0.4.4
[0.4.3]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.4.2...v0.4.3
[0.4.2]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.3.0...v0.3.1
