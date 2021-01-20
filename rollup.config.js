//@ts-check

/// <reference types="node" />

import RollupPluginCommonjs from '@rollup/plugin-commonjs';
import RollupPluginJson from '@rollup/plugin-json';
import RollupPluginNodeResolve from '@rollup/plugin-node-resolve';
import RollupPluginTs from '@wessberg/rollup-plugin-ts';
import * as Crypto from 'crypto';
import { promises as Fs } from 'fs';
import { builtinModules } from 'module';
import * as Path from 'path';
import * as Rollup from 'rollup';
import * as Package from './package.json';

const SPEC_RX = /^(@[^/]+\/[^/@]+|[^./@][^/@]*)(.*)?$/;

function parseBareModuleSpec(bareModuleSpec) {
  const matches = bareModuleSpec.match(SPEC_RX);

  if (matches) {
    const [, name, path = ''] = matches;

    return {
      name,
      path,
    };
  }

  return null;
}

function createIsExternal(packageJson) {
  const dependencies = new Set([...Object.keys(packageJson.dependencies || {}), ...builtinModules]);

  return function isExternal(id) {
    const spec = parseBareModuleSpec(id);

    if (!spec) return false;

    return dependencies.has(spec.name);
  };
}

/**
 *
 * @param {import('rollup').PluginContext} ctx
 */
async function generateStubs(ctx) {
  const embeddedSourceDir = Path.resolve(__dirname, './src/stub');
  const embeddedFilesPath = Path.resolve(__dirname, './src/embedded.ts');
  const embeddedFilesHash = Crypto.createHash('md5')
    .update(await Fs.readFile(embeddedFilesPath))
    .digest('hex');
  const embeddedBanner = `
// ------------------------------------
// WARNING: GENERATED CODE, DO NOT EDIT
// ------------------------------------
    `.trim();
  const embeddedFiles = await readEmbeddedFiles(ctx, embeddedSourceDir);
  const embeddedFilesCode = `${embeddedBanner}\n\nimport { VIRTUAL_ROOT } from './constants';\n\nexport const staticFiles = {\n${embeddedFiles
    .map(
      ({ fileName, content }) =>
        `  [\`\${VIRTUAL_ROOT}/src/${fileName}\`]: ${JSON.stringify(content)},`
    )
    .join('\n')}\n}\n`;
  const newHash = Crypto.createHash('md5').update(embeddedFilesCode).digest('hex');

  if (newHash !== embeddedFilesHash) {
    await Fs.writeFile(embeddedFilesPath, embeddedFilesCode);

    console.error(
      `✅ Updated embedded files in: %s`,
      Path.relative(process.cwd(), embeddedFilesPath)
    );
  } else {
    console.error(
      `🚫 Embedded files not modified in: %s`,
      Path.relative(process.cwd(), embeddedFilesPath)
    );
  }
}

/**
 *
 * @param {import('rollup').PluginContext} ctx
 */
async function readEmbeddedFiles(ctx, embeddedSourceDir) {
  const embeddedFilesEntries = await Fs.readdir(embeddedSourceDir, {
    encoding: 'utf-8',
    withFileTypes: true,
  });
  const embeddedFilesPromises = embeddedFilesEntries
    .filter((entry) => entry.isFile())
    .map(async (entry) => {
      const pathName = Path.resolve(embeddedSourceDir, entry.name);

      ctx.addWatchFile(pathName);

      const content = await Fs.readFile(pathName, 'utf8');
      return {
        fileName: entry.name,
        content,
      };
    });

  const libDTsFiles = [
    require.resolve('typescript/lib/lib.es5.d.ts'),
    require.resolve('tslib/package.json'),
    require.resolve('tslib/tslib.d.ts'),
    require.resolve('tslib/tslib.es6.js'),
    require.resolve('tslib/tslib.js'),
  ];

  for (const fileName of libDTsFiles) {
    embeddedFilesPromises.push(
      Fs.readFile(fileName, 'utf8').then((content) => {
        return {
          fileName: Path.relative(process.cwd(), fileName),
          content,
        };
      })
    );
  }

  const ajvFiles = [
    require.resolve('ajv/package.json'),
    require.resolve('ajv/dist/compile/ucs2length'),
  ];

  for (const fileName of ajvFiles) {
    embeddedFilesPromises.push(
      Fs.readFile(fileName, 'utf8').then((content) => {
        return {
          fileName: Path.relative(process.cwd(), fileName),
          content,
        };
      })
    );
  }

  return Promise.all(embeddedFilesPromises);
}

/** @type {Rollup.RollupOptions[]} */
const configs = [];

/** @type {Rollup.RollupOptions} */
const baseConfig = {
  input: './src/index.ts',
  external: createIsExternal(Package),
  plugins: [
    {
      name: 'stubs',
      async buildStart() {
        await generateStubs(this);
      },
    },
    RollupPluginJson(),
    RollupPluginNodeResolve({
      mainFields: ['module', 'main'],
    }),
    RollupPluginCommonjs({
      dynamicRequireTargets: [
        // include using a glob pattern (either a string or an array of strings)
        'node_modules/ajv/dist/compile**/*.js',
      ],
    }),
    RollupPluginTs({
      browserslist: ['node 12.16'],
      exclude: ['node_modules'],
      transpiler: 'babel',
    }),
  ],
};

if (Package.main) {
  configs.push({
    ...baseConfig,
    output: {
      exports: 'named',
      file: Path.resolve(process.cwd(), Package.main),
      format: 'commonjs',
      sourcemap: true,
    },
  });
}

if (Package.module) {
  configs.push({
    ...baseConfig,
    output: {
      exports: 'named',
      file: Path.resolve(process.cwd(), Package.module),
      format: 'esm',
      sourcemap: true,
    },
  });
}

configs.push({
  input: './src/cli.ts',
  output: {
    dir: Path.resolve(process.cwd(), './dist'),
    format: 'cjs',
    sourcemap: true,
  },
  external: (spec) => /^[^/.]/.test(spec),
  plugins: [
    {
      name: 'stubs',
      async buildStart() {
        await generateStubs(this);
      },
    },
    RollupPluginJson(),
    RollupPluginNodeResolve({
      mainFields: ['module', 'main'],
    }),
    RollupPluginCommonjs({
      dynamicRequireTargets: [
        // include using a glob pattern (either a string or an array of strings)
        'node_modules/ajv/dist/compile**/*.js',
      ],
    }),
    RollupPluginTs({
      exclude: ['node_modules'],
      transpiler: 'babel',
    }),
  ],
});

export default configs;
