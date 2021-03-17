import resolveSpec, { AsyncOpts } from 'resolve';

export function resolveAsync(spec: string, options: AsyncOpts) {
  return new Promise<string | undefined>((resolve, reject) =>
    resolveSpec(spec, options, (err, resolved) => {
      if (err && (err as any).code !== 'MODULE_NOT_FOUND') {
        return reject(err);
      }

      return resolve(resolved);
    })
  );
}
