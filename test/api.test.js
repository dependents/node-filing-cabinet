import path from 'node:path';
import {
  describe,
  it,
  expect,
  vi
} from 'vitest';
import cabinet from '../index.js';
import { fixtures } from './helpers.js';

describe('supportedFileExtensions', () => {
  it('dangles off its supported file extensions', () => {
    const actual = cabinet.supportedFileExtensions.toSorted();
    const expected = [
      '.js',
      '.jsx',
      '.less',
      '.sass',
      '.scss',
      '.styl',
      '.svelte',
      '.ts',
      '.tsx',
      '.vue'
    ].toSorted();

    expect(actual).toStrictEqual(expected);
  });
});

describe('getLookup', () => {
  it('returns a lookup by extension', () => {
    const tsLookup = cabinet.getLookup('.ts');
    cabinet.register('.customTs', tsLookup);

    const result = cabinet({
      partial: './foo',
      filename: fixtures('ts/index.customTs'),
      directory: fixtures('ts/')
    });
    const expected = fixtures('ts/foo.ts');

    expect(result).toBe(expected);
  });

  it('returns undefined when no lookup matches extension', () => {
    const unknownLookup = cabinet.getLookup('.unknown');

    expect(unknownLookup).toBeUndefined();
  });
});

describe('register', () => {
  const customDirectory = fixtures('js/custom');

  it('registers a custom resolver for a given extension', () => {
    const stub = vi.fn().mockReturnValue('foo.foobar');
    cabinet.register('.foobar', stub);

    const result = cabinet({
      partial: './bar',
      filename: 'js/custom/foo.foobar',
      directory: 'js/custom/'
    });

    expect(stub).toHaveBeenCalledOnce();
    expect(result).toBe('foo.foobar');
    cabinet.unregister('.foobar');
  });

  it('does not break default resolvers', () => {
    const stylusDirectory = fixtures('stylus');
    const stub = vi.fn().mockReturnValue('foo.foobar');
    cabinet.register('.foobar', stub);

    cabinet({
      partial: './bar',
      filename: path.join(customDirectory, 'foo.foobar'),
      directory: customDirectory
    });

    const result = cabinet({
      partial: './bar',
      filename: path.join(stylusDirectory, 'foo.styl'),
      directory: stylusDirectory
    });

    expect(stub).toHaveBeenCalledOnce();
    expect(result).not.toBe('');
    cabinet.unregister('.foobar');
  });

  it('can be called multiple times', () => {
    const amdDirectory = fixtures('js/amd');
    const stub = vi.fn().mockReturnValue('foo');
    const stub2 = vi.fn().mockReturnValue('foo');
    cabinet.register('.foobar', stub);
    cabinet.register('.barbar', stub2);

    cabinet({
      partial: './bar',
      filename: path.join(customDirectory, 'foo.foobar'),
      directory: amdDirectory
    });

    cabinet({
      partial: './bar',
      filename: path.join(customDirectory, 'foo.barbar'),
      directory: customDirectory
    });

    expect(stub).toHaveBeenCalledOnce();
    expect(stub2).toHaveBeenCalledOnce();
    cabinet.unregister('.foobar');
    cabinet.unregister('.barbar');
  });

  it('does not add redundant extensions to supportedFileExtensions', () => {
    const stub = vi.fn();
    const newExt = '.foobar';
    cabinet.register(newExt, stub);
    cabinet.register(newExt, stub);

    const { supportedFileExtensions } = cabinet;
    const firstIndex = supportedFileExtensions.indexOf(newExt);
    const lastIndex = supportedFileExtensions.lastIndexOf(newExt);

    expect(firstIndex).toBe(lastIndex);
  });
});
