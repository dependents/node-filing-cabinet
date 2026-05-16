'use strict';

const assert = require('assert').strict;
const path = require('path');
const sinon = require('sinon');
const cabinet = require('../index.js');
const { fixtures } = require('./helpers.js');

describe('supportedFileExtensions', () => {
  it('dangles off its supported file extensions', () => {
    const actual = cabinet.supportedFileExtensions.sort();
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
    ].sort();

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

describe('create', () => {
  it('returns an isolated instance', () => {
    const instance = cabinet.create();
    assert.equal(typeof instance, 'function');
  });

  it('instance has its own register/unregister/getLookup/supportedFileExtensions', () => {
    const instance = cabinet.create();
    assert.equal(typeof instance.register, 'function');
    assert.equal(typeof instance.unregister, 'function');
    assert.equal(typeof instance.getLookup, 'function');
    assert.deepEqual(instance.supportedFileExtensions, cabinet.supportedFileExtensions);
  });

  it('instance resolver does not affect the global singleton', () => {
    const instance = cabinet.create();
    const stub = sinon.stub().returns('instance.result');
    instance.register('.isolated', stub);

    assert.equal(instance.getLookup('.isolated'), stub);
    assert.equal(cabinet.getLookup('.isolated'), undefined);
    assert.equal(cabinet.supportedFileExtensions.includes('.isolated'), false);
  });

  it('global singleton changes do not affect an existing instance', () => {
    const instance = cabinet.create();
    const stub = sinon.stub().returns('global.result');
    cabinet.register('.globalonly', stub);

    assert.equal(cabinet.getLookup('.globalonly'), stub);
    assert.equal(instance.getLookup('.globalonly'), undefined);

    cabinet.unregister('.globalonly');
  });

  it('two instances are isolated from each other', () => {
    const a = cabinet.create();
    const b = cabinet.create();
    const stubA = sinon.stub().returns('a.result');
    a.register('.aext', stubA);

    assert.equal(a.getLookup('.aext'), stubA);
    assert.equal(b.getLookup('.aext'), undefined);
  });

  it('instance resolves files using its own registry', () => {
    const instance = cabinet.create();
    const tsLookup = instance.getLookup('.ts');
    instance.register('.customTs2', tsLookup);

    const result = instance({
      partial: './foo',
      filename: fixtures('ts/index.customTs2'),
      directory: fixtures('ts/')
    });

    assert.equal(result, fixtures('ts/foo.ts'));
    instance.unregister('.customTs2');
  });
});
