import path from 'node:path';
import { describe, it, expect } from 'vitest';
import Cabinet from '../index.js';
import { fixtures } from './helpers.js';

const directory = fixtures('svelte');
const cabinet = new Cabinet();

describe('Svelte', () => {
  it('resolves a Svelte component', () => {
    const result = cabinet.lookup({
      partial: './bar.svelte',
      filename: path.join(directory, 'foo.svelte'),
      directory
    });
    const expected = path.join(directory, 'bar.svelte');

    expect(result).toBe(expected);
  });

  it('resolves a JS file from a Svelte component', () => {
    const result = cabinet.lookup({
      partial: './script.js',
      filename: path.join(directory, 'withJs.svelte'),
      directory
    });
    const expected = path.join(directory, 'script.js');

    expect(result).toBe(expected);
  });

  it('resolves a TS file from a Svelte component', () => {
    const result = cabinet.lookup({
      partial: './script.ts',
      filename: path.join(directory, 'withTs.svelte'),
      directory
    });
    const expected = path.join(directory, 'script.ts');

    expect(result).toBe(expected);
  });

  it('resolves a SCSS file from a Svelte component', () => {
    const result = cabinet.lookup({
      partial: './styles.scss',
      filename: path.join(directory, 'withStyles.svelte'),
      directory
    });
    const expected = path.join(directory, 'styles.scss');

    expect(result).toBe(expected);
  });

  it('returns empty string for a blank dependency', () => {
    const result = cabinet.lookup({
      partial: undefined,
      filename: path.join(directory, 'foo.svelte'),
      directory
    });

    expect(result).toBe('');
  });

  it('resolves a Stylus file from a Svelte component', () => {
    const stylusDirectory = fixtures('stylus');
    const result = cabinet.lookup({
      partial: './bar.styl',
      filename: path.join(stylusDirectory, 'foo.svelte'),
      directory: stylusDirectory
    });
    const expected = path.join(stylusDirectory, 'bar.styl');

    expect(result).toBe(expected);
  });

  it('uses typescript resolution for imports when tsConfig is provided', () => {
    const result = cabinet.lookup({
      partial: './script',
      filename: path.join(directory, 'foo.svelte'),
      directory,
      tsConfig: {
        compilerOptions: {}
      }
    });
    const expected = path.join(directory, 'script.ts');

    expect(result).toBe(expected);
  });
});

describe('Vue', () => {
  it('resolves a SCSS file from a Vue component', () => {
    const result = cabinet.lookup({
      partial: './styles.scss',
      filename: path.join(directory, 'foo.vue'),
      directory
    });
    const expected = path.join(directory, 'styles.scss');

    expect(result).toBe(expected);
  });
});
