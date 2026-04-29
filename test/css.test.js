'use strict';

const assert = require('assert').strict;
const path = require('path');
const cabinet = require('../index.js');
const { fixtures } = require('./helpers.js');

describe('CSS', () => {
  describe('less', () => {
    const directory = fixtures('less');

    it('resolves extensionless partials', () => {
      const result = cabinet({
        partial: 'bar',
        filename: path.join(directory, 'foo.less'),
        directory
      });
      const expected = path.join(directory, 'bar.less');

      assert.equal(result, expected);
    });

    it('resolves partials with a less extension', () => {
      const result = cabinet({
        partial: 'bar.less',
        filename: path.join(directory, 'foo.less'),
        directory
      });
      const expected = path.join(directory, 'bar.less');

      assert.equal(result, expected);
    });

    it('resolves partials with a css extension', () => {
      const result = cabinet({
        partial: 'bar.css',
        filename: path.join(directory, 'foo.less'),
        directory
      });
      const expected = path.join(directory, 'bar.css');

      assert.equal(result, expected);
    });
  });

  describe('sass', () => {
    const directory = fixtures('sass');

    it('uses the sass resolver for .sass files', () => {
      const result = cabinet({
        partial: 'bar',
        filename: path.join(directory, 'foo.sass'),
        directory
      });
      const expected = path.join(directory, 'bar.sass');

      assert.equal(result, expected);
    });

    it('uses the sass resolver for .scss files', () => {
      const result = cabinet({
        partial: 'bar',
        filename: path.join(directory, 'foo.scss'),
        directory
      });
      const expected = path.join(directory, 'bar.scss');

      assert.equal(result, expected);
    });
  });

  describe('stylus', () => {
    const directory = fixtures('stylus');

    it('uses the stylus resolver', () => {
      const result = cabinet({
        partial: 'bar',
        filename: path.join(directory, 'foo.styl'),
        directory
      });
      const expected = path.join(directory, 'bar.styl');

      assert.equal(result, expected);
    });
  });
});
