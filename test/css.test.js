import path from 'node:path';
import { describe, it, expect } from 'vitest';
import cabinet from '../index.js';
import { fixtures } from './helpers.js';

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

      expect(result).toBe(expected);
    });

    it('resolves partials with a less extension', () => {
      const result = cabinet({
        partial: 'bar.less',
        filename: path.join(directory, 'foo.less'),
        directory
      });
      const expected = path.join(directory, 'bar.less');

      expect(result).toBe(expected);
    });

    it('resolves partials with a css extension', () => {
      const result = cabinet({
        partial: 'bar.css',
        filename: path.join(directory, 'foo.less'),
        directory
      });
      const expected = path.join(directory, 'bar.css');

      expect(result).toBe(expected);
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

      expect(result).toBe(expected);
    });

    it('uses the sass resolver for .scss files', () => {
      const result = cabinet({
        partial: 'bar',
        filename: path.join(directory, 'foo.scss'),
        directory
      });
      const expected = path.join(directory, 'bar.scss');

      expect(result).toBe(expected);
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

      expect(result).toBe(expected);
    });
  });
});
