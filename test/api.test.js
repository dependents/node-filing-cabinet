import { strict as assert } from 'node:assert';
import path from 'node:path';
import sinon from 'sinon';
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

    assert.deepEqual(actual, expected);
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

    assert.equal(result, expected);
  });

  it('returns undefined when no lookup matches extension', () => {
    const unknownLookup = cabinet.getLookup('.unknown');

    assert.equal(unknownLookup, undefined);
  });
});

describe('register', () => {
  const customDirectory = fixtures('js/custom');

  it('registers a custom resolver for a given extension', () => {
    const stub = sinon.stub().returns('foo.foobar');
    cabinet.register('.foobar', stub);

    const result = cabinet({
      partial: './bar',
      filename: 'js/custom/foo.foobar',
      directory: 'js/custom/'
    });

    assert.equal(stub.called, true);
    assert.equal(result, 'foo.foobar');
    cabinet.unregister('.foobar');
  });

  it('does not break default resolvers', () => {
    const stylusDirectory = fixtures('stylus');
    const stub = sinon.stub().returns('foo.foobar');
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

    assert.equal(stub.called, true);
    assert.notEqual(result, '');
    cabinet.unregister('.foobar');
  });

  it('can be called multiple times', () => {
    const amdDirectory = fixtures('js/amd');
    const stub = sinon.stub().returns('foo');
    const stub2 = sinon.stub().returns('foo');
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

    assert.equal(stub.called, true);
    assert.equal(stub2.called, true);
    cabinet.unregister('.foobar');
    cabinet.unregister('.barbar');
  });

  it('does not add redundant extensions to supportedFileExtensions', () => {
    const { stub } = sinon;
    const newExt = '.foobar';
    cabinet.register(newExt, stub);
    cabinet.register(newExt, stub);

    const { supportedFileExtensions } = cabinet;
    const firstIndex = supportedFileExtensions.indexOf(newExt);
    const lastIndex = supportedFileExtensions.lastIndexOf(newExt);

    assert.equal(firstIndex, lastIndex);
  });
});
