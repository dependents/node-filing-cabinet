/* eslint-env mocha */

'use strict';

const assert = require('assert').strict;
const { readFile } = require('fs/promises');
const path = require('path');
const sinon = require('sinon');
const cabinet = require('../index.js');
const mockAST = require('./fixtures/ast.js');

const fixtures = (...parts) => path.join(__dirname, 'fixtures', ...parts);

describe('filing-cabinet', () => {
  describe('JavaScript', () => {
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

    it('uses a generic resolve for unsupported file extensions', () => {
      const result = cabinet({
        partial: './bar',
        filename: fixtures('js/commonjs/foo.baz'),
        directory: fixtures('js/commonjs/')
      });
      const expected = fixtures('js/commonjs/bar.baz');
      assert.equal(result, expected);
    });

    it('does not throw a runtime exception when using resolve dependency path (#71)', () => {
      assert.doesNotThrow(() => {
        cabinet({
          partial: './bar',
          filename: fixtures('js/commonjs/foo.baz'),
          directory: fixtures('js/commonjs/')
        });
      });
    });

    it('resolves the partial successfully when given an ast', () => {
      const result = cabinet({
        partial: './bar',
        filename: fixtures('js/es6/foo.js'),
        directory: fixtures('js/es6/'),
        ast: mockAST
      });
      const expected = fixtures('js/es6/bar.js');
      assert.equal(result, expected);
    });

    describe('es6', () => {
      it('assumes commonjs for es6 modules with no requirejs/webpack config', () => {
        const result = cabinet({
          partial: './bar',
          filename: fixtures('js/es6/foo.js'),
          directory: fixtures('js/es6/')
        });
        const expected = fixtures('js/es6/bar.js');
        assert.equal(result, expected);
      });

      it('assumes amd for es6 modules with a requirejs config', () => {
        const result = cabinet({
          partial: './bar',
          filename: fixtures('js/es6/foo.js'),
          directory: fixtures('js/es6/'),
          config: {
            baseUrl: './'
          }
        });
        const expected = fixtures('js/es6/bar.js');
        assert.equal(path.normalize(result), expected);
      });

      it('does not throw for a lazy import with interpolation', () => {
        const call = () => cabinet({
          // eslint-disable-next-line no-template-curly-in-string
          partial: '`modulename/locales/${locale}`',
          filename: fixtures('js/es6/lazy.js'),
          directory: fixtures('js/es6/')
        });
        assert.doesNotThrow(call);
      });

      it('does not throw for an undefined dependency', () => {
        const call = () => cabinet({
          partial: undefined,
          filename: fixtures('js/es6/lazy.js'),
          directory: fixtures('js/es6/')
        });
        assert.doesNotThrow(call);
      });
    });

    describe('jsx', () => {
      it('resolves files with the .jsx extension', () => {
        const result = cabinet({
          partial: './bar',
          filename: fixtures('js/es6/foo.jsx'),
          directory: fixtures('js/es6/')
        });
        const expected = fixtures('js/es6/bar.js');
        assert.equal(result, expected);
      });
    });

    describe('amd', () => {
      it('uses the amd resolver', () => {
        const result = cabinet({
          partial: './bar',
          filename: fixtures('js/amd/foo.js'),
          directory: fixtures('js/amd/')
        });
        const expected = fixtures('js/amd/bar.js');
        assert.equal(path.normalize(result), expected);
      });

      it('passes along arguments', () => {
        const result = cabinet({
          partial: './bar',
          config: {
            baseUrl: 'js'
          },
          filename: fixtures('js/amd/foo.js'),
          directory: fixtures('js/amd/')
        });
        const expected = fixtures('js/amd/bar.js');
        assert.equal(path.normalize(result), expected);
      });
    });

    describe('commonjs', () => {
      it('resolves a relative partial about the filename', () => {
        const result = cabinet({
          partial: './bar',
          filename: fixtures('js/commonjs/foo.js'),
          directory: fixtures('js/commonjs/')
        });
        const expected = fixtures('js/commonjs/bar.js');
        assert.equal(result, expected);
      });

      it('returns an empty string for an unresolved module', () => {
        const result = cabinet({
          partial: 'foobar',
          filename: fixtures('js/commonjs/foo.js'),
          directory: fixtures('js/commonjs/')
        });
        assert.equal(result, '');
      });

      it('resolves a .. partial to its parent directory\'s index.js file', () => {
        const result = cabinet({
          partial: '../',
          filename: fixtures('js/commonjs/subdir/module.js'),
          directory: fixtures('js/commonjs/')
        });
        const expected = fixtures('js/commonjs/index.js');
        assert.equal(result, expected);
      });

      it('resolves a partial within a directory outside of the given file', () => {
        const result = cabinet({
          partial: 'subdir',
          filename: fixtures('js/commonjs/test/index.spec.js'),
          directory: fixtures('js/commonjs/')
        });
        const expected = fixtures('js/commonjs/subdir/index.js');
        assert.equal(result, expected);
      });

      it('resolves a node module with module entry in package.json', () => {
        const result = cabinet({
          partial: 'module.entry',
          filename: fixtures('js/commonjs/module-entry.js'),
          directory: fixtures('js/commonjs/'),
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
          filename: fixtures('js/commonjs/exports-default.js'),
          directory: fixtures('js/commonjs/'),
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
        const result = cabinet({
          partial: 'lodash.assign',
          filename: fixtures('js/node_modules/nested/index.js'),
          directory: fixtures('js/node_modules/nested/')
        });
        const expected = fixtures('js/node_modules/nested/node_modules/lodash.assign/index.js');
        assert.equal(result, expected);
      });

      it('resolves to the index.js file of a directory', () => {
        const result = cabinet({
          partial: './subdir',
          filename: fixtures('js/withIndex/index.js'),
          directory: fixtures('js/withIndex')
        });
        const expected = fixtures('js/withIndex/subdir/index.js');
        assert.equal(result, expected);
      });

      it('resolves implicit .jsx requires', () => {
        const result = cabinet({
          partial: './bar',
          filename: fixtures('js/cjs/foo.js'),
          directory: fixtures('js/cjs/')
        });
        const expected = fixtures('js/cjs/bar.jsx');
        assert.equal(result, expected);
      });
    });

    describe('package.json imports field', () => {
      const importsDir = fixtures('js/imports');

      it('resolves a simple #hash import', () => {
        const result = cabinet({
          partial: '#utils',
          filename: path.join(importsDir, 'src/utils.js'),
          directory: path.join(importsDir, 'src/')
        });
        assert.equal(result, path.join(importsDir, 'src/utils.js'));
      });

      it('resolves a wildcard #hash import', () => {
        const result = cabinet({
          partial: '#lib/button',
          filename: path.join(importsDir, 'src/utils.js'),
          directory: path.join(importsDir, 'src/')
        });
        assert.equal(result, path.join(importsDir, 'src/button.js'));
      });

      it('resolves a conditional #hash import (prefers import over default)', () => {
        const result = cabinet({
          partial: '#config',
          filename: path.join(importsDir, 'src/utils.js'),
          directory: path.join(importsDir, 'src/')
        });
        assert.equal(result, path.join(importsDir, 'src/config-esm.js'));
      });

      it('returns empty string for unresolved #hash import', () => {
        const result = cabinet({
          partial: '#nonexistent',
          filename: path.join(importsDir, 'src/utils.js'),
          directory: path.join(importsDir, 'src/')
        });
        assert.equal(result, '');
      });

      it('resolves a default-condition-only #hash import', () => {
        const result = cabinet({
          partial: '#config-cjs',
          filename: path.join(importsDir, 'src/utils.js'),
          directory: path.join(importsDir, 'src/')
        });
        assert.equal(result, path.join(importsDir, 'src/config-cjs.js'));
      });
    });
  });

  describe('TypeScript', () => {
    const directory = fixtures('ts');

    it('resolves an import', () => {
      const result = cabinet({
        partial: './foo',
        filename: path.join(directory, 'index.ts'),
        directory
      });
      const expected = path.join(directory, 'foo.ts');
      assert.equal(result, expected);
    });

    it('resolves the import within a tsx file', () => {
      const result = cabinet({
        partial: './foo',
        filename: path.join(directory, 'module.tsx'),
        directory
      });
      const expected = path.join(directory, 'foo.ts');
      assert.equal(result, expected);
    });

    it('resolves the import of a file with type-definition', () => {
      const result = cabinet({
        partial: './withTypeDef',
        filename: path.join(directory, 'index.ts'),
        directory
      });
      const expected = path.join(directory, 'withTypeDef.d.ts');
      assert.equal(result, expected);
    });

    it('returns an empty result for a non-existent partial', () => {
      const result = cabinet({
        partial: './barbar',
        filename: path.join(directory, 'index.ts'),
        directory
      });
      assert.equal(result, '');
    });

    it('resolves the module with both tsconfig and webpack config', () => {
      const result = cabinet({
        partial: './subdir',
        filename: path.join(directory, 'check-nested.ts'),
        directory,
        tsConfig: path.join(directory, '.tsconfigExtending'),
        webpackConfig: path.join(directory, 'webpack.config.js')
      });
      const expected = path.join(directory, 'subdir/index.tsx');
      assert.equal(result, expected);
    });

    describe('noTypeDefinitions', () => {
      it('resolves the import of a file with type-definition to the JS file', () => {
        const result = cabinet({
          partial: './withTypeDef',
          filename: path.join(directory, '/index.ts'),
          directory,
          noTypeDefinitions: true
        });
        const expected = path.join(directory, 'withTypeDef.js');
        assert.equal(result, expected);
      });

      it('resolves the import of a file with type-definition to the JS file using custom import paths', () => {
        const result = cabinet({
          partial: '@test/withTypeDef',
          filename: path.join(directory, './index.ts'),
          directory,
          tsConfig: {
            compilerOptions: {
              allowJs: true,
              moduleResolution: 'node',
              baseUrl: directory,
              paths: {
                '@test/*': ['*']
              }
            }
          },
          noTypeDefinitions: true
        });
        const expected = path.join(directory, 'withTypeDef.js');
        assert.equal(result, expected);
      });

      it('still returns the .d.ts file if no JS file is found', () => {
        const result = cabinet({
          partial: './withOnlyTypeDef.d.ts',
          filename: path.join(directory, '/index.ts'),
          directory,
          noTypeDefinitions: true
        });
        const expected = path.join(directory, 'withOnlyTypeDef.d.ts');
        assert.equal(result, expected);
      });

      it('strips only the trailing extension when a parent directory name also contains .d.ts', () => {
        const result = cabinet({
          partial: './dirWithDts.d.ts/inner',
          filename: path.join(directory, '/index.ts'),
          directory,
          noTypeDefinitions: true
        });
        const expected = path.join(directory, 'dirWithDts.d.ts/inner.js');
        assert.equal(result, expected);
      });
    });

    describe('tsconfig', () => {
      it('resolves the module name with tsconfig as an object', async() => {
        const tsConfigPath = path.join(directory, '.tsconfig');
        const configContent = await readFile(tsConfigPath, 'utf8');
        const parsedConfig = JSON.parse(configContent);
        const result = cabinet({
          partial: './foo',
          filename: path.join(directory, 'index.ts'),
          directory,
          tsConfig: parsedConfig
        });
        const expected = path.join(directory, 'foo.ts');
        assert.equal(result, expected);
      });

      it('finds import from child subdirectories when using node module resolution', () => {
        const result = cabinet({
          partial: './subdir',
          filename: path.join(directory, 'check-nested.ts'),
          directory,
          tsConfig: {
            compilerOptions: {
              module: 'commonjs',
              moduleResolution: 'node'
            }
          }
        });
        const expected = path.join(directory, '/subdir/index.tsx');
        assert.equal(result, expected);
      });

      it('finds import from child subdirectories when using node module resolution in extended config', () => {
        const result = cabinet({
          partial: './subdir',
          filename: path.join(directory, 'check-nested.ts'),
          directory,
          tsConfig: path.join(directory, '.tsconfigExtending')
        });
        const expected = path.join(directory, '/subdir/index.tsx');
        assert.equal(result, expected);
      });

      it('finds imports of non-typescript files', () => {
        const result = cabinet({
          partial: './image.svg',
          filename: path.join(directory, '/index.ts'),
          directory
        });
        const expected = path.join(directory, '/image.svg');
        assert.equal(result, expected);
      });

      it('finds imports of non-existent typescript imports', () => {
        const result = cabinet({
          partial: 'virtual:test-virtual',
          filename: path.join(directory, '/index.ts'),
          directory
        });
        assert.equal(result, '');
      });

      it('finds imports of non-typescript files using custom import paths', () => {
        const result = cabinet({
          partial: '@shortcut/subimage.svg',
          filename: path.join(directory, '/index.ts'),
          directory,
          tsConfig: {
            compilerOptions: {
              moduleResolution: 'node',
              baseUrl: directory,
              paths: {
                '@shortcut/*': ['subdir/*']
              }
            }
          }
        });
        const expected = path.join(directory, 'subdir/subimage.svg');
        assert.equal(result, expected);
      });

      it('finds imports of non-typescript files from node_modules', () => {
        const result = cabinet({
          partial: 'image/npm-image.svg',
          filename: path.join(directory, 'index.ts'),
          directory,
          tsConfig: {
            compilerOptions: {
              moduleResolution: 'node'
            }
          }
        });
        const expected = path.join(directory, 'node_modules/image/npm-image.svg');
        assert.equal(result, expected);
      });

      it('finds imports of typescript files from non-typescript files with allowJs option (#89)', () => {
        const result = cabinet({
          partial: './foo',
          filename: path.join(directory, '/bar.js'),
          directory,
          tsConfig: {
            compilerOptions: {
              allowJs: true
            }
          }
        });
        const expected = path.join(directory, '/foo.ts');
        assert.equal(result, expected);
      });

      it('finds imports using custom import paths from javascript files with allowJs option', () => {
        const result = cabinet({
          partial: '@shortcut/subimage.svg',
          filename: path.join(directory, '/bar.js'),
          directory,
          tsConfig: {
            compilerOptions: {
              allowJs: true,
              moduleResolution: 'node',
              baseUrl: directory,
              paths: {
                '@shortcut/*': ['subdir/*']
              }
            }
          }
        });
        const expected = path.join(directory, 'subdir/subimage.svg');
        assert.equal(result, expected);
      });

      it('returns empty string and extends to ts extensions when allowJs module is not found by typescript', () => {
        const result = cabinet({
          partial: './nonexistent-module',
          filename: path.join(directory, '/bar.js'),
          directory,
          tsConfig: {
            compilerOptions: {
              allowJs: true
            }
          }
        });
        assert.equal(result, '');
      });

      it('parses the tsconfig given as a string path', () => {
        const result = cabinet({
          partial: './foo',
          filename: path.join(directory, 'index.ts'),
          directory,
          tsConfig: path.join(directory, '.tsconfig')
        });
        const expected = path.join(directory, 'foo.ts');
        assert.equal(result, expected);
      });

      it('throws when the tsconfig file cannot be read', () => {
        assert.throws(() => {
          cabinet({
            partial: './foo',
            filename: path.join(directory, 'index.ts'),
            directory,
            tsConfig: path.join(directory, 'nonexistent-tsconfig.json')
          });
        }, /could not read tsconfig/);
      });

      it('returns consistent results on repeated TypeScript lookups', () => {
        const options = {
          partial: './foo',
          filename: path.join(directory, 'index.ts'),
          directory,
          tsConfig: path.join(directory, '.tsconfig')
        };
        const expected = path.join(directory, 'foo.ts');

        assert.equal(cabinet(options), expected);
        assert.equal(cabinet(options), expected);
      });
    });

    describe('path mapping', () => {
      it('resolves a path using TypeScript path mapping', () => {
        const result = cabinet({
          partial: '#foo/hello',
          filename: path.resolve(__dirname, 'fixtures/root3/packages/foo/index.ts'),
          directory: path.resolve(__dirname, 'fixtures/root3'),
          tsConfig: {
            compilerOptions: {
              rootDir: '.',
              baseUrl: 'packages',
              paths: {
                '@monorepo/*': ['*'],
                '#foo/*': ['foo/*'],
                '#bar/*': ['bar/*'],
                '#*': ['*']
              }
            }
          },
          tsConfigPath: path.resolve(__dirname, 'fixtures/root3/tsconfig.json')
        });
        const expected = path.resolve(__dirname, 'fixtures/root3/packages/foo/hello.ts');
        assert.equal(result, expected);
      });

      it('resolves a file import with explicit extension via path mapping using pre-parsed options object', () => {
        const root3Dir = path.resolve(__dirname, 'fixtures/root3');
        const result = cabinet({
          partial: '@monorepo/foo/hello.ts',
          filename: path.resolve(root3Dir, 'packages/bar/index.ts'),
          directory: root3Dir,
          tsConfig: {
            options: {
              baseUrl: 'packages',
              paths: {
                '@monorepo/*': ['*']
              }
            }
          },
          tsConfigPath: path.resolve(root3Dir, 'tsconfig.json')
        });
        const expected = path.resolve(root3Dir, 'packages/foo/hello.ts');
        assert.equal(result, expected);
      });

      it('resolves a directory import via path mapping to its index file', () => {
        const root3Dir = path.resolve(__dirname, 'fixtures/root3');
        const result = cabinet({
          partial: '@monorepo/foo',
          filename: path.resolve(root3Dir, 'packages/bar/index.ts'),
          directory: root3Dir,
          tsConfig: {
            options: {
              baseUrl: 'packages',
              paths: {
                '@monorepo/*': ['*']
              }
            }
          },
          tsConfigPath: path.resolve(root3Dir, 'tsconfig.json')
        });
        const expected = path.resolve(root3Dir, 'packages/foo/index.ts');
        assert.equal(result, expected);
      });

      describe('package.json imports field', () => {
        const importsDir = fixtures('ts/imports');

        it('resolves a simple #hash import from a .ts file', () => {
          const result = cabinet({
            partial: '#utils',
            filename: path.join(importsDir, 'src/utils.ts'),
            directory: importsDir
          });
          assert.equal(result, path.join(importsDir, 'src/utils.ts'));
        });

        it('resolves a wildcard #hash import to a .tsx file', () => {
          const result = cabinet({
            partial: '#lib/button',
            filename: path.join(importsDir, 'src/utils.ts'),
            directory: importsDir
          });
          assert.equal(result, path.join(importsDir, 'src/button.tsx'));
        });

        it('resolves a conditional #hash import (prefers import over default)', () => {
          const result = cabinet({
            partial: '#config',
            filename: path.join(importsDir, 'src/utils.ts'),
            directory: importsDir
          });
          assert.equal(result, path.join(importsDir, 'src/config-esm.ts'));
        });

        it('returns empty string for unresolved #hash import', () => {
          const result = cabinet({
            partial: '#nonexistent',
            filename: path.join(importsDir, 'src/utils.ts'),
            directory: importsDir
          });
          assert.equal(result, '');
        });
      });
    });
  });

  describe('CSS', () => {
    describe('less', () => {
      it('resolves extensionless partials', () => {
        const result = cabinet({
          partial: 'bar',
          filename: fixtures('less/foo.less'),
          directory: fixtures('less/')
        });
        const expected = fixtures('less/bar.less');
        assert.equal(result, expected);
      });

      it('resolves partials with a less extension', () => {
        const result = cabinet({
          partial: 'bar.less',
          filename: fixtures('less/foo.less'),
          directory: fixtures('less/')
        });
        const expected = fixtures('less/bar.less');
        assert.equal(result, expected);
      });

      it('resolves partials with a css extension', () => {
        const result = cabinet({
          partial: 'bar.css',
          filename: fixtures('less/foo.less'),
          directory: fixtures('less/')
        });
        const expected = fixtures('less/bar.css');
        assert.equal(result, expected);
      });
    });

    describe('sass', () => {
      it('uses the sass resolver for .sass files', () => {
        const result = cabinet({
          partial: 'bar',
          filename: fixtures('sass/foo.sass'),
          directory: fixtures('sass/')
        });
        const expected = fixtures('sass/bar.sass');
        assert.equal(result, expected);
      });

      it('uses the sass resolver for .scss files', () => {
        const result = cabinet({
          partial: 'bar',
          filename: fixtures('sass/foo.scss'),
          directory: fixtures('sass/')
        });
        const expected = fixtures('sass/bar.scss');
        assert.equal(result, expected);
      });
    });

    describe('stylus', () => {
      it('uses the stylus resolver', () => {
        const result = cabinet({
          partial: 'bar',
          filename: fixtures('stylus/foo.styl'),
          directory: fixtures('stylus/')
        });
        const expected = fixtures('stylus/bar.styl');
        assert.equal(result, expected);
      });
    });
  });

  describe('.getLookup', () => {
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

  describe('.register', () => {
    it('registers a custom resolver for a given extension', () => {
      const stub = sinon.stub().returns('foo.foobar');
      cabinet.register('.foobar', stub);

      const expectedPath = cabinet({
        partial: './bar',
        filename: 'js/custom/foo.foobar',
        directory: 'js/custom/'
      });

      assert.ok(stub.called);
      assert.equal(expectedPath, 'foo.foobar');
      cabinet.unregister('.foobar');
    });

    it('does not break default resolvers', () => {
      const stub = sinon.stub().returns('foo.foobar');
      cabinet.register('.foobar', stub);

      cabinet({
        partial: './bar',
        filename: fixtures('js/custom/foo.foobar'),
        directory: fixtures('js/custom/')
      });

      const result = cabinet({
        partial: './bar',
        filename: fixtures('stylus/foo.styl'),
        directory: fixtures('stylus/')
      });

      assert.ok(stub.called);
      assert.ok(result);

      cabinet.unregister('.foobar');
    });

    it('can be called multiple times', () => {
      const stub = sinon.stub().returns('foo');
      const stub2 = sinon.stub().returns('foo');

      cabinet.register('.foobar', stub);
      cabinet.register('.barbar', stub2);

      cabinet({
        partial: './bar',
        filename: fixtures('js/custom/foo.foobar'),
        directory: fixtures('js/amd/')
      });

      cabinet({
        partial: './bar',
        filename: fixtures('js/custom/foo.barbar'),
        directory: fixtures('js/custom/')
      });

      assert.ok(stub.called);
      assert.ok(stub2.called);

      cabinet.unregister('.foobar');
      cabinet.unregister('.barbar');
    });

    it('does not add redundant extensions to supportedFileExtensions', () => {
      const { stub } = sinon;
      const newExt = '.foobar';

      cabinet.register(newExt, stub);
      cabinet.register(newExt, stub);

      const { supportedFileExtensions } = cabinet;

      assert.equal(
        supportedFileExtensions.indexOf(newExt),
        supportedFileExtensions.lastIndexOf(newExt)
      );
    });
  });

  describe('webpack', () => {
    const directory = fixtures('webpack');

    function testResolution(partial, expected) {
      const result = cabinet({
        partial,
        filename: path.join(directory, 'index.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack.config.js')
      });
      assert.equal(result, expected);
    }

    it('resolves an aliased path', () => {
      const partial = 'R';
      const expected = path.join(directory, 'node_modules/resolve/index.js');
      testResolution(partial, expected);
    });

    it('resolves a non-aliased path', () => {
      const partial = 'resolve';
      const expected = path.join(directory, 'node_modules/resolve/index.js');
      testResolution(partial, expected);
    });

    it('resolves a relative path', () => {
      const partial = './test/ast';
      const expected = path.join(directory, 'test/ast.js');
      testResolution(partial, expected);
    });

    it('resolves an absolute path from a file within a subdirectory', () => {
      const result = cabinet({
        partial: 'R',
        filename: path.join(directory, 'test/ast.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack.config.js')
      });
      const expected = path.join(directory, 'node_modules/resolve/index.js');
      assert.equal(result, expected);
    });

    it('resolves a path using resolve.root that value is array', () => {
      const result = cabinet({
        partial: 'mod1',
        filename: path.join(directory, 'index.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack-root.config.js')
      });
      const expected = path.join(directory, 'test/root1/mod1.js');
      assert.equal(result, expected);
    });

    it('resolves a path using resolve.root that value is string', () => {
      const result = cabinet({
        partial: 'mod2',
        filename: path.join(directory, 'index.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack-root-string.config.js')
      });
      const expected = path.join(directory, 'test/root2/mod2.js');
      assert.equal(result, expected);
    });

    it('resolves a path using resolve.roots', () => {
      const result = cabinet({
        partial: 'mod2',
        filename: path.join(directory, 'index.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack-roots.config.js')
      });
      const expected = path.join(directory, 'test/root2/mod2.js');
      assert.equal(result, expected);
    });

    it('resolves npm module when using resolve.root', () => {
      const result = cabinet({
        partial: 'resolve',
        filename: path.join(directory, 'index.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack-root.config.js')
      });
      const expected = path.join(directory, 'node_modules/resolve/index.js');
      assert.equal(result, expected);
    });

    it('resolves a path using resolve.modulesDirectories', () => {
      const result = cabinet({
        partial: 'mod2',
        filename: path.join(directory, 'index.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack-root.config.js')
      });
      const expected = path.join(directory, 'test/root2/mod2.js');
      assert.equal(result, expected);
    });

    it('resolves a path using webpack config that exports a function', () => {
      const result = cabinet({
        partial: 'R',
        filename: path.join(directory, 'index.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack-env.config.js')
      });
      const expected = path.join(directory, 'node_modules/resolve/index.js');
      assert.equal(result, expected);
    });

    it('resolves a path using a first configuration', () => {
      const result = cabinet({
        partial: 'mod1',
        filename: path.join(directory, 'index.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack-multiple.config.js')
      });
      const expected = path.join(directory, 'test/root1/mod1.js');
      assert.equal(result, expected);
    });

    it('resolves files with a .jsx extension', () => {
      const partial = './test/foo.jsx';
      const expected = path.join(directory, 'test/foo.jsx');
      testResolution(partial, expected);
    });

    it('still works when the partial contains a loader', () => {
      testResolution('hgn!resolve', path.join(directory, 'node_modules/resolve/index.js'));
    });

    it('resolves files with a .ts extension', () => {
      const result = cabinet({
        partial: 'R',
        filename: path.join(directory, 'index.ts'),
        directory,
        webpackConfig: path.join(directory, 'webpack.config.js')
      });
      const expected = path.join(directory, 'node_modules/resolve/index.js');
      assert.equal(result, expected);
    });

    it('returns empty string when the webpack config cannot be loaded', () => {
      const result = cabinet({
        partial: './foo',
        filename: path.join(directory, 'index.js'),
        directory,
        webpackConfig: path.join(directory, 'nonexistent-webpack.config.js')
      });
      assert.equal(result, '');
    });

    it('returns empty string when the dependency cannot be resolved by webpack', () => {
      const result = cabinet({
        partial: 'this-module-xyz-does-not-exist',
        filename: path.join(directory, 'index.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack.config.js')
      });
      assert.equal(result, '');
    });
  });

  describe('Svelte', () => {
    const directory = fixtures('svelte');

    it('resolves a Svelte component', () => {
      const result = cabinet({
        partial: './bar.svelte',
        filename: path.join(directory, 'foo.svelte'),
        directory
      });
      const expected = path.join(directory, 'bar.svelte');
      assert.equal(result, expected);
    });

    it('resolves a JS file from a Svelte component', () => {
      const result = cabinet({
        partial: './script.js',
        filename: path.join(directory, 'withJs.svelte'),
        directory
      });
      const expected = path.join(directory, 'script.js');
      assert.equal(result, expected);
    });

    it('resolves a TS file from a Svelte component', () => {
      const result = cabinet({
        partial: './script.ts',
        filename: path.join(directory, 'withTs.svelte'),
        directory
      });
      const expected = path.join(directory, 'script.ts');
      assert.equal(result, expected);
    });

    it('resolves a SCSS file from a Svelte component', () => {
      const result = cabinet({
        partial: './styles.scss',
        filename: path.join(directory, 'withStyles.svelte'),
        directory
      });
      const expected = path.join(directory, 'styles.scss');
      assert.equal(result, expected);
    });

    it('returns empty string for a blank dependency', () => {
      const result = cabinet({
        partial: undefined,
        filename: path.join(directory, 'foo.svelte'),
        directory
      });
      assert.equal(result, '');
    });

    it('resolves a Stylus file from a Svelte component', () => {
      const stylusDirectory = fixtures('stylus');
      const result = cabinet({
        partial: './bar.styl',
        filename: path.join(stylusDirectory, 'foo.svelte'),
        directory: stylusDirectory
      });
      const expected = path.join(stylusDirectory, 'bar.styl');
      assert.equal(result, expected);
    });

    it('uses typescript resolution for imports when tsConfig is provided', () => {
      const result = cabinet({
        partial: './script',
        filename: path.join(directory, 'foo.svelte'),
        directory,
        tsConfig: { compilerOptions: {} }
      });
      const expected = path.join(directory, 'script.ts');
      assert.equal(result, expected);
    });
  });

  describe('Vue', () => {
    const directory = fixtures('svelte');

    it('resolves a SCSS file from a Vue component', () => {
      const result = cabinet({
        partial: './styles.scss',
        filename: path.join(directory, 'foo.vue'),
        directory
      });
      const expected = path.join(directory, 'styles.scss');
      assert.equal(result, expected);
    });
  });
});
