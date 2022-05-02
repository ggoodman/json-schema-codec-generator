//@ts-check

/// <reference types="node" />

import RollupPluginCommonjs from '@rollup/plugin-commonjs';
import RollupPluginJson from '@rollup/plugin-json';
import RollupPluginNodeResolve from '@rollup/plugin-node-resolve';
import { builtinModules } from 'module';
import * as Path from 'path';
import * as Rollup from 'rollup';
import RollupPluginTs from 'rollup-plugin-ts';
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

/** @type {Rollup.RollupOptions[]} */
const configs = [];

/** @type {Rollup.RollupOptions} */
const baseConfig = {
  input: './src/index.ts',
  external: createIsExternal(Package),
  plugins: [
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
      transpiler: 'typescript',
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
      transpiler: 'typescript',
    }),
  ],
});

export default configs;
