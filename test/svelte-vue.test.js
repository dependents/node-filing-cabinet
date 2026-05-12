import { strict as assert } from 'node:assert';
import path from 'node:path';
import cabinet from '../index.js';
import { fixtures } from './helpers.js';

const directory = fixtures('svelte');

describe('Svelte', () => {
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
      tsConfig: {
        compilerOptions: {}
      }
    });
    const expected = path.join(directory, 'script.ts');

    assert.equal(result, expected);
  });
});

describe('Vue', () => {
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
