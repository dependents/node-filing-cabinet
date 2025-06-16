'use strict';

const globals = require('globals');

module.exports = [
  {
    ignores: [
      'test/fixtures/*'
    ]
  },
  {
    files: [
      'test/*.js'
    ],
    languageOptions: {
      globals: {
        ...globals.mocha
      }
    }
  },
  {
    space: true,
    rules: {
      '@stylistic/comma-dangle': [
        'error',
        'never'
      ],
      '@stylistic/object-curly-spacing': [
        'error',
        'always'
      ],
      '@stylistic/operator-linebreak': [
        'error',
        'after'
      ],
      '@stylistic/spaced-comment': 'off',
      '@stylistic/space-before-function-paren': [
        'error',
        'never'
      ],
      'arrow-body-style': 'off',
      'capitalized-comments': 'off',
      curly: [
        'error',
        'multi-line'
      ],
      'max-nested-callbacks': [
        'error',
        6
      ],
      'prefer-template': 'error',
      'unicorn/no-anonymous-default-export': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/prefer-node-protocol': 'off',
      'unicorn/prefer-string-slice': 'off',
      'unicorn/prefer-top-level-await': 'off',
      'unicorn/prevent-abbreviations': 'off'
    }
  }
];
