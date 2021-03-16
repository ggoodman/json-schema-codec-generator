# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.3.2...HEAD
[0.3.2]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.3.0...v0.3.1
