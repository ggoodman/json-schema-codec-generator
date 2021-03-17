# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]
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

[Unreleased]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.3.2...v0.4.0
[0.3.2]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.3.0...v0.3.1
