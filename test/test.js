'use strict';

const assert = require('assert');
const sinon = require('sinon');
const rewire = require('rewire');
const mock = require('mock-fs');
const path = require('path');
const fs = require('fs');
const ts = require('typescript');
const decomment = require('decomment');

const cabinet = rewire('../');
//manually add dynamic imports to rewired app
cabinet.__set__('resolveDependencyPath', require('resolve-dependency-path'));
cabinet.__set__('resolve', require('resolve'));
cabinet.__set__('getModuleType', require('module-definition'));
cabinet.__set__('ts', require('typescript'));
cabinet.__set__('amdLookup', require('module-lookup-amd'));
cabinet.__set__('webpackResolve', require('enhanced-resolve'));

const mockedFiles = require('./mockedJSFiles');
const mockAST = require('./ast');

describe('filing-cabinet', function() {
  describe('JavaScript', function() {
    beforeEach(function() {
      mock(mockedFiles);
    });

    afterEach(function() {
      mock.restore();
    });

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
      const stub = sinon.stub();
      const revert = cabinet.__set__('resolveDependencyPath', stub);

      cabinet({
        partial: './bar',
        filename: 'js/commonjs/foo.baz',
        directory: 'js/commonjs/'
      });

      assert.ok(stub.called);

      revert();
    });

    it('does not throw a runtime exception when using resolve dependency path (#71)', function() {
      assert.doesNotThrow(function() {
        cabinet({
          partial: './bar',
          filename: 'js/commonjs/foo.baz',
          directory: 'js/commonjs/'
        });
      });
    });

    describe('when given an ast for a JS file', function() {
      it('reuses the ast when trying to determine the module type', function() {
        const stub = sinon.stub();
        const revert = cabinet.__set__('getModuleType', {
          fromSource: stub
        });
        const ast = {};

        cabinet({
          partial: './bar',
          filename: 'js/es6/foo.js',
          directory: 'js/es6/',
          ast
        });

        assert.deepEqual(stub.args[0][0], ast);
        revert();
      });

      it('resolves the partial successfully', function() {
        const result = cabinet({
          partial: './bar',
          filename: 'js/es6/foo.js',
          directory: 'js/es6/',
          ast: mockAST
        });

        assert.equal(result, path.join(__dirname, '../js/es6/bar.js'));
      });
    });

    describe('when not given an ast', function() {
      it('uses the filename to look for the module type', function() {
        const stub = sinon.stub();

        const revert = cabinet.__set__('getModuleType', {
          sync: stub
        });

        const options = {
          partial: './bar',
          filename: 'js/es6/foo.js',
          directory: 'js/es6/'
        };

        cabinet(options);

        assert.deepEqual(stub.args[0][0], options.filename);
        revert();
      });
    });

    describe('es6', function() {
      it('assumes commonjs for es6 modules with no requirejs/webpack config', function() {
        const stub = sinon.stub();
        const revert = cabinet.__set__('commonJSLookup', stub);

        cabinet({
          partial: './bar',
          filename: 'js/es6/foo.js',
          directory: 'js/es6/'
        });

        assert.ok(stub.called);

        revert();
      });

      it('assumes amd for es6 modules with a requirejs config', function() {
        const spy = sinon.spy(cabinet, '_getJSType');

        const result = cabinet({
          partial: './bar',
          filename: 'js/es6/foo.js',
          directory: 'js/es6/',
          config: {
            baseUrl: './'
          }
        });

        assert.ok(spy.called);
        var expected = path.normalize('js/es6/bar.js');
        assert.equal(result, expected);
        spy.restore();
      });

      describe('when given a lazy import with interpolation', function() {
        it('does not throw', function() {
          assert.doesNotThrow(() => {
            cabinet({
              partial: '`modulename/locales/${locale}`',
              filename: 'js/es6/lazy.js',
              directory: 'js/es6/'
            });
          });
        });
      });

      describe('when given an undefined dependency', function() {
        it('does not throw', function() {
          assert.doesNotThrow(() => {
            cabinet({
              partial: undefined,
              filename: 'js/es6/lazy.js',
              directory: 'js/es6/'
            });
          });
        });
      });
    });

    describe('jsx', function() {
      it('resolves files with the .jsx extension', function() {
        const result = cabinet({
          partial: './bar',
          filename: 'js/es6/foo.jsx',
          directory: 'js/es6/'
        });

        assert.equal(result, `${path.join(__dirname, '../js/es6/bar.js')}`);
      });
    });

    describe('amd', function() {
      it('uses the amd resolver', function() {
        const stub = sinon.stub();
        const revert = cabinet.__set__('amdLookup', stub);

        cabinet({
          partial: './bar',
          filename: 'js/amd/foo.js',
          directory: 'js/amd/'
        });

        assert.ok(stub.called);

        revert();
      });

      it('passes along arguments', function() {
        const stub = sinon.stub();
        const revert = cabinet.__set__('amdLookup', stub);
        const config = {baseUrl: 'js'};

        cabinet({
          partial: 'bar',
          config,
          configPath: 'config.js',
          filename: 'js/amd/foo.js',
          directory: 'js/amd/'
        });

        const args = stub.getCall(0).args[0];

        assert.equal(args.partial, 'bar');
        assert.equal(args.config, config);
        assert.equal(args.configPath, 'config.js');
        assert.equal(args.filename, 'js/amd/foo.js');
        assert.equal(args.directory, 'js/amd/');

        assert.ok(stub.called);

        revert();
      });
    });

    describe('commonjs', function() {
      it('uses require\'s resolver', function() {
        const stub = sinon.stub();
        const revert = cabinet.__set__('commonJSLookup', stub);

        cabinet({
          partial: './bar',
          filename: 'js/commonjs/foo.js',
          directory: 'js/commonjs/'
        });

        assert.ok(stub.called);

        revert();
      });

      it('returns an empty string for an unresolved module', function() {
        const result = cabinet({
          partial: 'foobar',
          filename: 'js/commonjs/foo.js',
          directory: 'js/commonjs/'
        });

        assert.equal(result, '');
      });

      it('adds the directory to the require resolution paths', function() {
        const directory = 'js/commonjs/';
        cabinet({
          partial: 'foobar',
          filename: 'js/commonjs/foo.js',
          directory: directory
        });

        assert.ok(require.main.paths.some(function(p) {
          var expected = path.normalize(directory);
          return p.indexOf(expected) !== -1;
        }));
      });

      it('resolves a relative partial about the filename', function() {
        const directory = 'js/commonjs/';
        const filename = directory + 'foo.js';

        const result = cabinet({
          partial: './bar',
          filename: filename,
          directory: directory
        });

        assert.equal(result, path.join(path.resolve(directory), 'bar.js'));
      });

      it('resolves a .. partial to its parent directory\'s index.js file', function() {
        const directory = 'js/commonjs/';
        const filename = directory + 'subdir/module.js';

        const result = cabinet({
          partial: '../',
          filename: filename,
          directory: directory
        });

        assert.equal(result, path.join(path.resolve(directory), 'index.js'));
      });

      it('resolves a partial within a directory outside of the given file', function() {
        const directory = 'js/commonjs/';
        const filename = directory + 'test/index.spec.js';

        const result = cabinet({
          partial: 'subdir',
          filename: filename,
          directory: directory
        });

        assert.equal(result, path.join(path.resolve(directory), 'subdir/index.js'));
      });

      it('resolves a node module with module entry in package.json', function() {
        const directory = 'js/commonjs/';
        const filename = directory + 'module.entry.js';

        const result = cabinet({
          partial: 'module.entry',
          filename: filename,
          directory: directory,
          nodeModulesConfig: {
            entry: 'module'
          }
        });

        assert.equal(
          result,
          path.join(
            path.resolve(directory),
            '..',
            'node_modules',
            'module.entry',
            'index.module.js'
          )
        );
      });

      it('resolves a nested module', function() {
        const directory = 'js/node_modules/nested/';
        const filename = directory + 'index.js';

        const result = cabinet({
          partial: 'lodash.assign',
          filename: filename,
          directory: directory
        });

        assert.equal(
          result,
          path.join(
            path.resolve(directory),
            'node_modules',
            'lodash.assign',
            'index.js'
          )
        );
      });

      it('resolves to the index.js file of a directory', function() {
        const directory = 'js/withIndex';
        const filename = directory + '/index.js';

        const result = cabinet({
          partial: './subdir',
          filename: filename,
          directory: directory
        });

        var expected = path.normalize(path.resolve(directory) + '/subdir/index.js');
        assert.equal(
          result,
          expected
        );
      });

      it('resolves implicit .jsx requires', function() {
        const result = cabinet({
          partial: './bar',
          filename: 'js/cjs/foo.js',
          directory: 'js/cjs/'
        });

        assert.equal(result, `${path.join(__dirname, '../js/cjs/bar.jsx')}`);
      });
    });

    describe('typescript', function() {
      const directory = 'js/ts';

      it('resolves an import', function() {
        const filename = directory + '/index.ts';

        const result = cabinet({
          partial: './foo',
          filename,
          directory
        });

        assert.equal(
          result,
          path.join(path.resolve(directory), 'foo.ts')
        );
      });

      it('resolves the import within a tsx file', function() {
        const filename = directory + '/module.tsx';

        const result = cabinet({
          partial: './foo',
          filename,
          directory
        });

        assert.equal(
          result,
          path.join(path.resolve(directory), 'foo.ts')
        );
      });

      describe('when a partial does not exist', function() {
        it('returns an empty result', function() {
          const filename = directory + '/index.ts';

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
          it('uses the defined module kind', function() {
            const mockTs = Object.assign({}, ts, {
              resolveModuleName: sinon.spy(ts.resolveModuleName),
            });

            const revert = cabinet.__set__('ts', mockTs);

            const filename = directory + '/index.ts';

            const tsConfigPath = path.join(path.resolve(directory), '.tsconfig');
            const parsedConfig = JSON.parse(decomment(fs.readFileSync(tsConfigPath, 'utf8')));

            cabinet({
              partial: './foo',
              filename,
              directory,
              tsConfig: parsedConfig
            });

            assert.deepEqual(mockTs.resolveModuleName.args[0][2], {
              module: ts.ModuleKind.CommonJS,
            });

            revert();
          });

          it('finds import from child subdirectories when using node module resolution', function() {
            const filename = directory + '/check-nested.ts';

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
              path.join(path.resolve(directory), '/subdir/index.tsx')
            );
          });

          it('finds imports of non-typescript files', function() {
            const filename = directory + '/index.ts';

            const result = cabinet({
              partial: './image.svg',
              filename,
              directory
            });

            assert.equal(
              result,
              path.join(path.resolve(directory), '/image.svg')
            );
          });

          it('finds imports of non-typescript files using custom import paths', function() {
            const filename = directory + '/index.ts';

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
              path.join(path.resolve(directory), '/subdir/subimage.svg')
            );
          });

          it('finds imports of non-typescript files from node_modules', function() {
            const filename = directory + '/index.ts';

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
              path.join(path.resolve(directory), '../node_modules/image/npm-image.svg')
            );
          });
        });

        describe('as a string', function() {
          it('parses the string into an object', function() {
            const mockTs = Object.assign({}, ts, {
              resolveModuleName: sinon.spy(ts.resolveModuleName),
            });

            const revert = cabinet.__set__('ts', mockTs);

            const filename = directory + '/index.ts';

            cabinet({
              partial: './foo',
              filename,
              directory,
              tsConfig: path.join(path.resolve(directory), '.tsconfig')
            });

            assert.deepEqual(mockTs.resolveModuleName.args[0][2], {
              module: ts.ModuleKind.CommonJS,
            });

            revert();
          });
        });
      });

      describe('when not given a tsconfig', function() {
        it('defaults the module kind to AMD for backcompat', function() {
          const mockTs = Object.assign({}, ts, {
            resolveModuleName: sinon.spy(ts.resolveModuleName),
          });

          const revert = cabinet.__set__('ts', mockTs);

          const filename = directory + '/index.ts';

          cabinet({
            partial: './foo',
            filename,
            directory
          });

          assert.deepEqual(mockTs.resolveModuleName.args[0][2], {
            module: mockTs.ModuleKind.AMD
          });

          revert();
        });
      });
    });
  });

  describe('CSS', function() {
    beforeEach(function() {
      mock({
        stylus: {
          'foo.styl': '',
          'bar.styl': ''
        },
        sass: {
          'foo.scss': '',
          'bar.scss': '',
          'foo.sass': '',
          'bar.sass': ''
        },
        less: {
          'foo.less': '',
          'bar.less': '',
          'bar.css': ''
        }
      });

      this._directory = path.resolve(__dirname, '../');
    });

    afterEach(function() {
      mock.restore();
    });

    describe('sass', function() {
      it('uses the sass resolver for .scss files', function() {
        const result = cabinet({
          partial: 'bar',
          filename: 'sass/foo.scss',
          directory: 'sass/'
        });

        var expected = path.normalize(`${this._directory}/sass/bar.scss`);
        assert.equal(result, expected);
      });

      it('uses the sass resolver for .sass files', function() {
        const result = cabinet({
          partial: 'bar',
          filename: 'sass/foo.sass',
          directory: 'sass/'
        });

        var expected = path.normalize(`${this._directory}/sass/bar.sass`);
        assert.equal(result, expected);
      });
    });

    describe('stylus', function() {
      it('uses the stylus resolver', function() {
        const result = cabinet({
          partial: 'bar',
          filename: 'stylus/foo.styl',
          directory: 'stylus/'
        });

        var expected = path.normalize(`${this._directory}/stylus/bar.styl`);
        assert.equal(result, expected);
      });
    });

    describe('less', function() {
      it('resolves extensionless partials', function() {
        const result = cabinet({
          partial: 'bar',
          filename: 'less/foo.less',
          directory: 'less/'
        });
        var expected = path.normalize(`${this._directory}/less/bar.less`);
        assert.equal(result, expected);
      });

      it('resolves partials with a less extension', function() {
        const result = cabinet({
          partial: 'bar.less',
          filename: 'less/foo.less',
          directory: 'less/'
        });
        var expected = path.normalize(`${this._directory}/less/bar.less`);
        assert.equal(result, expected);
      });

      it('resolves partials with a css extension', function() {
        const result = cabinet({
          partial: 'bar.css',
          filename: 'less/foo.less',
          directory: 'less/'
        });
        var expected = path.normalize(`${this._directory}/less/bar.css`);
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
        filename: 'js/amd/foo.foobar',
        directory: 'js/amd/'
      });

      assert.ok(stub.called);
      assert.equal(path, 'foo.foobar');
    });

    it('allows does not break default resolvers', function() {
      mock({
        stylus: {
          'foo.styl': '',
          'bar.styl': ''
        }
      });

      const stub = sinon.stub().returns('foo');

      cabinet.register('.foobar', stub);

      cabinet({
        partial: './bar',
        filename: 'js/amd/foo.foobar',
        directory: 'js/amd/'
      });

      const result = cabinet({
        partial: './bar',
        filename: 'stylus/foo.styl',
        directory: 'stylus/'
      });

      assert.ok(stub.called);
      assert.ok(result);

      mock.restore();
    });

    it('can be called multiple times', function() {
      const stub = sinon.stub().returns('foo');
      const stub2 = sinon.stub().returns('foo');

      cabinet.register('.foobar', stub);
      cabinet.register('.barbar', stub2);

      cabinet({
        partial: './bar',
        filename: 'js/amd/foo.foobar',
        directory: 'js/amd/'
      });

      cabinet({
        partial: './bar',
        filename: 'js/amd/foo.barbar',
        directory: 'js/amd/'
      });

      assert.ok(stub.called);
      assert.ok(stub2.called);
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
    let directory;

    beforeEach(function() {
      directory = path.resolve(__dirname, '../');
    });

    function testResolution(partial, expected) {
      const resolved = cabinet({
        partial,
        filename: `${directory}/index.js`,
        directory,
        webpackConfig: `${directory}/webpack.config.js`
      });
      var normalisedExpected = path.normalize(expected);
      assert.equal(resolved, normalisedExpected);
    }

    it('resolves an aliased path', function() {
      testResolution('R', `${directory}/node_modules/resolve/index.js`);
    });

    it('resolves a non-aliased path', function() {
      testResolution('resolve', `${directory}/node_modules/resolve/index.js`);
    });

    it('resolves a relative path', function() {
      testResolution('./test/ast', `${directory}/test/ast.js`);
    });

    it('resolves an absolute path from a file within a subdirectory', function() {
      const resolved = cabinet({
        partial: 'R',
        filename: `${directory}/test/ast.js`,
        directory,
        webpackConfig: `${directory}/webpack.config.js`
      });

      var expected = path.normalize(`${directory}/node_modules/resolve/index.js`);
      assert.equal(resolved, expected);
    });

    it('resolves a path using resolve.root', function() {
      const resolved = cabinet({
        partial: 'mod1',
        filename: `${directory}/index.js`,
        directory,
        webpackConfig: `${directory}/webpack-root.config.js`
      });
      var expected = path.normalize(`${directory}/test/root1/mod1.js`);
      assert.equal(resolved, expected);
    });

    it('resolves NPM module when using resolve.root', function() {
      const resolved = cabinet({
        partial: 'resolve',
        filename: `${directory}/index.js`,
        directory,
        webpackConfig: `${directory}/webpack-root.config.js`
      });

      var expected = path.normalize(`${directory}/node_modules/resolve/index.js`);
      assert.equal(resolved, expected);
    });

    it('resolves NPM module when using resolve.modulesDirectories', function() {
      const resolved = cabinet({
        partial: 'resolve',
        filename: `${directory}/index.js`,
        directory,
        webpackConfig: `${directory}/webpack-root.config.js`
      });
      var expected = path.normalize(`${directory}/node_modules/resolve/index.js`);
      assert.equal(resolved, expected);
    });

    it('resolves a path using resolve.modulesDirectories', function() {
      const resolved = cabinet({
        partial: 'mod2',
        filename: `${directory}/index.js`,
        directory,
        webpackConfig: `${directory}/webpack-root.config.js`
      });
      var expected = path.normalize(`${directory}/test/root2/mod2.js`);
      assert.equal(resolved, expected);
    });

    it('resolves a path using webpack config that exports a function', function() {
      const resolved = cabinet({
        partial: 'R',
        filename: `${directory}/index.js`,
        directory,
        webpackConfig: `${directory}/webpack-env.config.js`
      });
      var expected = path.normalize(`${directory}/node_modules/resolve/index.js`);
      assert.equal(resolved, expected);
    });

    it('resolves files with a .jsx extension', function() {
      testResolution('./test/foo.jsx', `${directory}/test/foo.jsx`);
    });

    describe('when the partial contains a loader', function() {
      it('still works', function() {
        testResolution('hgn!resolve', `${directory}/node_modules/resolve/index.js`);
      });
    });
  });
});
