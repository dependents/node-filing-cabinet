var assert = require('assert');
var sinon = require('sinon');
var rewire = require('rewire');
var mock = require('mock-fs');
var path = require('path');

var cabinet = rewire('../');

describe('filing-cabinet', function() {
  describe('JavaScript', function() {
    beforeEach(function() {
      mock({
        'js': {
          'es6': {
            'foo.js': 'import bar from "./bar";',
            'bar.js': 'export default function() {};'
          },
          'amd': {
            'foo.js': 'define(["./bar"], function(bar){ return bar; });',
            'bar.js': 'define({});'
          },
          'commonjs': {
            'foo.js': 'var bar = require("./bar");',
            'bar.js': 'module.exports = function() {};',
            'index.js': '',
            'subdir': {
              'module.js': 'var entry = require("../");',
              'index.js': ''
            },
            'test': {
              'index.spec.js': 'var subdir = require("subdir");'
            }
          },
          'node_modules': {
            'lodash.assign': {
              'index.js': 'module.exports = function() {};'
            },
            'nested': {
              'index.js': 'require("lodash.assign")',
              'node_modules': {
                'lodash.assign': {
                  'index.js': 'module.exports = function() {};'
                }
              }
            }
          },
          'withIndex': {
            'subdir': {
              'index.js': ''
            },
            'index.js': 'var sub = require("./subdir");'
          }
        }
      });
    });

    afterEach(function() {
      mock.restore();
    });

    describe('es6', function() {
      it('uses a generic resolver', function() {
        var stub = sinon.stub();
        var revert = cabinet.__set__('resolveDependencyPath', stub);

        cabinet({
          partial: './bar',
          filename: 'js/es6/foo.js',
          directory: 'js/es6/'
        });

        assert.ok(stub.called);

        revert();
      });

      it('assumes amd for es6 modules with a requirejs config', function() {
        var spy = sinon.spy(cabinet, '_getJSType');

        var result = cabinet({
          partial: './bar',
          filename: 'js/es6/foo.js',
          directory: 'js/es6/',
          config: {
            baseUrl: './'
          }
        });

        assert.ok(spy.called);
        assert.equal(result, 'js/es6/bar.js');
        spy.restore();
      });

      it('falls back to commonjs when the es6 result does not exist', function() {
        var revert = cabinet.__set__('resolveDependencyPath', sinon.stub().returns(''));

        var stub = sinon.stub();
        var revert2 = cabinet.__set__('commonJSLookup', stub);

        cabinet({
          partial: './bar',
          filename: 'js/es6/foo.js',
          directory: 'js/es6/'
        });

        assert.ok(stub.called);

        revert();
        revert2();
      });
    });

    describe('amd', function() {
      it('uses the amd resolver', function() {
        var stub = sinon.stub();
        var revert = cabinet.__set__('amdLookup', stub);

        cabinet({
          partial: './bar',
          filename: 'js/amd/foo.js',
          directory: 'js/amd/'
        });

        assert.ok(stub.called);

        revert();
      });

      it('passes along arguments', function() {
        var stub = sinon.stub();
        var revert = cabinet.__set__('amdLookup', stub);
        var config = {baseUrl: 'js'};

        cabinet({
          partial: 'bar',
          config,
          configPath: 'config.js',
          filename: 'js/amd/foo.js',
          directory: 'js/amd/'
        });

        var args = stub.getCall(0).args[0];

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
        var stub = sinon.stub();
        var revert = cabinet.__set__('commonJSLookup', stub);

        cabinet({
          partial: './bar',
          filename: 'js/commonjs/foo.js',
          directory: 'js/commonjs/'
        });

        assert.ok(stub.called);

        revert();
      });

      it('returns an empty string for an unresolved module', function() {
        var result = cabinet({
          partial: 'foobar',
          filename: 'js/commonjs/foo.js',
          directory: 'js/commonjs/'
        });

        assert.equal(result, '');
      });

      it('adds the directory to the require resolution paths', function() {
        var directory = 'js/commonjs/';
        var result = cabinet({
          partial: 'foobar',
          filename: 'js/commonjs/foo.js',
          directory: directory
        });

        assert.ok(require.main.paths.some(function(p) {
          return p.indexOf(directory) !== -1;
        }));
      });

      it('resolves a relative partial about the filename', function() {
        var directory = 'js/commonjs/';
        var filename = directory + 'foo.js';

        var result = cabinet({
          partial: './bar',
          filename: filename,
          directory: directory
        });

        assert.equal(result, path.join(path.resolve(directory), 'bar.js'));
      });

      it('resolves a .. partial to its parent directory\'s index.js file', function() {
        var directory = 'js/commonjs/';
        var filename = directory + 'subdir/module.js';

        var result = cabinet({
          partial: '../',
          filename: filename,
          directory: directory
        });

        assert.equal(result, path.join(path.resolve(directory), 'index.js'));
      });

      it('resolves a partial within a directory outside of the given file', function() {
        var directory = 'js/commonjs/';
        var filename = directory + 'test/index.spec.js';

        var result = cabinet({
          partial: 'subdir',
          filename: filename,
          directory: directory
        });

        assert.equal(result, path.join(path.resolve(directory), 'subdir/index.js'));
      });

      it('resolves a nested module', function() {
        var directory = 'js/node_modules/nested/';
        var filename = directory + 'index.js';

        var result = cabinet({
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
        var directory = 'js/withIndex';
        var filename = directory + '/index.js';

        var result = cabinet({
          partial: './subdir',
          filename: filename,
          directory: directory
        });

        assert.equal(
          result,
          path.resolve(directory) + '/subdir/index.js'
        );
      });
    });
  });

  describe('CSS', function() {
    describe('Sass', function() {
      it('uses the sass resolver for .scss files', function() {
        var stub = sinon.stub();
        var revert = cabinet.__set__('sassLookup', stub);

        cabinet({
          partial: './bar',
          filename: 'js/sass/foo.scss',
          directory: 'js/sass/'
        });

        assert.ok(stub.called);

        revert();
      });

      it('uses the sass resolver for .sass files', function() {
        var stub = sinon.stub();
        var revert = cabinet.__set__('sassLookup', stub);

        cabinet({
          partial: './bar',
          filename: 'sass/foo.sass',
          directory: 'sass/'
        });

        assert.ok(stub.called);

        revert();
      });
    });

    describe('stylus', function() {
      it('uses the stylus resolver', function() {
        var stub = sinon.stub();
        var revert = cabinet.__set__('stylusLookup', stub);

        cabinet({
          partial: './bar',
          filename: 'stylus/foo.styl',
          directory: 'stylus/'
        });

        assert.ok(stub.called);

        revert();
      });
    });
  });

  describe('.register', function() {
    it('registers a custom resolver for a given extension', function() {
      var stub = sinon.stub().returns('foo');
      cabinet.register('.foobar', stub);

      var path = cabinet({
        partial: './bar',
        filename: 'js/amd/foo.foobar',
        directory: 'js/amd/'
      });

      assert.ok(stub.called);
      assert.equal(path, 'foo.foobar');
    });

    it('allows does not break default resolvers', function() {
      var stub = sinon.stub().returns('foo');
      var stub2 = sinon.stub().returns('foo');

      var revert = cabinet.__set__('stylusLookup', stub2);

      cabinet.register('.foobar', stub);

      cabinet({
        partial: './bar',
        filename: 'js/amd/foo.foobar',
        directory: 'js/amd/'
      });

      cabinet({
        partial: './bar',
        filename: 'stylus/foo.styl',
        directory: 'stylus/'
      });

      assert.ok(stub.called);
      assert.ok(stub2.called);

      revert();
    });

    it('can be called multiple times', function() {
      var stub = sinon.stub().returns('foo');
      var stub2 = sinon.stub().returns('foo');

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
  });

  describe('webpack', function() {
    function testResolution(partial) {
      const directory = path.resolve(__dirname, '../');

      const resolved = cabinet({
        partial,
        filename: `${directory}/index.js`,
        directory,
        webpackConfig: `${directory}/webpack.config.js`
      });

      assert.equal(resolved, `${directory}/node_modules/resolve/index.js`);
    }

    it('resolves an aliased path', function() {
      testResolution('R');
    });

    it('resolves a non-aliased path', function() {
      testResolution('resolve');
    });

    describe('when the partial contains a loader', function() {
      it('still works', function() {
        testResolution('hgn!resolve');
      });
    });
  });
});
