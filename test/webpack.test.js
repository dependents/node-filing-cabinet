import path from 'node:path';
import { describe, it, expect } from 'vitest';
import Cabinet from '../index.js';
import { fixtures } from './helpers.js';

const directory = fixtures('webpack');
const cabinet = new Cabinet();

describe('webpack', () => {
  it('resolves an aliased path', () => {
    const result = cabinet.lookup({
      partial: 'R',
      filename: path.join(directory, 'index.js'),
      directory,
      webpackConfig: path.join(directory, 'webpack.config.js')
    });
    const expected = path.join(directory, 'node_modules/resolve/index.js');

    expect(result).toBe(expected);
  });

  it('resolves a non-aliased path', () => {
    const result = cabinet.lookup({
      partial: 'resolve',
      filename: path.join(directory, 'index.js'),
      directory,
      webpackConfig: path.join(directory, 'webpack.config.js')
    });
    const expected = path.join(directory, 'node_modules/resolve/index.js');

    expect(result).toBe(expected);
  });

  it('resolves a relative path', () => {
    const result = cabinet.lookup({
      partial: './test/ast',
      filename: path.join(directory, 'index.js'),
      directory,
      webpackConfig: path.join(directory, 'webpack.config.js')
    });
    const expected = path.join(directory, 'test/ast.js');

    expect(result).toBe(expected);
  });

  it('resolves an absolute path from a file within a subdirectory', () => {
    const result = cabinet.lookup({
      partial: 'R',
      filename: path.join(directory, 'test/ast.js'),
      directory,
      webpackConfig: path.join(directory, 'webpack.config.js')
    });
    const expected = path.join(directory, 'node_modules/resolve/index.js');

    expect(result).toBe(expected);
  });

  it('resolves a path using resolve.root that value is array', () => {
    const result = cabinet.lookup({
      partial: 'mod1',
      filename: path.join(directory, 'index.js'),
      directory,
      webpackConfig: path.join(directory, 'webpack-root.config.js')
    });
    const expected = path.join(directory, 'test/root1/mod1.js');

    expect(result).toBe(expected);
  });

  it('resolves a path using resolve.root that value is string', () => {
    const result = cabinet.lookup({
      partial: 'mod2',
      filename: path.join(directory, 'index.js'),
      directory,
      webpackConfig: path.join(directory, 'webpack-root-string.config.js')
    });
    const expected = path.join(directory, 'test/root2/mod2.js');

    expect(result).toBe(expected);
  });

  it('resolves a path using resolve.roots', () => {
    const result = cabinet.lookup({
      partial: 'mod2',
      filename: path.join(directory, 'index.js'),
      directory,
      webpackConfig: path.join(directory, 'webpack-roots.config.js')
    });
    const expected = path.join(directory, 'test/root2/mod2.js');

    expect(result).toBe(expected);
  });

  it('resolves npm module when using resolve.root', () => {
    const result = cabinet.lookup({
      partial: 'resolve',
      filename: path.join(directory, 'index.js'),
      directory,
      webpackConfig: path.join(directory, 'webpack-root.config.js')
    });
    const expected = path.join(directory, 'node_modules/resolve/index.js');

    expect(result).toBe(expected);
  });

  it('resolves a path using resolve.modulesDirectories', () => {
    const result = cabinet.lookup({
      partial: 'mod2',
      filename: path.join(directory, 'index.js'),
      directory,
      webpackConfig: path.join(directory, 'webpack-root.config.js')
    });
    const expected = path.join(directory, 'test/root2/mod2.js');

    expect(result).toBe(expected);
  });

  it('resolves a path using webpack config that exports a function', () => {
    const result = cabinet.lookup({
      partial: 'R',
      filename: path.join(directory, 'index.js'),
      directory,
      webpackConfig: path.join(directory, 'webpack-env.config.js')
    });
    const expected = path.join(directory, 'node_modules/resolve/index.js');

    expect(result).toBe(expected);
  });

  it('resolves a path using a first configuration', () => {
    const result = cabinet.lookup({
      partial: 'mod1',
      filename: path.join(directory, 'index.js'),
      directory,
      webpackConfig: path.join(directory, 'webpack-multiple.config.js')
    });
    const expected = path.join(directory, 'test/root1/mod1.js');

    expect(result).toBe(expected);
  });

  it('resolves files with a .jsx extension', () => {
    const result = cabinet.lookup({
      partial: './test/foo.jsx',
      filename: path.join(directory, 'index.js'),
      directory,
      webpackConfig: path.join(directory, 'webpack.config.js')
    });
    const expected = path.join(directory, 'test/foo.jsx');

    expect(result).toBe(expected);
  });

  it('still works when the partial contains a loader', () => {
    const result = cabinet.lookup({
      partial: 'hgn!resolve',
      filename: path.join(directory, 'index.js'),
      directory,
      webpackConfig: path.join(directory, 'webpack.config.js')
    });
    const expected = path.join(directory, 'node_modules/resolve/index.js');

    expect(result).toBe(expected);
  });

  it('resolves files with a .ts extension', () => {
    const result = cabinet.lookup({
      partial: 'R',
      filename: path.join(directory, 'index.ts'),
      directory,
      webpackConfig: path.join(directory, 'webpack.config.js')
    });
    const expected = path.join(directory, 'node_modules/resolve/index.js');

    expect(result).toBe(expected);
  });

  it('returns empty string when the webpack config exports a Promise', () => {
    const result = cabinet.lookup({
      partial: './test/ast',
      filename: path.join(directory, 'index.js'),
      directory,
      webpackConfig: path.join(directory, 'webpack-promise.config.js')
    });

    expect(result).toBe('');
  });

  it('returns empty string when the webpack config cannot be loaded', () => {
    const result = cabinet.lookup({
      partial: './foo',
      filename: path.join(directory, 'index.js'),
      directory,
      webpackConfig: path.join(directory, 'nonexistent-webpack.config.js')
    });

    expect(result).toBe('');
  });

  it('returns empty string when the dependency cannot be resolved by webpack', () => {
    const result = cabinet.lookup({
      partial: 'this-module-xyz-does-not-exist',
      filename: path.join(directory, 'index.js'),
      directory,
      webpackConfig: path.join(directory, 'webpack.config.js')
    });

    expect(result).toBe('');
  });

  it('returns the same result on repeated lookups against the same webpack config', () => {
    const options = {
      partial: 'R',
      filename: path.join(directory, 'index.js'),
      directory,
      webpackConfig: path.join(directory, 'webpack.config.js')
    };
    const expected = path.join(directory, 'node_modules/resolve/index.js');

    expect(cabinet.lookup(options)).toBe(expected);
    expect(cabinet.lookup(options)).toBe(expected);
  });
});
