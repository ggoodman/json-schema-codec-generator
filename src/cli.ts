import Yargs from 'yargs';
import * as Path from 'path';
import { promises as Fs } from 'fs';
import type { Schemas } from './index';
import fastGlob from 'fast-glob';

Yargs.help()
  .strict()
  .showHelpOnFail(true)
  .command(
    '$0 [path]',
    false,
    (args) => {
      return args.options({
        input: {
          alias: 'i',
          string: true,
          description: 'Path to a directory containing your json-schema files.',
          demandOption: true,
        },
        output: {
          alias: 'o',
          string: true,
          description:
            'Path to a directory where the generated codecs will be written. If not specified, the generated ',
        },
      });
    },
    async ({ input, output }) => {
      const inputPath = Path.resolve(process.cwd(), input);

      const matches = await fastGlob('**/*.json', {
        cwd: inputPath,
        stats: false,
        ignore: input.includes('node_modules') ? [] : ['node_modules/**/*.json'],
        absolute: false,
      });

      if (!matches.length) {
        console.error(`❌ No .json files found in ./${Path.relative(process.cwd(), inputPath)}.`);
        process.exit(1);
      }

      const schemas: Schemas = {};

      for (const schemaPathRel of matches) {
        const schemaPath = Path.join(inputPath, schemaPathRel);
        const schemaUrl = `file:///${schemaPathRel}`;
        const schemaData = await Fs.readFile(schemaPath, 'utf8');
        const schema = JSON.parse(schemaData);

        schemas[schemaUrl] = schema;
      }

      const { generateCodecCode } = await import('./index');
      const generated = await generateCodecCode(schemas);

      if (typeof output === 'string') {
        const outputPath = Path.resolve(process.cwd(), output);
        await Promise.all([
          Fs.writeFile(Path.join(outputPath, 'index.js'), generated.javaScript),
          Fs.writeFile(Path.join(outputPath, 'index.d.ts'), generated.typeDefinitions),
        ]);
      } else {
        console.log(JSON.stringify(generated, null, 2));
      }
    }
  ).argv;
