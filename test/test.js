'use strict';

const assert = require('assert');
const sinon = require('sinon');
const path = require('path');
const fs = require('fs');
const ts = require('typescript');

const mockAST = require('./ast');

const cabinet = require('../index');

describe('filing-cabinet', function() {
  describe('JavaScript', function() {
    it('dangles off its supported file extensions', function() {
      assert.deepEqual(cabinet.supportedFileExtensions, [
        '.js',
        '.jsx',
        '.ts',
        '.tsx',
        '.scss',
        '.sass',
        '.styl',
        '.less'
      ]);
    });

    it('uses a generic resolve for unsupported file extensions', function() {
      var result = cabinet({
        partial: './bar',
        filename: path.join(__dirname, 'js/commonjs/foo.baz'),
        directory: path.join(__dirname, 'js/commonjs/')
      });

      assert.equal(result, path.join(__dirname, 'js/commonjs/bar.baz'));
    });

    it('does not throw a runtime exception when using resolve dependency path (#71)', function() {
      assert.doesNotThrow(function() {
        cabinet({
          partial: './bar',
          filename: path.join(__dirname, 'js/commonjs/foo.baz'),
          directory: path.join(__dirname, 'js/commonjs/')
        });
      });
    });

    describe('when given an ast for a JS file', function() {
      it('resolves the partial successfully', function() {
        const result = cabinet({
          partial: './bar',
          filename: path.join(__dirname, 'js/es6/foo.js'),
          directory: path.join(__dirname, 'js/es6/'),
          ast: mockAST
        });

        assert.equal(result, path.join(__dirname, 'js/es6/bar.js'));
      });
    });

    describe('when not given an ast', function() {
      it('uses the filename to look for the module type', function() {
        const options = {
          partial: './bar',
          filename: path.join(__dirname, 'js/es6/foo.js'),
          directory: path.join(__dirname, 'js/es6/')
        };

        const result = cabinet(options);

        assert.equal(result, path.join(__dirname, 'js/es6/bar.js'));
      });
    });

    describe('es6', function() {
      it('assumes commonjs for es6 modules with no requirejs/webpack config', function() {
        const result = cabinet({
          partial: './bar',
          filename: path.join(__dirname, 'js/es6/foo.js'),
          directory: path.join(__dirname, 'js/es6/')
        });

        assert.equal(result, path.join(__dirname, 'js/es6/bar.js'));
      });

      it('assumes amd for es6 modules with a requirejs config', function() {
        const result = cabinet({
          partial: './bar',
          filename: path.join(__dirname, 'js/es6/foo.js'),
          directory: path.join(__dirname, 'js/es6/'),
          config: {
            baseUrl: './'
          }
        });

        assert.equal(result, path.join(__dirname, 'js/es6/bar.js'));
      });

      describe('when given a lazy import with interpolation', function() {
        it('does not throw', function() {
          assert.doesNotThrow(() => {
            cabinet({
              partial: '`modulename/locales/${locale}`',
              filename: path.join(__dirname, 'js/es6/lazy.js'),
              directory: path.join(__dirname, 'js/es6/')
            });
          });
        });
      });

      describe('when given an undefined dependency', function() {
        it('does not throw', function() {
          assert.doesNotThrow(() => {
            cabinet({
              partial: undefined,
              filename: path.join(__dirname, 'js/es6/lazy.js'),
              directory: path.join(__dirname, 'js/es6/')
            });
          });
        });
      });
    });

    describe('jsx', function() {
      it('resolves files with the .jsx extension', function() {
        const result = cabinet({
          partial: './bar',
          filename: path.join(__dirname, 'js/es6/foo.jsx'),
          directory: path.join(__dirname, 'js/es6/')
        });

        assert.equal(result, path.join(__dirname, 'js/es6/bar.js'));
      });
    });

    describe('amd', function() {
      it('uses the amd resolver', function() {
        const result = cabinet({
          partial: './bar',
          filename: path.join(__dirname, 'js/amd/foo.js'),
          directory: path.join(__dirname, 'js/amd/')
        });

        assert.equal(result, path.join(__dirname, 'js/amd/bar.js'));
      });

      it('passes along arguments', function() {
        const config = {baseUrl: 'js'};

        const result = cabinet({
          partial: './bar',
          config,
          filename: path.join(__dirname, 'js/amd/foo.js'),
          directory: path.join(__dirname, 'js/amd/')
        });

        assert.equal(result, path.join(__dirname, 'js/amd/bar.js'));
      });
    });

    describe('commonjs', function() {
      it('resolves a relative partial about the filename', function() {
        const result = cabinet({
          partial: './bar',
          filename: path.join(__dirname, 'js/commonjs/foo.js'),
          directory: path.join(__dirname, 'js/commonjs/')
        });

        assert.equal(result, path.join(__dirname, 'js/commonjs/bar.js'));
      });

      it('returns an empty string for an unresolved module', function() {
        const result = cabinet({
          partial: 'foobar',
          filename: path.join(__dirname, 'js/commonjs/foo.js'),
          directory: path.join(__dirname, 'js/commonjs/')
        });

        assert.equal(result, '');
      });

      it('resolves a .. partial to its parent directory\'s index.js file', function() {
        const result = cabinet({
          partial: '../',
          filename: path.join(__dirname, 'js/commonjs/subdir/module.js'),
          directory: path.join(__dirname, 'js/commonjs/')
        });

        assert.equal(result, path.join(__dirname, 'js/commonjs/index.js'));
      });

      it('resolves a partial within a directory outside of the given file', function() {
        const result = cabinet({
          partial: 'subdir',
          filename: path.join(__dirname, 'js/commonjs/test/index.spec.js'),
          directory: path.join(__dirname, 'js/commonjs/')
        });

        assert.equal(result, path.join(__dirname, 'js/commonjs/subdir/index.js'));
      });

      it('resolves a node module with module entry in package.json', function() {
        const result = cabinet({
          partial: 'module.entry',
          filename: path.join(__dirname, 'js/commonjs/module-entry.js'),
          directory: path.join(__dirname, 'js/commonjs/'),
          nodeModulesConfig: {
            entry: 'module'
          }
        });

        assert.equal(
          result,
          path.join(
            __dirname,
            'js/node_modules/module.entry/index.module.js'
          )
        );
      });

      it('resolves a nested module', function() {
        const result = cabinet({
          partial: 'lodash.assign',
          filename: path.join(__dirname, 'js/node_modules/nested/index.js'),
          directory: path.join(__dirname, 'js/node_modules/nested/')
        });

        assert.equal(
          result,
          path.join(
            __dirname,
            'js/node_modules/nested/node_modules/lodash.assign/index.js'
          )
        );
      });

      it('resolves to the index.js file of a directory', function() {
        const result = cabinet({
          partial: './subdir',
          filename: path.join(__dirname, 'js/withIndex/index.js'),
          directory: path.join(__dirname, 'js/withIndex')
        });

        assert.equal(
          result,
          path.join(__dirname, 'js/withIndex/subdir/index.js')
        );
      });

      it('resolves implicit .jsx requires', function() {
        const result = cabinet({
          partial: './bar',
          filename: path.join(__dirname, 'js/cjs/foo.js'),
          directory: path.join(__dirname, 'js/cjs/')
        });

        assert.equal(result, path.join(__dirname, 'js/cjs/bar.jsx'));
      });
    });

    describe('typescript', function() {
      const directory = path.join(__dirname, 'ts');

      it('resolves an import', function() {
        const filename = path.join(directory, 'index.ts');

        const result = cabinet({
          partial: './foo',
          filename,
          directory
        });

        assert.equal(
          result,
          path.join(directory, 'foo.ts')
        );
      });

      it('resolves the import within a tsx file', function() {
        const filename = path.join(directory, 'module.tsx');

        const result = cabinet({
          partial: './foo',
          filename,
          directory
        });

        assert.equal(
          result,
          path.join(directory, 'foo.ts')
        );
      });

      it('resolves the import of a file with type-definition', function() {
        const filename = path.join(directory, 'index.ts');

        const result = cabinet({
          partial: './withTypeDef',
          filename,
          directory
        });

        assert.equal(
          result,
          path.join(directory, 'withTypeDef.d.ts')
        );
      });

      describe('when noTypeDefinitions is set', () => {
        it('resolves the import of a file with type-definition to the JS file', function() {
          const filename = path.join(directory, '/index.ts');

          const result = cabinet({
            partial: './withTypeDef',
            filename,
            directory,
            noTypeDefinitions: true
          });

          assert.equal(
            result,
            path.join(directory, 'withTypeDef.js')
          );
        });

        it('still returns the .d.ts file if no JS file is found', function() {
          const filename = path.join(directory, '/index.ts');

          const result = cabinet({
            partial: './withOnlyTypeDef.d.ts',
            filename,
            directory,
            noTypeDefinitions: true
          });

          assert.equal(
            result,
            path.join(directory, 'withOnlyTypeDef.d.ts')
          );
        });
      });

      describe('when a partial does not exist', function() {
        it('returns an empty result', function() {
          const filename = path.join(directory, 'index.ts');

          const result = cabinet({
            partial: './barbar',
            filename,
            directory
          });

          assert.equal(result, '');
        });
      });

      describe('when given a tsconfig', function() {
        describe('as an object', function() {
          it('resolves the module name', function() {
            const filename = path.join(directory, 'index.ts');

            const tsConfigPath = path.join(directory, '.tsconfig');
            const parsedConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));

            const result = cabinet({
              partial: './foo',
              filename,
              directory,
              tsConfig: parsedConfig
            });

            assert.equal(result, path.join(directory, 'foo.ts'));
          });

          it('finds import from child subdirectories when using node module resolution', function() {
            const filename = path.join(directory, 'check-nested.ts');

            const result = cabinet({
              partial: './subdir',
              filename,
              directory,
              tsConfig: {
                compilerOptions: {module: 'commonjs', moduleResolution: 'node'}
              }
            });

            assert.equal(
              result,
              path.join(directory, '/subdir/index.tsx')
            );
          });

          it('finds import from child subdirectories when using node module resolution in extended config', function() {
            const result = cabinet({
              partial: './subdir',
              filename: path.join(directory, 'check-nested.ts'),
              directory,
              tsConfig: path.join(directory, '.tsconfigExtending')
            });

            assert.equal(
                result,
                path.join(directory, 'subdir/index.tsx')
            );
          });

          it('finds imports of non-typescript files', function() {
            const filename = path.join(directory, '/index.ts');

            const result = cabinet({
              partial: './image.svg',
              filename,
              directory
            });

            assert.equal(
              result,
              path.join(directory, '/image.svg')
            );
          });

          it('finds imports of non-typescript files using custom import paths', function() {
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
                    '@shortcut/*': ['subdir/*'],
                  }
                }
              }
            });

            assert.equal(
              result,
              path.join(directory, 'subdir/subimage.svg')
            );
          });

          it('finds imports of non-typescript files from node_modules', function() {
            const filename = path.join(directory, 'index.ts');

            const result = cabinet({
              partial: 'image/npm-image.svg',
              filename,
              directory,
              tsConfig: {
                compilerOptions: {moduleResolution: 'node'}
              }
            });

            assert.equal(
              result,
              path.join(directory, 'node_modules/image/npm-image.svg')
            );
          });

          it('finds imports of typescript files from non-typescript files with allowJs option (#89)', function() {
            const filename = path.join(directory, '/bar.js');

            const result = cabinet({
              partial: './foo',
              filename,
              directory,
              tsConfig: {
                compilerOptions: {allowJs: true}
              }
            });
            assert.equal(
              result,
              path.join(directory, '/foo.ts')
            );
          });

          it('finds imports using custom import paths from javascript files with allowJs option', function() {
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
                    '@shortcut/*': ['subdir/*'],
                  }
                }
              }
            });

            assert.equal(
              result,
              path.join(directory, 'subdir/subimage.svg')
            );
          });
        });

        describe('as a string', function() {
          it('parses the string into an object', function() {
            const filename = path.join(directory, 'index.ts');

            const result = cabinet({
              partial: './foo',
              filename,
              directory,
              tsConfig: path.join(directory, '.tsconfig')
            });

            assert.equal(result, path.join(directory, 'foo.ts'));
          });
        });

        describe(`when the typescript's path mapping is configured`, function() {
          it('should resolve the path', function() {
            const result = cabinet({
              partial: '#foo/hello',
              filename: path.resolve(__dirname, 'root3', 'packages', 'foo', 'index.ts'),
              directory: path.resolve(__dirname, 'root3'),
              tsConfig: {
                'compilerOptions': {
                  'rootDir': '.',
                  'baseUrl': 'packages',
                  'paths': {
                    '@monorepo/*': ['*'],
                    '#foo/*': ['foo/*'],
                    '#bar/*': ['bar/*'],
                    '#*': ['*']
                  },
                },
              },
              tsConfigPath: path.resolve(__dirname, 'root3', 'tsconfig.json'),
            });
            const expected = path.resolve(__dirname, 'root3', 'packages', 'foo', 'hello.ts');
            assert.equal(result, expected);
          });
        });
      });

      describe('when not given a tsconfig', function() {
        it('resolves the module', function() {
          const filename = path.join(directory, 'index.ts');

          const result = cabinet({
            partial: './foo',
            filename,
            directory
          });

          assert.equal(result, path.join(directory, 'foo.ts'));
        });
      });

      describe('when given a tsconfig and webpack config', function() {
        it('resolves the module', function() {
          const result = cabinet({
            partial: './subdir',
            filename: path.join(directory, 'check-nested.ts'),
            directory,
            tsConfig: path.join(directory, '.tsconfigExtending'),
            webpackConfig: path.join(directory, 'webpack.config.js')
          });

          assert.equal(
            result,
            path.join(directory, 'subdir/index.tsx')
          );
        });
      });
    });
  });

  describe('CSS', function() {
    describe('sass', function() {
      it('uses the sass resolver for .scss files', function() {
        const result = cabinet({
          partial: 'bar',
          filename: path.join(__dirname, 'sass/foo.scss'),
          directory: path.join(__dirname, 'sass/')
        });

        const expected = path.join(__dirname, 'sass/bar.scss');
        assert.equal(result, expected);
      });

      it('uses the sass resolver for .sass files', function() {
        const result = cabinet({
          partial: 'bar',
          filename: path.join(__dirname, 'sass/foo.sass'),
          directory: path.join(__dirname, 'sass/')
        });

        const expected = path.join(__dirname, 'sass/bar.sass');
        assert.equal(result, expected);
      });
    });

    describe('stylus', function() {
      it('uses the stylus resolver', function() {
        const result = cabinet({
          partial: 'bar',
          filename: path.join(__dirname, 'stylus/foo.styl'),
          directory: path.join(__dirname, 'stylus/')
        });

        const expected = path.join(__dirname, 'stylus/bar.styl');
        assert.equal(result, expected);
      });
    });

    describe('less', function() {
      it('resolves extensionless partials', function() {
        const result = cabinet({
          partial: 'bar',
          filename: path.join(__dirname, 'less/foo.less'),
          directory: path.join(__dirname, 'less/')
        });

        const expected = path.join(__dirname, 'less/bar.less');
        assert.equal(result, expected);
      });

      it('resolves partials with a less extension', function() {
        const result = cabinet({
          partial: 'bar.less',
          filename: path.join(__dirname, 'less/foo.less'),
          directory: path.join(__dirname, 'less/')
        });

        const expected = path.join(__dirname, 'less/bar.less');
        assert.equal(result, expected);
      });

      it('resolves partials with a css extension', function() {
        const result = cabinet({
          partial: 'bar.css',
          filename: path.join(__dirname, 'less/foo.less'),
          directory: path.join(__dirname, 'less/')
        });

        const expected = path.join(__dirname, 'less/bar.css');
        assert.equal(result, expected);
      });
    });
  });

  describe('.register', function() {
    it('registers a custom resolver for a given extension', function() {
      const stub = sinon.stub().returns('foo.foobar');
      cabinet.register('.foobar', stub);

      const path = cabinet({
        partial: './bar',
        filename: 'js/custom/foo.foobar',
        directory: 'js/custom/'
      });

      assert.ok(stub.called);
      assert.equal(path, 'foo.foobar');
      cabinet.unregister('.foobar');
    });

    it('does not break default resolvers', function() {
      const stub = sinon.stub().returns('foo.foobar');
      cabinet.register('.foobar', stub);

      cabinet({
        partial: './bar',
        filename: path.join(__dirname, 'js/custom/foo.foobar'),
        directory: path.join(__dirname, 'js/custom/')
      });

      const result = cabinet({
        partial: './bar',
        filename: path.join(__dirname, 'stylus/foo.styl'),
        directory: path.join(__dirname, 'stylus/')
      });

      assert.ok(stub.called);
      assert.ok(result);

      cabinet.unregister('.foobar');
    });

    it('can be called multiple times', function() {
      const stub = sinon.stub().returns('foo');
      const stub2 = sinon.stub().returns('foo');

      cabinet.register('.foobar', stub);
      cabinet.register('.barbar', stub2);

      cabinet({
        partial: './bar',
        filename: path.join(__dirname, 'js/custom/foo.foobar'),
        directory: path.join(__dirname, 'js/amd/')
      });

      cabinet({
        partial: './bar',
        filename: path.join(__dirname, 'js/custom/foo.barbar'),
        directory: path.join(__dirname, 'js/custom/')
      });

      assert.ok(stub.called);
      assert.ok(stub2.called);

      cabinet.unregister('.foobar');
      cabinet.unregister('.barbar');
    });

    it('does not add redundant extensions to supportedFileExtensions', function() {
      const stub = sinon.stub;
      const newExt = '.foobar';

      cabinet.register(newExt, stub);
      cabinet.register(newExt, stub);

      const {supportedFileExtensions} = cabinet;

      assert.equal(supportedFileExtensions.indexOf(newExt), supportedFileExtensions.lastIndexOf(newExt));
    });
  });

  describe('webpack', function() {
    let directory = path.join(__dirname, 'webpack');

    function testResolution(partial, expected) {
      const resolved = cabinet({
        partial,
        filename: path.join(directory, 'index.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack.config.js')
      });

      assert.equal(resolved, expected);
    }

    it('resolves an aliased path', function() {
      testResolution('R', path.join(directory, 'node_modules/resolve/index.js'));
    });

    it('resolves a non-aliased path', function() {
      testResolution('resolve', path.join(directory, 'node_modules/resolve/index.js'));
    });

    it('resolves a relative path', function() {
      testResolution('./test/ast', path.join(directory, 'test/ast.js'));
    });

    it('resolves an absolute path from a file within a subdirectory', function() {
      const resolved = cabinet({
        partial: 'R',
        filename: path.join(directory, 'test/ast.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack.config.js')
      });

      const expected = path.join(directory, 'node_modules/resolve/index.js');
      assert.equal(resolved, expected);
    });

    it('resolves a path using resolve.root', function() {
      const resolved = cabinet({
        partial: 'mod1',
        filename: path.join(directory, 'index.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack-root.config.js')
      });

      const expected = path.join(directory, 'test/root1/mod1.js');
      assert.equal(resolved, expected);
    });

    it('resolves NPM module when using resolve.root', function() {
      const resolved = cabinet({
        partial: 'resolve',
        filename: path.join(directory, 'index.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack-root.config.js')
      });

      const expected = path.join(directory, 'node_modules/resolve/index.js');
      assert.equal(resolved, expected);
    });

    it('resolves NPM module when using resolve.modulesDirectories', function() {
      const resolved = cabinet({
        partial: 'resolve',
        filename: path.join(directory, 'index.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack-root.config.js')
      });

      const expected = path.join(directory, 'node_modules/resolve/index.js');
      assert.equal(resolved, expected);
    });

    it('resolves a path using resolve.modulesDirectories', function() {
      const resolved = cabinet({
        partial: 'mod2',
        filename: path.join(directory, 'index.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack-root.config.js')
      });

      const expected = path.join(directory, 'test/root2/mod2.js');
      assert.equal(resolved, expected);
    });

    it('resolves a path using webpack config that exports a function', function() {
      const resolved = cabinet({
        partial: 'R',
        filename: path.join(directory, 'index.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack-env.config.js')
      });

      const expected = path.join(directory, 'node_modules/resolve/index.js');
      assert.equal(resolved, expected);
    });

    it('resolves a path using a first configuration', function() {
      const resolved = cabinet({
        partial: 'mod1',
        filename: path.join(directory, 'index.js'),
        directory,
        webpackConfig: path.join(directory, 'webpack-multiple.config.js')
      });

      const expected = path.join(directory, 'test/root1/mod1.js');
      assert.equal(resolved, expected);
    });

    it('resolves files with a .jsx extension', function() {
      testResolution('./test/foo.jsx', path.join(directory, 'test/foo.jsx'));
    });

    describe('when the partial contains a loader', function() {
      it('still works', function() {
        testResolution('hgn!resolve', path.join(directory, 'node_modules/resolve/index.js'));
      });
    });

    it('resolves files with a .ts extension', function() {
      const resolved = cabinet({
        partial: 'R',
        filename: path.join(directory, 'index.ts'),
        directory,
        webpackConfig: path.join(directory, 'webpack.config.js')
      });

      const expected = path.join(directory, 'node_modules/resolve/index.js');
      assert.equal(resolved, expected);
    });
  });
});
