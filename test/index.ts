/// <reference types="jest" />

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
});
