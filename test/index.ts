/// <reference types="jest" />

import Module from 'module';
import { Codec, generateCodecCode } from '../src';
import type { ErrorObject } from '../src/stub/types';

describe('Codec generation', () => {
  it('will produce the expected code', async () => {
    const { javaScript, schamaPathsToCodecNames, typeDefinitions } = await generateCodecCode([
      {
        schema: {
          title: 'A User Object',
          description: 'A user is a known visitor.',
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
            name: {
              type: 'string',
            },
          },
          required: ['id', 'name'],
        },
        uri: 'file:///User.json',
        preferredName: 'User',
      },
      {
        schema: {
          title: 'A Blog Post',
          description: 'A blog post represents an article associated with an author',
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
            title: {
              type: 'string',
            },
            content: {
              type: 'string',
            },
            author: {
              $ref: 'file:///User.json',
            },
          },
          required: ['id', 'title', 'content', 'user'],
        },
        uri: 'file:///BlogPost.json',
        preferredName: 'BlogPost',
      },
    ]);

    expect(javaScript).toMatchSnapshot();
    expect(schamaPathsToCodecNames).toMatchSnapshot();
    expect(typeDefinitions).toMatchSnapshot();
  });

  it('will validate a well-known format from ajv-formats', async () => {
    const { javaScript, schamaPathsToCodecNames, typeDefinitions } = await generateCodecCode(
      [
        {
          schema: {
            title: 'A Bookmark',
            type: 'object',
            properties: {
              url: {
                type: 'string',
                format: 'uri',
              },
              name: {
                type: 'string',
              },
              added_at: {
                type: 'string',
                format: 'date-time',
              },
              // To be re-enabled when OpenAPI formats land in ajv-formats
              // picture: {
              //   type: 'string',
              //   format: 'byte',
              // }
            },
            required: ['url', 'name', 'added_at'],
          },
          uri: 'file:///Bookmark.json',
          preferredName: 'Bookmark',
        },
      ],
      {
        moduleFormat: 'cjs',
        validateFormats: true,
      }
    );

    expect(javaScript).toMatchSnapshot();
    expect(schamaPathsToCodecNames).toMatchSnapshot();
    expect(typeDefinitions).toMatchSnapshot();

    const mod = new Module('schema', module);
    const instantiate = new Function('module', 'exports', 'require', javaScript);

    instantiate(mod, mod.exports, require);

    expect(mod.exports.Codecs).toHaveProperty('Bookmark');

    const Bookmark: Codec<any> = mod.exports.Codecs.Bookmark;
    const now = new Date();

    const want = {
      url: 'https://github.com/ggoodman',
      name: 'Geoff Goodman on GitHub',
      added_at: now.toISOString(),
    };
    const got = Bookmark.validate({
      url: 'https://github.com/ggoodman',
      name: 'Geoff Goodman on GitHub',
      added_at: now.toISOString(),
    });

    expect(want).toEqual(got);

    expect(
      Bookmark.is({
        url: 'https://github.com/ggoodman',
        name: 'Geoff Goodman on GitHub',
        added_at: now.toISOString(),
      })
    ).toEqual(true);

    await expect(() =>
      Bookmark.validate({
        url: 'github.com/ggoodman',
        name: 'Geoff Goodman on GitHub',
        added_at: now.toISOString(),
      })
    ).toThrowErrorMatchingInlineSnapshot(`
            "Validation for the schema \\"Bookmark\\" failed with the following errors:
              must match format \\"uri\\" at /url, got \\"string\\""
          `);
  });

  it('will export ValidationError', async () => {
    const { javaScript, schamaPathsToCodecNames, typeDefinitions } = await generateCodecCode(
      [
        {
          schema: {
            title: 'A Bookmark',
            type: 'object',
          },
          uri: 'file:///Bookmark.json',
          preferredName: 'Bookmark',
        },
      ],
      {
        moduleFormat: 'cjs',
        validateFormats: true,
      }
    );

    const mod = new Module('schema', module);
    const instantiate = new Function('module', 'exports', 'require', javaScript);

    instantiate(mod, mod.exports, require);

    {
      const want = 'function';
      const got = typeof mod.exports.ValidationError;

      expect(got).toEqual(want);
    }
    {
      const want = 'function';
      const got = typeof mod.exports.ValidationError.isValidationError;

      expect(got).toEqual(want);
    }

    {
      const err = new mod.exports.ValidationError('foo', {}, []);
      const want = true;
      const got = mod.exports.ValidationError.isValidationError(err);

      expect(got).toEqual(want);
    }
  });

  it('exports a ErrorObject type that is compatible with the ajv equivalent', () => {
    ((_t: import('ajv').ErrorObject) => {})({} as ErrorObject);
  });
});
