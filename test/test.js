/* eslint-env mocha */

'use strict';

const assert = require('assert').strict;
const { readFile } = require('fs/promises');
const path = require('path');
const sinon = require('sinon');
const cabinet = require('../index.js');
const mockAST = require('./fixtures/ast.js');

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
        filename: path.join(__dirname, 'fixtures/js/commonjs/foo.baz'),
        directory: path.join(__dirname, 'fixtures/js/commonjs/')
      });
      const expected = path.join(__dirname, 'fixtures/js/commonjs/bar.baz');
      assert.equal(result, expected);
    });

    it('does not throw a runtime exception when using resolve dependency path (#71)', () => {
      assert.doesNotThrow(() => {
        cabinet({
          partial: './bar',
          filename: path.join(__dirname, 'fixtures/js/commonjs/foo.baz'),
          directory: path.join(__dirname, 'fixtures/js/commonjs/')
        });
      });
    });

    describe('when given an ast for a JS file', () => {
      it('resolves the partial successfully', () => {
        const result = cabinet({
          partial: './bar',
          filename: path.join(__dirname, 'fixtures/js/es6/foo.js'),
          directory: path.join(__dirname, 'fixtures/js/es6/'),
          ast: mockAST
        });
        const expected = path.join(__dirname, 'fixtures/js/es6/bar.js');
        assert.equal(result, expected);
      });
    });

    describe('when not given an ast', () => {
      it('uses the filename to look for the module type', () => {
        const result = cabinet({
          partial: './bar',
          filename: path.join(__dirname, 'fixtures/js/es6/foo.js'),
          directory: path.join(__dirname, 'fixtures/js/es6/')
        });
        const expected = path.join(__dirname, 'fixtures/js/es6/bar.js');
        assert.equal(result, expected);
      });
    });

    describe('es6', () => {
      it('assumes commonjs for es6 modules with no requirejs/webpack config', () => {
        const result = cabinet({
          partial: './bar',
          filename: path.join(__dirname, 'fixtures/js/es6/foo.js'),
          directory: path.join(__dirname, 'fixtures/js/es6/')
        });
        const expected = path.join(__dirname, 'fixtures/js/es6/bar.js');
        assert.equal(result, expected);
      });

      it('assumes amd for es6 modules with a requirejs config', () => {
        const result = cabinet({
          partial: './bar',
          filename: path.join(__dirname, 'fixtures/js/es6/foo.js'),
          directory: path.join(__dirname, 'fixtures/js/es6/'),
          config: {
            baseUrl: './'
          }
        });
        const expected = path.join(__dirname, 'fixtures/js/es6/bar.js');
        assert.equal(path.normalize(result), expected);
      });

      describe('when given a lazy import with interpolation', () => {
        it('does not throw', () => {
          assert.doesNotThrow(() => {
            cabinet({
              // eslint-disable-next-line no-template-curly-in-string
              partial: '`modulename/locales/${locale}`',
              filename: path.join(__dirname, 'fixtures/js/es6/lazy.js'),
              directory: path.join(__dirname, 'fixtures/js/es6/')
            });
          });
        });
      });

      describe('when given an undefined dependency', () => {
        it('does not throw', () => {
          assert.doesNotThrow(() => {
            cabinet({
              partial: undefined,
              filename: path.join(__dirname, 'fixtures/js/es6/lazy.js'),
              directory: path.join(__dirname, 'fixtures/js/es6/')
            });
          });
        });
      });
    });

    describe('jsx', () => {
      it('resolves files with the .jsx extension', () => {
        const result = cabinet({
          partial: './bar',
          filename: path.join(__dirname, 'fixtures/js/es6/foo.jsx'),
          directory: path.join(__dirname, 'fixtures/js/es6/')
        });
        const expected = path.join(__dirname, 'fixtures/js/es6/bar.js');
        assert.equal(result, expected);
      });
    });

    describe('amd', () => {
      it('uses the amd resolver', () => {
        const result = cabinet({
          partial: './bar',
          filename: path.join(__dirname, 'fixtures/js/amd/foo.js'),
          directory: path.join(__dirname, 'fixtures/js/amd/')
        });
        const expected = path.join(__dirname, 'fixtures/js/amd/bar.js');
        assert.equal(path.normalize(result), expected);
      });

      it('passes along arguments', () => {
        const config = {
          baseUrl: 'js'
        };
        const result = cabinet({
          partial: './bar',
          config,
          filename: path.join(__dirname, 'fixtures/js/amd/foo.js'),
          directory: path.join(__dirname, 'fixtures/js/amd/')
        });
        const expected = path.join(__dirname, 'fixtures/js/amd/bar.js');
        assert.equal(path.normalize(result), expected);
      });
    });

    describe('commonjs', () => {
      it('resolves a relative partial about the filename', () => {
        const result = cabinet({
          partial: './bar',
          filename: path.join(__dirname, 'fixtures/js/commonjs/foo.js'),
          directory: path.join(__dirname, 'fixtures/js/commonjs/')
        });
        const expected = path.join(__dirname, 'fixtures/js/commonjs/bar.js');
        assert.equal(result, expected);
      });

      it('returns an empty string for an unresolved module', () => {
        const result = cabinet({
          partial: 'foobar',
          filename: path.join(__dirname, 'fixtures/js/commonjs/foo.js'),
          directory: path.join(__dirname, 'fixtures/js/commonjs/')
        });
        const expected = '';
        assert.equal(result, expected);
      });

      it('resolves a .. partial to its parent directory\'s index.js file', () => {
        const result = cabinet({
          partial: '../',
          filename: path.join(__dirname, 'fixtures/js/commonjs/subdir/module.js'),
          directory: path.join(__dirname, 'fixtures/js/commonjs/')
        });
        const expected = path.join(__dirname, 'fixtures/js/commonjs/index.js');
        assert.equal(result, expected);
      });

      it('resolves a partial within a directory outside of the given file', () => {
        const result = cabinet({
          partial: 'subdir',
          filename: path.join(__dirname, 'fixtures/js/commonjs/test/index.spec.js'),
          directory: path.join(__dirname, 'fixtures/js/commonjs/')
        });
        const expected = path.join(__dirname, 'fixtures/js/commonjs/subdir/index.js');
        assert.equal(result, expected);
      });

      it('resolves a node module with module entry in package.json', () => {
        const result = cabinet({
          partial: 'module.entry',
          filename: path.join(__dirname, 'fixtures/js/commonjs/module-entry.js'),
          directory: path.join(__dirname, 'fixtures/js/commonjs/'),
          nodeModulesConfig: {
            entry: 'module'
          }
        });
        const expected = path.join(__dirname, 'fixtures/js/node_modules/module.entry/index.module.js');
        assert.equal(result, expected);
      });

      it('resolves a nested module', () => {
        const result = cabinet({
          partial: 'lodash.assign',
          filename: path.join(__dirname, 'fixtures/js/node_modules/nested/index.js'),
          directory: path.join(__dirname, 'fixtures/js/node_modules/nested/')
        });
        const expected = path.join(__dirname, 'fixtures/js/node_modules/nested/node_modules/lodash.assign/index.js');
        assert.equal(result, expected);
      });

      it('resolves to the index.js file of a directory', () => {
        const result = cabinet({
          partial: './subdir',
          filename: path.join(__dirname, 'fixtures/js/withIndex/index.js'),
          directory: path.join(__dirname, 'fixtures/js/withIndex')
        });
        const expected = path.join(__dirname, 'fixtures/js/withIndex/subdir/index.js');
        assert.equal(result, expected);
      });

      it('resolves implicit .jsx requires', () => {
        const result = cabinet({
          partial: './bar',
          filename: path.join(__dirname, 'fixtures/js/cjs/foo.js'),
          directory: path.join(__dirname, 'fixtures/js/cjs/')
        });
        const expected = path.join(__dirname, 'fixtures/js/cjs/bar.jsx');
        assert.equal(result, expected);
      });
    });

    describe('typescript', () => {
      const directory = path.join(__dirname, 'fixtures/ts');

      it('resolves an import', () => {
        const filename = path.join(directory, 'index.ts');
        const result = cabinet({
          partial: './foo',
          filename,
          directory
        });
        const expected = path.join(directory, 'foo.ts');
        assert.equal(result, expected);
      });

      it('resolves the import within a tsx file', () => {
        const filename = path.join(directory, 'module.tsx');
        const result = cabinet({
          partial: './foo',
          filename,
          directory
        });
        const expected = path.join(directory, 'foo.ts');
        assert.equal(result, expected);
      });

      it('resolves the import of a file with type-definition', () => {
        const filename = path.join(directory, 'index.ts');
        const result = cabinet({
          partial: './withTypeDef',
          filename,
          directory
        });
        const expected = path.join(directory, 'withTypeDef.d.ts');
        assert.equal(result, expected);
      });

      describe('when noTypeDefinitions is set', () => {
        it('resolves the import of a file with type-definition to the JS file', () => {
          const filename = path.join(directory, '/index.ts');
          const result = cabinet({
            partial: './withTypeDef',
            filename,
            directory,
            noTypeDefinitions: true
          });
          const expected = path.join(directory, 'withTypeDef.js');
          assert.equal(result, expected);
        });

        it('resolves the import of a file with type-definition to the JS file using custom import paths', () => {
          const filename = path.join(directory, './index.ts');
          const result = cabinet({
            partial: '@test/withTypeDef',
            filename,
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
          const filename = path.join(directory, '/index.ts');
          const result = cabinet({
            partial: './withOnlyTypeDef.d.ts',
            filename,
            directory,
            noTypeDefinitions: true
          });
          const expected = path.join(directory, 'withOnlyTypeDef.d.ts');
          assert.equal(result, expected);
        });
      });

      describe('when a partial does not exist', () => {
        it('returns an empty result', () => {
          const filename = path.join(directory, 'index.ts');
          const result = cabinet({
            partial: './barbar',
            filename,
            directory
          });
          const expected = '';
          assert.equal(result, expected);
        });
      });

      describe('when given a tsconfig', () => {
        describe('as an object', () => {
          it('resolves the module name', async() => {
            const filename = path.join(directory, 'index.ts');
            const tsConfigPath = path.join(directory, '.tsconfig');
            const configContent = await readFile(tsConfigPath, 'utf8');
            const parsedConfig = JSON.parse(configContent);
            const result = cabinet({
              partial: './foo',
              filename,
              directory,
              tsConfig: parsedConfig
            });
            const expected = path.join(directory, 'foo.ts');
            assert.equal(result, expected);
          });

          it('finds import from child subdirectories when using node module resolution', () => {
            const filename = path.join(directory, 'check-nested.ts');
            const result = cabinet({
              partial: './subdir',
              filename,
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
            const filename = path.join(directory, '/index.ts');
            const result = cabinet({
              partial: './image.svg',
              filename,
              directory
            });
            const expected = path.join(directory, '/image.svg');
            assert.equal(result, expected);
          });

          it('finds imports of non-existent typescript imports', () => {
            const filename = path.join(directory, '/index.ts');
            const result = cabinet({
              partial: 'virtual:test-virtual',
              filename,
              directory
            });
            assert.equal(result, '');
          });

          it('finds imports of non-typescript files using custom import paths', () => {
            const filename = path.join(directory, '/index.ts');
            const result = cabinet({
              partial: '@shortcut/subimage.svg',
              filename,
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
            const filename = path.join(directory, 'index.ts');
            const result = cabinet({
              partial: 'image/npm-image.svg',
              filename,
              directory,
              tsConfig: {
                compilerOptions: {
                  moduleResolution: 'node'
                }
              }
            });
            const expected = path.join(
              directory,
              'node_modules/image/npm-image.svg'
            );
            assert.equal(result, expected);
          });

          it('finds imports of typescript files from non-typescript files with allowJs option (#89)', () => {
            const filename = path.join(directory, '/bar.js');
            const result = cabinet({
              partial: './foo',
              filename,
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
            const filename = path.join(directory, '/bar.js');
            const result = cabinet({
              partial: '@shortcut/subimage.svg',
              filename,
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
        });

        describe('as a string', () => {
          it('parses the string into an object', () => {
            const filename = path.join(directory, 'index.ts');
            const result = cabinet({
              partial: './foo',
              filename,
              directory,
              tsConfig: path.join(directory, '.tsconfig')
            });
            const expected = path.join(directory, 'foo.ts');
            assert.equal(result, expected);
          });
        });

        describe('when the typescript\'s path mapping is configured', () => {
          it('should resolve the path', () => {
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
        });
      });

      describe('when not given a tsconfig', () => {
        it('resolves the module', () => {
          const filename = path.join(directory, 'index.ts');
          const result = cabinet({
            partial: './foo',
            filename,
            directory
          });
          const expected = path.join(directory, 'foo.ts');
          assert.equal(result, expected);
        });
      });

      describe('when given a tsconfig and webpack config', () => {
        it('resolves the module', () => {
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
      });
    });
  });

  describe('CSS', () => {
    describe('less', () => {
      it('resolves extensionless partials', () => {
        const result = cabinet({
          partial: 'bar',
          filename: path.join(__dirname, 'fixtures/less/foo.less'),
          directory: path.join(__dirname, 'fixtures/less/')
        });
        const expected = path.join(__dirname, 'fixtures/less/bar.less');
        assert.equal(result, expected);
      });

      it('resolves partials with a less extension', () => {
        const result = cabinet({
          partial: 'bar.less',
          filename: path.join(__dirname, 'fixtures/less/foo.less'),
          directory: path.join(__dirname, 'fixtures/less/')
        });
        const expected = path.join(__dirname, 'fixtures/less/bar.less');
        assert.equal(result, expected);
      });

      it('resolves partials with a css extension', () => {
        const result = cabinet({
          partial: 'bar.css',
          filename: path.join(__dirname, 'fixtures/less/foo.less'),
          directory: path.join(__dirname, 'fixtures/less/')
        });
        const expected = path.join(__dirname, 'fixtures/less/bar.css');
        assert.equal(result, expected);
      });
    });

    describe('sass', () => {
      it('uses the sass resolver for .sass files', () => {
        const result = cabinet({
          partial: 'bar',
          filename: path.join(__dirname, 'fixtures/sass/foo.sass'),
          directory: path.join(__dirname, 'fixtures/sass/')
        });
        const expected = path.join(__dirname, 'fixtures/sass/bar.sass');
        assert.equal(result, expected);
      });

      it('uses the sass resolver for .scss files', () => {
        const result = cabinet({
          partial: 'bar',
          filename: path.join(__dirname, 'fixtures/sass/foo.scss'),
          directory: path.join(__dirname, 'fixtures/sass/')
        });
        const expected = path.join(__dirname, 'fixtures/sass/bar.scss');
        assert.equal(result, expected);
      });
    });

    describe('stylus', () => {
      it('uses the stylus resolver', () => {
        const result = cabinet({
          partial: 'bar',
          filename: path.join(__dirname, 'fixtures/stylus/foo.styl'),
          directory: path.join(__dirname, 'fixtures/stylus/')
        });
        const expected = path.join(__dirname, 'fixtures/stylus/bar.styl');
        assert.equal(result, expected);
      });
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
        filename: path.join(__dirname, 'fixtures/js/custom/foo.foobar'),
        directory: path.join(__dirname, 'fixtures/js/custom/')
      });

      const result = cabinet({
        partial: './bar',
        filename: path.join(__dirname, 'fixtures/stylus/foo.styl'),
        directory: path.join(__dirname, 'fixtures/stylus/')
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
        filename: path.join(__dirname, 'fixtures/js/custom/foo.foobar'),
        directory: path.join(__dirname, 'fixtures/js/amd/')
      });

      cabinet({
        partial: './bar',
        filename: path.join(__dirname, 'fixtures/js/custom/foo.barbar'),
        directory: path.join(__dirname, 'fixtures/js/custom/')
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
    const directory = path.join(__dirname, 'fixtures/webpack');

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

    it('resolves npm module when using resolve.roots', () => {
      const result = cabinet({
        partial: 'resolve',
        filename: path.join(directory, 'index.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack-root.config.js')
      });
      const expected = path.join(directory, 'node_modules/resolve/index.js');
      assert.equal(result, expected);
    });

    it('resolves npm module when using resolve.modulesDirectories', () => {
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

    describe('when the partial contains a loader', () => {
      it('still works', () => {
        const partial = 'hgn!resolve';
        const expected = path.join(directory, 'node_modules/resolve/index.js');
        testResolution(partial, expected);
      });
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
  });

  describe('Svelte', () => {
    const directory = path.join(__dirname, 'fixtures/svelte');

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
  });
});
