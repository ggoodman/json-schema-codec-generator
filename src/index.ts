import RollupPluginCommonJs from '@rollup/plugin-commonjs';
import RollupPluginTs from '@wessberg/rollup-plugin-ts';
import Ajv, { Options } from 'ajv';
import standaloneCode from 'ajv/dist/standalone';
import { JSONSchema, Parser } from 'json-schema-to-dts';
import * as Path from 'path';
import { format } from 'prettier';
import { OutputAsset, OutputChunk, rollup } from 'rollup';
import { VIRTUAL_ROOT } from './constants';
import { staticFiles } from './embedded';

export { CodecImpl } from './stub/codec';
export type { Codec } from './stub/codec';
export { ValidationError } from './stub/validator';

const indexPrelude =
  `
import { CodecImpl } from './codec';
import { Codec } from './codec';
import * as Types from './types';
import * as Validators from './validators';
export { Codec, Types };
`.trim() + '\n';
const validationPrelude =
  `
import * as Types from './types';
import { ValidateFunction } from './validator';  
`.trim() + '\n';

export interface SchemaEntry {
  uri: string;
  schema: Exclude<JSONSchema, boolean>;
  preferredName?: string;
}
export type Schemas = [SchemaEntry];

export interface GenerateCodecCodeOptions
  extends Omit<Options, 'allErrors' | 'code' | 'inlineRefs'> {}

export async function generateCodecCode(schemas: Schemas, options: GenerateCodecCodeOptions = {}) {
  const parser = new Parser();
  const ajv = new Ajv({
    verbose: true,
    ...options,
    allErrors: true,
    code: {
      es5: false, // use es6
      lines: true,
      optimize: false, // we'll let rollup do this
      source: true,
    },
    inlineRefs: false,
  });

  const exportedNameToSchema: Record<string, JSONSchema> = {};
  const uriToExportedName: Record<string, string> = {};
  /**
   * A collection of exported names used to add safety to some risky
   * regex-based code rewriting of `exports.<symbol> = ` to `export const <symbol> = `.
   */
  const exportedNames = new Set<string>();
  const validationFunctionDefinitions: string[] = [];
  const codecDefinitions: string[] = [];

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

    validationFunctionDefinitions.push(`export const ${name}: ValidateFunction<Types.${name}>;`);
    codecDefinitions.push(
      `${name}: new CodecImpl<Types.${name}>(${JSON.stringify(name)}, ${JSON.stringify(
        uri
      )}, Validators.${name}) as Codec<Types.${name}>`
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

      return `export const ${exportName} =`;
    })
    // We also need to rewrite some CommonJS imports added by AJV
    .replace(/const\s+(\S+)\s*=\s*require\(([^)]+)\).default/gm, (match, importName, spec) => {
      return `import ${importName} from ${spec}`;
    })
    .replace(/^function validate\d+/gm, (match) => {
      if (seenFunctionNames.has(match)) {
        // These 'dummy' functions should be eliminated by Rollup's tree shaking
        return `${match}ShakeMePlease${nextDummyFunctionSuffix++}`;
      }

      seenFunctionNames.add(match);

      return match;
    });

  const compilerOptions = {
    allowJs: true,
    allowSyntheticDefaultImports: true,
    alwaysStrict: true,
    baseUrl: 'src',
    checkJs: false,
    declaration: true,
    declarationMap: false,
    downlevelIteration: false,
    esModuleInterop: true,
    // isolatedModules: true,
    importHelpers: true,
    lib: ['es5'],
    skipDefaultLibCheck: true,
    skipLibCheck: true,
    module: 'commonjs',
    moduleResolution: 'node',
    outDir: 'dist',
    rootDir: 'src',
    target: 'es2017',
  };
  const tsConfig = {
    include: ['src'],
    compilerOptions,
  };

  const vfs = { ...staticFiles };

  vfs[Path.join(VIRTUAL_ROOT, 'src/index.ts')] =
    `
    ${indexPrelude}

    export const Codecs = {
    ${codecDefinitions.join(',\n')}
    } as const;
  `.trim() + '\n';

  vfs[Path.join(VIRTUAL_ROOT, 'src/types.ts')] =
    `
    ${schemaTypeDefs}
  `.trim() + '\n';

  vfs[Path.join(VIRTUAL_ROOT, 'src/validators.js')] =
    `
    ${validationCode}
  `.trim() + '\n';

  vfs[Path.join(VIRTUAL_ROOT, 'src/validators.d.ts')] =
    `
    ${validationPrelude}
    ${validationFunctionDefinitions.join('\n')}
  `.trim() + '\n';

  vfs[Path.join(VIRTUAL_ROOT, 'tsconfig.json')] = JSON.stringify(tsConfig);

  const build = await rollup({
    input: Path.resolve(VIRTUAL_ROOT, 'src/index.ts'),
    treeshake: {
      moduleSideEffects: (id) => {
        // console.debug('moduleHasSideEffects(%s, %s)', id, isExternal);

        // Make sure unreferenced modules can be tree-shaken by forcing
        // them to be considered side-effect-free.
        return false;
      },
    },
    plugins: [
      virtualFileSystemPlugin(vfs),
      RollupPluginTs({
        cwd: VIRTUAL_ROOT,
        transpiler: 'babel',
        browserslist: 'node 10',
        tsconfig: compilerOptions,
        // transpileOnly: true,
        fileSystem: createVirtualFilesystem(vfs),
      }),
      RollupPluginCommonJs({
        transformMixedEsModules: true,
      }),
      {
        name: 'prettier',
        renderChunk: async (code, chunk) => {
          return {
            code: format(code, {
              filepath: Path.join(process.cwd(), chunk.fileName),
            }),
          };
        },
      },
    ],
    onwarn: (warning) => {
      console.warn(warning.message);
    },
  });

  const output = await build.generate({
    dir: Path.resolve(VIRTUAL_ROOT, 'dist'),
    format: 'cjs',
  });

  const javaScriptChunk = output.output.find(
    (chunk) => chunk.type === 'chunk' && chunk.fileName === 'index.js'
  ) as OutputChunk | undefined;
  if (!javaScriptChunk) {
    throw new Error(`Invariant violation: The build failed to produce a JavaScript bundle.`);
  }

  const typeDefinitionChunk = output.output.find(
    (chunk) => chunk.type === 'asset' && chunk.fileName === 'index.d.ts'
  ) as OutputAsset | undefined;
  if (!typeDefinitionChunk) {
    throw new Error(`Invariant violation: The build failed to produce a JavaScript bundle.`);
  }

  return {
    javaScript: javaScriptChunk.code,
    typeDefinitions: typeDefinitionChunk.source,
    schamaPathsToCodecNames: uriToExportedName,
  };
}

