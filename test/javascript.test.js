import { strict as assert } from 'node:assert';
import path from 'node:path';
import cabinet from '../index.js';
import { fixtures } from './helpers.js';
import mockAST from './fixtures/ast.js';

describe('JavaScript', () => {
  const directory = fixtures('js/commonjs');

  it('uses a generic resolve for unsupported file extensions', () => {
    const result = cabinet({
      partial: './bar',
      filename: path.join(directory, 'foo.baz'),
      directory
    });
    const expected = path.join(directory, 'bar.baz');

    assert.equal(result, expected);
  });

  it('does not throw a runtime exception when using resolve dependency path (#71)', () => {
    assert.doesNotThrow(() => {
      cabinet({
        partial: './bar',
        filename: path.join(directory, 'foo.baz'),
        directory
      });
    });
  });

  describe('es6', () => {
    const directory = fixtures('js/es6');

    it('resolves the partial successfully when given an ast', () => {
      const result = cabinet({
        partial: './bar',
        filename: path.join(directory, 'foo.js'),
        directory,
        ast: mockAST
      });
      const expected = path.join(directory, 'bar.js');

      assert.equal(result, expected);
    });

    it('assumes commonjs for es6 modules with no requirejs/webpack config', () => {
      const result = cabinet({
        partial: './bar',
        filename: path.join(directory, 'foo.js'),
        directory
      });
      const expected = path.join(directory, 'bar.js');

      assert.equal(result, expected);
    });

    it('assumes amd for es6 modules with a requirejs config', () => {
      const result = cabinet({
        partial: './bar',
        filename: path.join(directory, 'foo.js'),
        directory,
        config: {
          baseUrl: './'
        }
      });
      const expected = path.join(directory, 'bar.js');

      assert.equal(path.normalize(result), expected);
    });

    it('does not throw for a lazy import with interpolation', () => {
      const call = () => cabinet({
        // eslint-disable-next-line no-template-curly-in-string
        partial: '`modulename/locales/${locale}`',
        filename: path.join(directory, 'lazy.js'),
        directory
      });

      assert.doesNotThrow(call);
    });

    it('does not throw for an undefined dependency', () => {
      const call = () => cabinet({
        partial: undefined,
        filename: path.join(directory, 'lazy.js'),
        directory
      });

      assert.doesNotThrow(call);
    });
  });

  describe('jsx', () => {
    const directory = fixtures('js/es6');

    it('resolves files with the .jsx extension', () => {
      const result = cabinet({
        partial: './bar',
        filename: path.join(directory, 'foo.jsx'),
        directory
      });
      const expected = path.join(directory, 'bar.js');

      assert.equal(result, expected);
    });
  });

  describe('amd', () => {
    const directory = fixtures('js/amd');

    it('uses the amd resolver', () => {
      const result = cabinet({
        partial: './bar',
        filename: path.join(directory, 'foo.js'),
        directory
      });
      const expected = path.join(directory, 'bar.js');

      assert.equal(path.normalize(result), expected);
    });

    it('passes along arguments', () => {
      const result = cabinet({
        partial: './bar',
        config: {
          baseUrl: 'js'
        },
        filename: path.join(directory, 'foo.js'),
        directory
      });
      const expected = path.join(directory, 'bar.js');

      assert.equal(path.normalize(result), expected);
    });
  });

  describe('commonjs', () => {
    it('resolves a relative partial about the filename', () => {
      const result = cabinet({
        partial: './bar',
        filename: path.join(directory, 'foo.js'),
        directory
      });
      const expected = path.join(directory, 'bar.js');

      assert.equal(result, expected);
    });

    it('returns an empty string for an unresolved module', () => {
      const result = cabinet({
        partial: 'foobar',
        filename: path.join(directory, 'foo.js'),
        directory
      });

      assert.equal(result, '');
    });

    it('resolves a .. partial to its parent directory\'s index.js file', () => {
      const result = cabinet({
        partial: '../',
        filename: path.join(directory, 'subdir/module.js'),
        directory
      });
      const expected = path.join(directory, 'index.js');

      assert.equal(result, expected);
    });

    it('resolves a partial within a directory outside of the given file', () => {
      const result = cabinet({
        partial: 'subdir',
        filename: path.join(directory, 'test/index.spec.js'),
        directory
      });
      const expected = path.join(directory, 'subdir/index.js');

      assert.equal(result, expected);
    });

    it('resolves a node module with module entry in package.json', () => {
      const result = cabinet({
        partial: 'module.entry',
        filename: path.join(directory, 'module-entry.js'),
        directory,
        nodeModulesConfig: {
          entry: 'module'
        }
      });
      const expected = fixtures('js/node_modules/module.entry/index.module.js');

      assert.equal(result, expected);
    });

    it('resolves a node module via function using pkg.exports.default', () => {
      const result = cabinet({
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

      assert.equal(result, expected);
    });

    it('resolves a nested module', () => {
      const nestedDirectory = fixtures('js/node_modules/nested');
      const result = cabinet({
        partial: 'lodash.assign',
        filename: path.join(nestedDirectory, 'index.js'),
        directory: nestedDirectory
      });
      const expected = path.join(nestedDirectory, 'node_modules/lodash.assign/index.js');

      assert.equal(result, expected);
    });

    it('resolves a nested module when directory is an ancestor of the file', () => {
      const jsDirectory = fixtures('js/');
      const nestedDirectory = path.join(jsDirectory, 'node_modules/nested');
      const result = cabinet({
        partial: 'lodash.assign',
        filename: path.join(nestedDirectory, 'index.js'),
        directory: jsDirectory
      });
      const expected = path.join(nestedDirectory, 'node_modules/lodash.assign/index.js');

      assert.equal(result, expected);
    });

    it('resolves to the index.js file of a directory', () => {
      const withIndexDirectory = fixtures('js/withIndex');
      const result = cabinet({
        partial: './subdir',
        filename: path.join(withIndexDirectory, 'index.js'),
        directory: withIndexDirectory
      });
      const expected = path.join(withIndexDirectory, 'subdir/index.js');

      assert.equal(result, expected);
    });

    it('resolves implicit .jsx requires', () => {
      const cjsDirectory = fixtures('js/cjs');
      const result = cabinet({
        partial: './bar',
        filename: path.join(cjsDirectory, 'foo.js'),
        directory: cjsDirectory
      });
      const expected = path.join(cjsDirectory, 'bar.jsx');

      assert.equal(result, expected);
    });

    it('resolves a partial require of a JSON file', () => {
      const commonjsDirectory = fixtures('js/commonjs');
      const result = cabinet({
        partial: './config',
        filename: path.join(commonjsDirectory, 'bar.js'),
        directory: commonjsDirectory
      });
      const expected = path.join(commonjsDirectory, 'config.json');

      assert.equal(result, expected);
    });
  });

  describe('package.json imports field', () => {
    const importsDir = fixtures('js/imports');
    const srcDir = path.join(importsDir, 'src/');

    it('resolves a simple #hash import', () => {
      const result = cabinet({
        partial: '#utils',
        filename: path.join(importsDir, 'src/utils.js'),
        directory: srcDir
      });
      const expected = path.join(importsDir, 'src/utils.js');

      assert.equal(result, expected);
    });

    it('resolves a wildcard #hash import', () => {
      const result = cabinet({
        partial: '#lib/button',
        filename: path.join(importsDir, 'src/utils.js'),
        directory: srcDir
      });
      const expected = path.join(importsDir, 'src/button.js');

      assert.equal(result, expected);
    });

    it('resolves a conditional #hash import (prefers import over default)', () => {
      const result = cabinet({
        partial: '#config',
        filename: path.join(importsDir, 'src/utils.js'),
        directory: srcDir
      });
      const expected = path.join(importsDir, 'src/config-esm.js');

      assert.equal(result, expected);
    });

    it('returns empty string for unresolved #hash import', () => {
      const result = cabinet({
        partial: '#nonexistent',
        filename: path.join(importsDir, 'src/utils.js'),
        directory: srcDir
      });

      assert.equal(result, '');
    });

    it('resolves a default-condition-only #hash import', () => {
      const result = cabinet({
        partial: '#config-cjs',
        filename: path.join(importsDir, 'src/utils.js'),
        directory: srcDir
      });
      const expected = path.join(importsDir, 'src/config-cjs.js');

      assert.equal(result, expected);
    });
  });
});
