import path from 'node:path';
import {
  describe,
  it,
  expect,
  vi
} from 'vitest';
import Cabinet from '../index.js';
import { fixtures } from './helpers.js';

describe('supportedFileExtensions', () => {
  it('dangles off its supported file extensions', () => {
    const cabinet = new Cabinet();
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
    const cabinet = new Cabinet();
    const tsLookup = cabinet.getLookup('.ts');
    cabinet.register('.customTs', tsLookup);

    const result = cabinet.lookup({
      partial: './foo',
      filename: fixtures('ts/index.customTs'),
      directory: fixtures('ts/')
    });
    const expected = fixtures('ts/foo.ts');

    expect(result).toBe(expected);
  });

  it('returns undefined when no lookup matches extension', () => {
    const cabinet = new Cabinet();
    const unknownLookup = cabinet.getLookup('.unknown');

    expect(unknownLookup).toBeUndefined();
  });
});

describe('register', () => {
  const customDirectory = fixtures('js/custom');

  it('registers a custom resolver for a given extension', () => {
    const cabinet = new Cabinet();
    const stub = vi.fn().mockReturnValue('foo.foobar');
    cabinet.register('.foobar', stub);

    const result = cabinet.lookup({
      partial: './bar',
      filename: 'js/custom/foo.foobar',
      directory: 'js/custom/'
    });

    expect(stub).toHaveBeenCalledOnce();
    expect(result).toBe('foo.foobar');
    cabinet.unregister('.foobar');
  });

  it('does not break default resolvers', () => {
    const cabinet = new Cabinet();
    const stylusDirectory = fixtures('stylus');
    const stub = vi.fn().mockReturnValue('foo.foobar');
    cabinet.register('.foobar', stub);

    cabinet.lookup({
      partial: './bar',
      filename: path.join(customDirectory, 'foo.foobar'),
      directory: customDirectory
    });

    const result = cabinet.lookup({
      partial: './bar',
      filename: path.join(stylusDirectory, 'foo.styl'),
      directory: stylusDirectory
    });

    expect(stub).toHaveBeenCalledOnce();
    expect(result).not.toBe('');
    cabinet.unregister('.foobar');
  });

  it('can be called multiple times', () => {
    const cabinet = new Cabinet();
    const amdDirectory = fixtures('js/amd');
    const stub = vi.fn().mockReturnValue('foo');
    const stub2 = vi.fn().mockReturnValue('foo');
    cabinet.register('.foobar', stub);
    cabinet.register('.barbar', stub2);

    cabinet.lookup({
      partial: './bar',
      filename: path.join(customDirectory, 'foo.foobar'),
      directory: amdDirectory
    });

    cabinet.lookup({
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
    const cabinet = new Cabinet();
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

describe('unregister', () => {
  it('removes a registered resolver', () => {
    const cabinet = new Cabinet();
    const stub = vi.fn().mockReturnValue('foo.foobar');
    cabinet.register('.foobar', stub);
    cabinet.unregister('.foobar');

    expect(cabinet.getLookup('.foobar')).toBeUndefined();
    expect(cabinet.supportedFileExtensions.includes('.foobar')).toBe(false);
  });
});

describe('isolation between instances', () => {
  it('registering on one instance does not affect another', () => {
    const a = new Cabinet();
    const b = new Cabinet();
    const stub = vi.fn().mockReturnValue('a.result');
    a.register('.aext', stub);

    expect(a.getLookup('.aext')).toBe(stub);
    expect(b.getLookup('.aext')).toBeUndefined();
  });

  it('unregistering a default extension on one instance does not affect another', () => {
    const a = new Cabinet();
    const b = new Cabinet();
    a.unregister('.ts');

    expect(a.getLookup('.ts')).toBeUndefined();
    expect(b.getLookup('.ts')).not.toBeUndefined();
  });

  it('each instance starts with the same default extensions', () => {
    const a = new Cabinet();
    const b = new Cabinet();

    expect(a.supportedFileExtensions.toSorted()).toStrictEqual(b.supportedFileExtensions.toSorted());
  });

  it('instance resolves files using its own registry', () => {
    const cabinet = new Cabinet();
    const tsLookup = cabinet.getLookup('.ts');
    cabinet.register('.customTs2', tsLookup);

    const result = cabinet.lookup({
      partial: './foo',
      filename: fixtures('ts/index.customTs2'),
      directory: fixtures('ts/')
    });

    expect(result).toBe(fixtures('ts/foo.ts'));
  });
});