function virtualFileSystemPlugin(vfs: { [key: string]: string }): import('rollup').Plugin {
  return {
    name: 'vfs',
    resolveId: async (source, importer) => {
      const candidateExt = ['', '.js', '.ts'];
      const [sourceBase, suffix = ''] = source.split('?', 2);

      let resolved = importer ? Path.resolve(Path.dirname(importer), sourceBase) : sourceBase;

      if (!sourceBase.startsWith('/') && !sourceBase.startsWith('.')) {
        resolved = `/virtual/src/node_modules/${sourceBase}`;
        // Solve for the case where node will consider a directory with an index also
        candidateExt.push(...candidateExt.map((ext) => `/index${ext}`));
      }

      for (const ext of candidateExt) {
        const candidate = `${resolved}${ext}`;

        if (candidate in vfs) {
          // console.debug('vfs.resolveId(%s, %s): %s', sourceBase, importer, candidate, '✅');
          return `${candidate}${suffix}`;
        }
        // console.debug('vfs.resolveId(%s, %s): %s', sourceBase, importer, candidate, '❌');
      }

      // console.debug('vfs.resolveId(%s, %s): %s', sourceBase, importer, undefined);
    },
    load: async (source) => {
      // console.debug('vfs.load(%s)', source);
      return vfs[source];
    },
  };
}

function createVirtualFilesystem(
  vfs: Record<string, string>
): import('@wessberg/rollup-plugin-ts').TypescriptPluginOptions['fileSystem'] {
  const virtualFs: import('@wessberg/rollup-plugin-ts').TypescriptPluginOptions['fileSystem'] = {
    directoryExists: (dirName) =>
      Object.keys(vfs).some((pathName) => pathName.startsWith(`${dirName}/`)),
    ensureDirectory: (dirName) => dirName,
    fileExists: (fileName) => fileName in vfs,
    getDirectories: (dirName) => {
      const dirNames = new Set<string>();
      const prefix = `${dirName}/`;

      for (const fileName in vfs) {
        if (fileName.startsWith(prefix)) {
          const rest = fileName.slice(prefix.length).split('/');

          if (rest.length > 1) {
            dirNames.add(rest[0]);
          }
        }
      }

      return [...dirNames];
    },
    newLine: '\n',
    readDirectory: (dirName, extensions, excludes, includes, depth = 20) => {
      const prefix = `${dirName}/`;
      const readResults = new Set<string>();

      for (const fileName in vfs) {
        if (fileName.startsWith(prefix)) {
          const rest = fileName.slice(prefix.length).split('/');

          readResults.add(`${prefix}${rest.slice(0, depth).join('/')}`);
        }
      }

      return [...readResults];
    },
    readFile: (fileName) => vfs[fileName],
    realpath: (fileName) => fileName,
    useCaseSensitiveFileNames: true,
    writeFile: (fileName, data) => void (vfs[fileName] = data),
  };

  return new Proxy(virtualFs, {
    get: (target, p) => {
      const found = Reflect.get(target, p);

      return typeof found === 'function'
        ? (...args: any[]) => {
            const res = found(...args);
            // console.debug(
            //   p,
            //   ...args,
            //   '=>',
            //   typeof res === 'string' || Buffer.isBuffer(res) ? res.toString().slice(0, 30) : res
            // );

            return res;
          }
        : found;
    },
  });
}

// async function main() {
//   return await withCleanup(async (defer) => {
//     const tmpDir = await Fs.mkdtemp('codec-', { encoding: 'utf-8' });
//     defer(() => Fs.rmdir(tmpDir, { recursive: true, maxRetries: 2 }));

//     for await (const entry of Fs.readdir())

//   });
// }
