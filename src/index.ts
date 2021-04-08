import Ajv, { Options } from 'ajv';
import addFormats, { FormatOptions } from 'ajv-formats';
import standaloneCode from 'ajv/dist/standalone';
import * as Esbuild from 'esbuild-wasm';
import { JSONSchema, Parser } from 'json-schema-to-dts';
import { staticFiles } from './generated/embedded';

export { CodecImpl } from './stub/codec';
export type { Codec } from './stub/types';
export { ValidationError } from './stub/validator';

export interface SchemaEntry {
  uri: string;
  schema: Exclude<JSONSchema, boolean>;
  preferredName?: string;
}

type AnyType = "any" | "JSONValue" | "unknown";
export interface GenerateCodecCodeOptions {
  anyType?: AnyType;
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
    validateFormats: options.validateFormats,
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

    ajv.addSchema(schemaWithId, validatorNameForCodec(name));

    codecDefinitions.push(`${name}: Codec<Types.${name}>`);
    codecInstances.push(
      `${name}: new CodecImpl<Types.${name}>(${JSON.stringify(name)}, ${JSON.stringify(
        uri
      )}, exports.${validatorNameForCodec(name)}) as Codec<Types.${name}>`
    );
  }

  const { diagnostics, text: schemaTypeDefs } = parser.compile({
    topLevel: {
      hasDeclareKeyword: false,
      isExported: true,
    },
    anyType: options.anyType ?? 'JSONValue',
  });

  if (diagnostics.length) {
    throw new Error(
      `Produced diagnostics while generating type definitions for schemas: ${diagnostics
        .map((diagnostic) => `${diagnostic.message}`)
        .join('\n')}`
    );
  }

  const standaloneValidationCode = standaloneCode(ajv);
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
export * from './validator';

${standaloneValidationCode}

export const Codecs = {
  ${codecInstances.join(',\n')}
} as const;

      `,
      loader: 'ts',
      sourcefile: 'src/index.ts',
      resolveDir: __dirname,
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
