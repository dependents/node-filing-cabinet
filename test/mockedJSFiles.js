module.exports = {
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
};
