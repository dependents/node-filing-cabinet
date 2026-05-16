import path from 'node:path';
import { describe, it, expect } from 'vitest';
import Cabinet from '../index.js';
import { fixtures } from './helpers.js';
import mockAST from './fixtures/ast.js';

const cabinet = new Cabinet();

describe('JavaScript', () => {
  const directory = fixtures('js/commonjs');

  it('uses a generic resolve for unsupported file extensions', () => {
    const result = cabinet.lookup({
      partial: './bar',
      filename: path.join(directory, 'foo.baz'),
      directory
    });
    const expected = path.join(directory, 'bar.baz');

    expect(result).toBe(expected);
  });

  it('does not throw a runtime exception when using resolve dependency path (#71)', () => {
    expect(() => {
      cabinet.lookup({
        partial: './bar',
        filename: path.join(directory, 'foo.baz'),
        directory
      });
    }).not.toThrow();
  });

  describe('es6', () => {
    const es6Directory = fixtures('js/es6');

    it('resolves the partial successfully when given an ast', () => {
      const result = cabinet.lookup({
        partial: './bar',
        filename: path.join(es6Directory, 'foo.js'),
        directory: es6Directory,
        ast: mockAST
      });
      const expected = path.join(es6Directory, 'bar.js');

      expect(result).toBe(expected);
    });

    it('assumes commonjs for es6 modules with no requirejs/webpack config', () => {
      const result = cabinet.lookup({
        partial: './bar',
        filename: path.join(es6Directory, 'foo.js'),
        directory: es6Directory
      });
      const expected = path.join(es6Directory, 'bar.js');

      expect(result).toBe(expected);
    });

    it('assumes amd for es6 modules with a requirejs config', () => {
      const result = cabinet.lookup({
        partial: './bar',
        filename: path.join(es6Directory, 'foo.js'),
        directory: es6Directory,
        config: {
          baseUrl: './'
        }
      });
      const expected = path.join(es6Directory, 'bar.js');

      expect(path.normalize(result)).toBe(expected);
    });

    it('does not throw for a lazy import with interpolation', () => {
      const call = () => cabinet.lookup({
        // eslint-disable-next-line no-template-curly-in-string
        partial: '`modulename/locales/${locale}`',
        filename: path.join(es6Directory, 'lazy.js'),
        directory: es6Directory
      });

      expect(call).not.toThrow();
    });

    it('does not throw for an undefined dependency', () => {
      const call = () => cabinet.lookup({
        partial: undefined,
        filename: path.join(es6Directory, 'lazy.js'),
        directory: es6Directory
      });

      expect(call).not.toThrow();
    });
  });

  describe('jsx', () => {
    const jsxDirectory = fixtures('js/es6');

    it('resolves files with the .jsx extension', () => {
      const result = cabinet.lookup({
        partial: './bar',
        filename: path.join(jsxDirectory, 'foo.jsx'),
        directory: jsxDirectory
      });
      const expected = path.join(jsxDirectory, 'bar.js');

      expect(result).toBe(expected);
    });
  });

  describe('amd', () => {
    const amdDirectory = fixtures('js/amd');

    it('uses the amd resolver', () => {
      const result = cabinet.lookup({
        partial: './bar',
        filename: path.join(amdDirectory, 'foo.js'),
        directory: amdDirectory
      });
      const expected = path.join(amdDirectory, 'bar.js');

      expect(path.normalize(result)).toBe(expected);
    });

    it('passes along arguments', () => {
      const result = cabinet.lookup({
        partial: './bar',
        config: {
          baseUrl: 'js'
        },
        filename: path.join(amdDirectory, 'foo.js'),
        directory: amdDirectory
      });
      const expected = path.join(amdDirectory, 'bar.js');

      expect(path.normalize(result)).toBe(expected);
    });
  });

  describe('commonjs', () => {
    it('resolves a relative partial about the filename', () => {
      const result = cabinet.lookup({
        partial: './bar',
        filename: path.join(directory, 'foo.js'),
        directory
      });
      const expected = path.join(directory, 'bar.js');

      expect(result).toBe(expected);
    });

    it('resolves a relative partial to a .mjs file', () => {
      const result = cabinet.lookup({
        partial: './esm',
        filename: path.join(directory, 'foo.js'),
        directory
      });
      const expected = path.join(directory, 'esm.mjs');

      expect(result).toBe(expected);
    });

    it('resolves a relative partial to a .cjs file', () => {
      const result = cabinet.lookup({
        partial: './cjs',
        filename: path.join(directory, 'foo.js'),
        directory
      });
      const expected = path.join(directory, 'cjs.cjs');

      expect(result).toBe(expected);
    });

    it('returns an empty string for an unresolved module', () => {
      const result = cabinet.lookup({
        partial: 'foobar',
        filename: path.join(directory, 'foo.js'),
        directory
      });

      expect(result).toBe('');
    });

    it('resolves a .. partial to its parent directory\'s index.js file', () => {
      const result = cabinet.lookup({
        partial: '../',
        filename: path.join(directory, 'subdir/module.js'),
        directory
      });
      const expected = path.join(directory, 'index.js');

      expect(result).toBe(expected);
    });

    it('resolves a partial within a directory outside of the given file', () => {
      const result = cabinet.lookup({
        partial: 'subdir',
        filename: path.join(directory, 'test/index.spec.js'),
        directory
      });
      const expected = path.join(directory, 'subdir/index.js');

      expect(result).toBe(expected);
    });

    it('resolves a node module with module entry in package.json', () => {
      const result = cabinet.lookup({
        partial: 'module.entry',
        filename: path.join(directory, 'module-entry.js'),
        directory,
        nodeModulesConfig: {
          entry: 'module'
        }
      });
      const expected = fixtures('js/node_modules/module.entry/index.module.js');

      expect(result).toBe(expected);
    });

    it('resolves a node module via function using pkg.exports.default', () => {
      const result = cabinet.lookup({
        partial: 'exports.default',
        filename: path.join(directory, 'exports-default.js'),
        directory,
        nodeModulesConfig(pkg) {
          // Map conditional to main via exports.default
          if (pkg && pkg.exports && pkg.exports.default) {
            pkg.main = pkg.exports.default;
          }

          return pkg;
        }
      });
      const expected = fixtures('js/node_modules/exports.default/index.default.js');

      expect(result).toBe(expected);
    });

    it('resolves a nested module', () => {
      const nestedDirectory = fixtures('js/node_modules/nested');
      const result = cabinet.lookup({
        partial: 'lodash.assign',
        filename: path.join(nestedDirectory, 'index.js'),
        directory: nestedDirectory
      });
      const expected = path.join(nestedDirectory, 'node_modules/lodash.assign/index.js');

      expect(result).toBe(expected);
    });

    it('resolves a nested module when directory is an ancestor of the file', () => {
      const jsDirectory = fixtures('js/');
      const nestedDirectory = path.join(jsDirectory, 'node_modules/nested');
      const result = cabinet.lookup({
        partial: 'lodash.assign',
        filename: path.join(nestedDirectory, 'index.js'),
        directory: jsDirectory
      });
      const expected = path.join(nestedDirectory, 'node_modules/lodash.assign/index.js');

      expect(result).toBe(expected);
    });

    it('resolves to the index.js file of a directory', () => {
      const withIndexDirectory = fixtures('js/withIndex');
      const result = cabinet.lookup({
        partial: './subdir',
        filename: path.join(withIndexDirectory, 'index.js'),
        directory: withIndexDirectory
      });
      const expected = path.join(withIndexDirectory, 'subdir/index.js');

      expect(result).toBe(expected);
    });

    it('resolves implicit .jsx requires', () => {
      const cjsDirectory = fixtures('js/cjs');
      const result = cabinet.lookup({
        partial: './bar',
        filename: path.join(cjsDirectory, 'foo.js'),
        directory: cjsDirectory
      });
      const expected = path.join(cjsDirectory, 'bar.jsx');

      expect(result).toBe(expected);
    });

    it('resolves a partial require of a JSON file', () => {
      const commonjsDirectory = fixtures('js/commonjs');
      const result = cabinet.lookup({
        partial: './config',
        filename: path.join(commonjsDirectory, 'bar.js'),
        directory: commonjsDirectory
      });
      const expected = path.join(commonjsDirectory, 'config.json');

      expect(result).toBe(expected);
    });
  });

  describe('package.json imports field', () => {
    const importsDir = fixtures('js/imports');
    const srcDir = path.join(importsDir, 'src/');

    it('resolves a simple #hash import', () => {
      const result = cabinet.lookup({
        partial: '#utils',
        filename: path.join(importsDir, 'src/utils.js'),
        directory: srcDir
      });
      const expected = path.join(importsDir, 'src/utils.js');

      expect(result).toBe(expected);
    });

    it('resolves a wildcard #hash import', () => {
      const result = cabinet.lookup({
        partial: '#lib/button',
        filename: path.join(importsDir, 'src/utils.js'),
        directory: srcDir
      });
      const expected = path.join(importsDir, 'src/button.js');

      expect(result).toBe(expected);
    });

    it('resolves a conditional #hash import (prefers import over default)', () => {
      const result = cabinet.lookup({
        partial: '#config',
        filename: path.join(importsDir, 'src/utils.js'),
        directory: srcDir
      });
      const expected = path.join(importsDir, 'src/config-esm.js');

      expect(result).toBe(expected);
    });

    it('returns empty string for unresolved #hash import', () => {
      const result = cabinet.lookup({
        partial: '#nonexistent',
        filename: path.join(importsDir, 'src/utils.js'),
        directory: srcDir
      });

      expect(result).toBe('');
    });

    it('resolves a default-condition-only #hash import', () => {
      const result = cabinet.lookup({
        partial: '#config-cjs',
        filename: path.join(importsDir, 'src/utils.js'),
        directory: srcDir
      });
      const expected = path.join(importsDir, 'src/config-cjs.js');

      expect(result).toBe(expected);
    });
  });
});
