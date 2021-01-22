# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- Added support for passing a `preferredName` adjacent to the input `schema` to have better control over generated type names. #1

### Changed

- The `schemas` argument to `generateCodecCode` must now be an array of `SchemaEntry` objects, requiring `.uri` and `.schema` properties and supporting an optional `.preferredName` value. #1

[unreleased]: https://github.com/ggoodman/json-schema-codec-generator/compare/v0.2.3...HEAD
