import Ajv, { Options } from 'ajv';
import addFormats, { FormatOptions } from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone';
import * as Esbuild from 'esbuild-wasm';
import { JSONSchema, Parser } from 'json-schema-to-dts';
import { staticFiles } from './generated/embedded';
import { resolveAsync } from './resolve';

export { CodecImpl } from './stub/codec';
export type { Codec } from './stub/types';
export { ValidationError } from './stub/validator';

export interface SchemaEntry {
  uri: string;
  schema: Exclude<JSONSchema, boolean>;
  preferredName?: string;
}

export interface GenerateCodecCodeOptions {
  ajvOptions?: Omit<Options, 'allErrors' | 'code' | 'inlineRefs'>;
  ajvFormatsOptions?: FormatOptions;
  validateFormats?: boolean;
  moduleFormat?: Esbuild.Format;
}

export async function generateCodecCode(
  schemas: SchemaEntry[],
  options: GenerateCodecCodeOptions = {}
) {
  const parser = new Parser();
  const ajv = new Ajv({
    verbose: true,
    ...(options.ajvOptions ?? {}),
    allErrors: true,
    code: {
      es5: false, // use es6
      lines: true,
      optimize: false, // we'll let rollup do this
      source: true,
    },
    inlineRefs: false,
  });

  if (options.validateFormats) {
    addFormats(ajv, options.ajvFormatsOptions);
  }

  const moduleFormat = options.moduleFormat || 'cjs';
  const exportedNameToSchema: Record<string, JSONSchema> = {};
  const uriToExportedName: Record<string, string> = {};
  /**
   * A collection of exported names used to add safety to some risky
   * regex-based code rewriting of `exports.<symbol> = ` to `export const <symbol> = `.
   */
  const exportedNames = new Set<string>();
  const codecDefinitions: string[] = [];
  const codecInstances: string[] = [];

  for (const { schema, uri, preferredName } of schemas) {
    const schemaWithId: JSONSchema = { $id: uri, ...schema };
    const name = parser.addSchema(uri, schemaWithId, { preferredName });

    if (exportedNames.has(name)) {
      throw new Error(
        `Invariant violation: The name ${JSON.stringify(name)} was expored more than once`
      );
    }

    exportedNames.add(name);
    uriToExportedName[uri] = name;
    exportedNameToSchema[name] = schemaWithId;

    ajv.addSchema(schemaWithId, name);

    codecDefinitions.push(`${name}: Codec<Types.${name}>`);
    codecInstances.push(
      `${name}: new CodecImpl<Types.${name}>(${JSON.stringify(name)}, ${JSON.stringify(
        uri
      )}, ${validatorNameForCodec(name)}) as Codec<Types.${name}>`
    );
  }

  const { diagnostics, text: schemaTypeDefs } = parser.compile({
    topLevel: {
      hasDeclareKeyword: false,
      isExported: true,
    },
  });

  if (diagnostics.length) {
    throw new Error(
      `Produced diagnostics while generating type definitions for schemas: ${diagnostics
        .map((diagnostic) => `${diagnostic.message}`)
        .join('\n')}`
    );
  }

  const standaloneValidationCode = standaloneCode(ajv);

  // There appears to be a bug in AJV code generation that writes the same function
  // more than once to the resulting validation code when there are $refs between
  // multiple schemas. This isn't strictly wrong since JavaScript allows redefinition
  // of functions but causes babel / TypeScript to barf.
  // We use this to track validation function names that are observed so that if
  // we find one that has already been seen, we can replace it with a dummy identifier.
  const seenFunctionNames = new Set<string>();
  let nextDummyFunctionSuffix = 0;
  let nextImportSuffix = 0;

  // The generated standalone validation code is in CommonJS. In order to
  // make a slimmer build, we're going to rewrite this to ESM. We replace
  // CommonJS export statements corresponding to entries in `exportedNames`
  // with ESM constant exports.
  const validationCode = standaloneValidationCode
    .replace(/^(?:module\.\s*)?exports.(\w+)\s*=/gm, (match, exportName) => {
      if (!exportedNames.has(exportName)) {
        throw new Error(
          `Invariant violation: The generated validation code contains the following CommonJS export ${JSON.stringify(
            match
          )} but there is no known exported type ${JSON.stringify(exportName)}`
        );
      }

      return `const ${validatorNameForCodec(exportName)} =`;
    })
    // We also need to rewrite some CommonJS imports added by AJV
    .replace(
      /const\s+(\S+)\s*=\s*require\(([^)]+)\)(?:\.([\w.]+))?/gm,
      (_match: string, importName: string, spec: string, ref?: string) => {
        // The idea of this function is to convert stuff like
        //   const foo = require('bar').baz.zork;
        // into
        //   import { baz: tmp_1 } from 'bar';
        //   const foo = tmp_1.zork;
        // However, since we don't know the nesting depth ahead of time, we need
        // to jump through a bunch of hoops.

        if (!ref) {
          return `import ${importName} from ${spec}`;
        }

        const parts = ref.split('.');
        const firstSegment = parts.shift();

        if (!ref.length) {
          return `import { ${firstSegment} as ${importName} } from ${spec}`;
        }

        let nesting = '';

        for (const part of parts) {
          if (part.startsWith('[')) {
            nesting += part;
          } else {
            nesting += `.${part}`;
          }
        }

        const intermediateName = `${importName}__${nextImportSuffix++}`;

        return `import { ${firstSegment} as ${intermediateName} } from ${spec}; const ${importName} = ${intermediateName}${nesting}`;
      }
    )
    .replace(/^function validate\d+/gm, (match) => {
      if (seenFunctionNames.has(match)) {
        // These 'dummy' functions should be eliminated by Rollup's tree shaking
        return `${match}ShakeMePlease${nextDummyFunctionSuffix++}`;
      }

      seenFunctionNames.add(match);

      return match;
    });

  const bundleResult = await Esbuild.build({
    bundle: true,
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    format: moduleFormat,
    outfile: 'codecs.js',
    platform: 'neutral',
    plugins: [
      {
        name: 'resolve',
        setup(build) {
          build.onResolve(
            { filter: /^ajv\/dist\// },
            async ({ importer, kind, path, resolveDir }) => {
              // console.log('onResolve[ajv](%O)', { importer, kind, path, resolveDir });
              try {
                const dist = require.resolve(path, { paths: [resolveDir] });
                const found = await resolveAsync(
                  dist.replace('ajv/dist/', 'ajv/lib/').replace(/\.js$/, ''),
                  {
                    basedir: resolveDir,
                    extensions: ['.js', '.ts'],
                  }
                );

                if (!found) {
                  return {
                    errors: [
                      {
                        text: `Unable to find the un-transpiled source for ${path}`,
                      },
                    ],
                  };
                }

                return {
                  path: found,
                  namespace: 'file',
                };
              } catch (err) {
                return {
                  errors: [
                    {
                      text: `Error while attempting to resolve ${path}: ${err.message}`,
                    },
                  ],
                };
              }
            }
          );

          build.onResolve(
            { filter: /^ajv-formats\/dist\// },
            async ({ importer, kind, path, resolveDir }) => {
              // console.log('onResolve[ajv-formats](%O)', { importer, kind, path, resolveDir });
              try {
                const dist = require.resolve(path, { paths: [resolveDir] });
                const found = await resolveAsync(
                  dist.replace('ajv-formats/dist/', 'ajv-formats/src/').replace(/\.js$/, ''),
                  {
                    basedir: resolveDir,
                    extensions: ['.js', '.ts'],
                  }
                );

                if (!found) {
                  return {
                    errors: [
                      {
                        text: `Unable to find the un-transpiled source for ${path}`,
                      },
                    ],
                  };
                }

                return {
                  path: found,
                  namespace: 'file',
                };
              } catch (err) {
                return {
                  errors: [
                    {
                      text: `Error while attempting to resolve ${path}: ${err.message}`,
                    },
                  ],
                };
              }
            }
          );

          const resolveMap: Record<string, { namespace: string; path: string }> = {
            './codec': {
              namespace: 'embedded',
              path: 'src/codec.ts',
            },
            './validator': {
              namespace: 'embedded',
              path: 'src/validator.ts',
            },
          };

          build.onResolve({ filter: /.*/ }, async ({ importer, kind, path, resolveDir }) => {
            // console.log('onResolve[mapped](%O)', { importer, kind, path, resolveDir });
            const mapped = resolveMap[path];

            if (mapped) {
              return mapped;
            }

            return undefined;
          });

          build.onLoad({ filter: /.*/, namespace: 'embedded' }, ({ namespace, path }) => {
            const contents = staticFiles[path];

            if (contents) {
              return {
                contents,
                loader: 'ts',
              };
            }
          });
        },
      },
    ],
    stdin: {
      contents: `
import { CodecImpl } from './codec';

${validationCode}

export const Codecs = {
  ${codecInstances.join(',\n')}
} as const;

      `,
      loader: 'ts',
      sourcefile: 'src/index.ts',
    },
    target: 'node10',
    treeShaking: true,
    write: false,
  });

  if (bundleResult.outputFiles.length !== 1) {
    throw new Error(
      `Invariant violation: Produced ${bundleResult.outputFiles.length}, expecting exactly 1`
    );
  }

  const javaScript = bundleResult.outputFiles[0].text;
  const typeDefinitions = `
${staticFiles['src/types.ts']}

export namespace Types {
  ${schemaTypeDefs.split('\n').join('\n  ')}
}

export declare const Codecs: {
  ${codecDefinitions.join(',\n  ')}
};
  `;

  return {
    javaScript,
    typeDefinitions,
    schamaPathsToCodecNames: uriToExportedName,
  };
}

function validatorNameForCodec(codecName: string) {
  return `__validate_${codecName}`;
}
