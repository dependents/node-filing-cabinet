'use strict';

const assert = require('assert').strict;
const path = require('path');
const sinon = require('sinon');
const Cabinet = require('../index.js');
const { fixtures } = require('./helpers.js');

describe('supportedFileExtensions', () => {
  it('dangles off its supported file extensions', () => {
    const cabinet = new Cabinet();
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
    const cabinet = new Cabinet();
    const tsLookup = cabinet.getLookup('.ts');
    cabinet.register('.customTs', tsLookup);

    const result = cabinet.lookup({
      partial: './foo',
      filename: fixtures('ts/index.customTs'),
      directory: fixtures('ts/')
    });
    const expected = fixtures('ts/foo.ts');

    assert.equal(result, expected);
  });

  it('returns undefined when no lookup matches extension', () => {
    const cabinet = new Cabinet();
    const unknownLookup = cabinet.getLookup('.unknown');

    assert.equal(unknownLookup, undefined);
  });
});

describe('register', () => {
  const customDirectory = fixtures('js/custom');

  it('registers a custom resolver for a given extension', () => {
    const cabinet = new Cabinet();
    const stub = sinon.stub().returns('foo.foobar');
    cabinet.register('.foobar', stub);

    const result = cabinet.lookup({
      partial: './bar',
      filename: 'js/custom/foo.foobar',
      directory: 'js/custom/'
    });

    assert.equal(stub.called, true);
    assert.equal(result, 'foo.foobar');
  });

  it('does not break default resolvers', () => {
    const cabinet = new Cabinet();
    const stylusDirectory = fixtures('stylus');
    const stub = sinon.stub().returns('foo.foobar');
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

    assert.equal(stub.called, true);
    assert.notEqual(result, '');
  });

  it('can be called multiple times', () => {
    const cabinet = new Cabinet();
    const amdDirectory = fixtures('js/amd');
    const stub = sinon.stub().returns('foo');
    const stub2 = sinon.stub().returns('foo');
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

    assert.equal(stub.called, true);
    assert.equal(stub2.called, true);
  });

  it('does not add redundant extensions to supportedFileExtensions', () => {
    const cabinet = new Cabinet();
    const newExt = '.foobar';
    cabinet.register(newExt, sinon.stub());
    cabinet.register(newExt, sinon.stub());

    const { supportedFileExtensions } = cabinet;
    const firstIndex = supportedFileExtensions.indexOf(newExt);
    const lastIndex = supportedFileExtensions.lastIndexOf(newExt);

    assert.equal(firstIndex, lastIndex);
  });
});

describe('unregister', () => {
  it('removes a registered resolver', () => {
    const cabinet = new Cabinet();
    const stub = sinon.stub().returns('foo.foobar');
    cabinet.register('.foobar', stub);
    cabinet.unregister('.foobar');

    assert.equal(cabinet.getLookup('.foobar'), undefined);
    assert.equal(cabinet.supportedFileExtensions.includes('.foobar'), false);
  });
});

describe('isolation between instances', () => {
  it('registering on one instance does not affect another', () => {
    const a = new Cabinet();
    const b = new Cabinet();
    const stub = sinon.stub().returns('a.result');
    a.register('.aext', stub);

    assert.equal(a.getLookup('.aext'), stub);
    assert.equal(b.getLookup('.aext'), undefined);
  });

  it('each instance starts with the same default extensions', () => {
    const a = new Cabinet();
    const b = new Cabinet();

    assert.deepEqual(a.supportedFileExtensions.sort(), b.supportedFileExtensions.sort());
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

    assert.equal(result, fixtures('ts/foo.ts'));
  });
});
