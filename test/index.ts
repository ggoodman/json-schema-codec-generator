/// <reference types="jest" />

import { ValidateFunction } from 'ajv';
import Module from 'module';
import { generateCodecCode } from '../src';

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

  it('will support extensibility fields', async () => {
    const { javaScript, schamaPathsToCodecNames, typeDefinitions } = await generateCodecCode(
      [
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
            type: 'object',
            properties: {
              id: {
                type: 'string',
              },
              hidden: {
                description: 'A hidden property',
                type: 'string',
                'x-omit-types': true,
              },
            },
            required: ['id', 'hidden'],
          },
          uri: 'file:///Thing.json',
          preferredName: 'Thing',
        },
      ],
      {
        omitEmitField: 'x-omit-types',
      },
    );

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
      },
    );

    expect(javaScript).toMatchSnapshot();
    expect(schamaPathsToCodecNames).toMatchSnapshot();
    expect(typeDefinitions).toMatchSnapshot();

    const mod = new Module('schema', module);
    const instantiate = new Function('module', 'exports', 'require', javaScript);

    instantiate(mod, mod.exports, require);

    expect(mod.exports).toHaveProperty('validateBookmark');

    const validateBookmark: ValidateFunction<any> = mod.exports.validateBookmark;
    const now = new Date();

    expect(
      validateBookmark({
        url: 'https://github.com/ggoodman',
        name: 'Geoff Goodman on GitHub',
        added_at: now.toISOString(),
      }),
    ).toEqual(true);

    expect(
      validateBookmark({
        // Invalid URL here; missing scheme
        url: 'github.com/ggoodman',
        name: 'Geoff Goodman on GitHub',
        added_at: now.toISOString(),
      }),
    ).toEqual(false);

    expect(validateBookmark.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schemaPath: '#/properties/url/format',
          keyword: 'format',
          data: 'github.com/ggoodman',
          instancePath: '/url',
        }),
      ]),
    );
  });
});
