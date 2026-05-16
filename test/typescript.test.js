import fs from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  describe,
  it,
  expect,
  vi
} from 'vitest';
import Cabinet from '../index.js';
import { fixtures } from './helpers.js';

const directory = fixtures('ts');
const cabinet = new Cabinet();

describe('TypeScript', () => {
  it('resolves an import', () => {
    const result = cabinet.lookup({
      partial: './foo',
      filename: path.join(directory, 'index.ts'),
      directory
    });
    const expected = path.join(directory, 'foo.ts');

    expect(result).toBe(expected);
  });

  it('resolves the import within a tsx file', () => {
    const result = cabinet.lookup({
      partial: './foo',
      filename: path.join(directory, 'module.tsx'),
      directory
    });
    const expected = path.join(directory, 'foo.ts');

    expect(result).toBe(expected);
  });

  it('resolves the import of a file with type-definition', () => {
    const result = cabinet.lookup({
      partial: './withTypeDef',
      filename: path.join(directory, 'index.ts'),
      directory
    });
    const expected = path.join(directory, 'withTypeDef.d.ts');

    expect(result).toBe(expected);
  });

  it('returns an empty result for a non-existent partial', () => {
    const result = cabinet.lookup({
      partial: './barbar',
      filename: path.join(directory, 'index.ts'),
      directory
    });

    expect(result).toBe('');
  });

  it('resolves the module with both tsconfig and webpack config', () => {
    const result = cabinet.lookup({
      partial: './subdir',
      filename: path.join(directory, 'check-nested.ts'),
      directory,
      tsConfig: path.join(directory, '.tsconfigExtending'),
      webpackConfig: path.join(directory, 'webpack.config.js')
    });
    const expected = path.join(directory, 'subdir/index.tsx');

    expect(result).toBe(expected);
  });

  describe('noTypeDefinitions', () => {
    it('resolves the import of a file with type-definition to the JS file', () => {
      const result = cabinet.lookup({
        partial: './withTypeDef',
        filename: path.join(directory, '/index.ts'),
        directory,
        noTypeDefinitions: true
      });
      const expected = path.join(directory, 'withTypeDef.js');

      expect(result).toBe(expected);
    });

    it('resolves the import of a file with type-definition to the JS file using custom import paths', () => {
      const result = cabinet.lookup({
        partial: '@test/withTypeDef',
        filename: path.join(directory, './index.ts'),
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

      expect(result).toBe(expected);
    });

    it('still returns the .d.ts file if no JS file is found', () => {
      const result = cabinet.lookup({
        partial: './withOnlyTypeDef.d.ts',
        filename: path.join(directory, '/index.ts'),
        directory,
        noTypeDefinitions: true
      });
      const expected = path.join(directory, 'withOnlyTypeDef.d.ts');

      expect(result).toBe(expected);
    });

    it('strips only the trailing extension when a parent directory name also contains .d.ts', () => {
      const result = cabinet.lookup({
        partial: './dirWithDts.d.ts/inner',
        filename: path.join(directory, '/index.ts'),
        directory,
        noTypeDefinitions: true
      });
      const expected = path.join(directory, 'dirWithDts.d.ts/inner.js');

      expect(result).toBe(expected);
    });
  });

  describe('tsconfig', () => {
    it('resolves the module name with tsconfig as an object', async() => {
      const tsConfigPath = path.join(directory, '.tsconfig');
      const configContent = await readFile(tsConfigPath, 'utf8');
      const parsedConfig = JSON.parse(configContent);
      const result = cabinet.lookup({
        partial: './foo',
        filename: path.join(directory, 'index.ts'),
        directory,
        tsConfig: parsedConfig
      });
      const expected = path.join(directory, 'foo.ts');

      expect(result).toBe(expected);
    });

    it('finds import from child subdirectories when using node module resolution', () => {
      const result = cabinet.lookup({
        partial: './subdir',
        filename: path.join(directory, 'check-nested.ts'),
        directory,
        tsConfig: {
          compilerOptions: {
            module: 'commonjs',
            moduleResolution: 'node'
          }
        }
      });
      const expected = path.join(directory, '/subdir/index.tsx');

      expect(result).toBe(expected);
    });

    it('finds import from child subdirectories when using node module resolution in extended config', () => {
      const result = cabinet.lookup({
        partial: './subdir',
        filename: path.join(directory, 'check-nested.ts'),
        directory,
        tsConfig: path.join(directory, '.tsconfigExtending')
      });
      const expected = path.join(directory, '/subdir/index.tsx');

      expect(result).toBe(expected);
    });

    it('finds imports of non-typescript files', () => {
      const result = cabinet.lookup({
        partial: './image.svg',
        filename: path.join(directory, '/index.ts'),
        directory
      });
      const expected = path.join(directory, '/image.svg');

      expect(result).toBe(expected);
    });

    it('finds imports of non-existent typescript imports', () => {
      const result = cabinet.lookup({
        partial: 'virtual:test-virtual',
        filename: path.join(directory, '/index.ts'),
        directory
      });

      expect(result).toBe('');
    });

    it('finds imports of non-typescript files using custom import paths', () => {
      const result = cabinet.lookup({
        partial: '@shortcut/subimage.svg',
        filename: path.join(directory, '/index.ts'),
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

      expect(result).toBe(expected);
    });

    it('finds imports of non-typescript files from node_modules', () => {
      const result = cabinet.lookup({
        partial: 'image/npm-image.svg',
        filename: path.join(directory, 'index.ts'),
        directory,
        tsConfig: {
          compilerOptions: {
            moduleResolution: 'node'
          }
        }
      });
      const expected = path.join(directory, 'node_modules/image/npm-image.svg');

      expect(result).toBe(expected);
    });

    it('finds imports of typescript files from non-typescript files with allowJs option (#89)', () => {
      const result = cabinet.lookup({
        partial: './foo',
        filename: path.join(directory, '/bar.js'),
        directory,
        tsConfig: {
          compilerOptions: {
            allowJs: true
          }
        }
      });
      const expected = path.join(directory, '/foo.ts');

      expect(result).toBe(expected);
    });

    it('finds imports using custom import paths from javascript files with allowJs option', () => {
      const result = cabinet.lookup({
        partial: '@shortcut/subimage.svg',
        filename: path.join(directory, '/bar.js'),
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

      expect(result).toBe(expected);
    });

    it('returns empty string and extends to ts extensions when allowJs module is not found by typescript', () => {
      const result = cabinet.lookup({
        partial: './nonexistent-module',
        filename: path.join(directory, '/bar.js'),
        directory,
        tsConfig: {
          compilerOptions: {
            allowJs: true
          }
        }
      });

      expect(result).toBe('');
    });

    it('parses the tsconfig given as a string path', () => {
      const result = cabinet.lookup({
        partial: './foo',
        filename: path.join(directory, 'index.ts'),
        directory,
        tsConfig: path.join(directory, '.tsconfig')
      });
      const expected = path.join(directory, 'foo.ts');

      expect(result).toBe(expected);
    });

    it('throws when the tsconfig file cannot be read', () => {
      expect(() => {
        cabinet.lookup({
          partial: './foo',
          filename: path.join(directory, 'index.ts'),
          directory,
          tsConfig: path.join(directory, 'nonexistent-tsconfig.json')
        });
      }).toThrow(new Error('could not read tsconfig'));
    });
  });

  describe('path mapping', () => {
    const root3Dir = fixtures('root3');

    it('resolves a path using TypeScript path mapping', () => {
      const result = cabinet.lookup({
        partial: '#foo/hello',
        filename: path.join(root3Dir, 'packages/foo/index.ts'),
        directory: root3Dir,
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
        tsConfigPath: path.join(root3Dir, 'tsconfig.json')
      });
      const expected = path.join(root3Dir, 'packages/foo/hello.ts');

      expect(result).toBe(expected);
    });

    it('resolves a file import with explicit extension via path mapping using pre-parsed options object', () => {
      const result = cabinet.lookup({
        partial: '@monorepo/foo/hello.ts',
        filename: path.resolve(root3Dir, 'packages/bar/index.ts'),
        directory: root3Dir,
        tsConfig: {
          options: {
            baseUrl: 'packages',
            paths: {
              '@monorepo/*': ['*']
            }
          }
        },
        tsConfigPath: path.resolve(root3Dir, 'tsconfig.json')
      });
      const expected = path.resolve(root3Dir, 'packages/foo/hello.ts');

      expect(result).toBe(expected);
    });

    it('resolves a directory import via path mapping to its index file', () => {
      const result = cabinet.lookup({
        partial: '@monorepo/foo',
        filename: path.resolve(root3Dir, 'packages/bar/index.ts'),
        directory: root3Dir,
        tsConfig: {
          options: {
            baseUrl: 'packages',
            paths: {
              '@monorepo/*': ['*']
            }
          }
        },
        tsConfigPath: path.resolve(root3Dir, 'tsconfig.json')
      });
      const expected = path.resolve(root3Dir, 'packages/foo/index.ts');

      expect(result).toBe(expected);
    });

    describe('alternate fileSystem', () => {
      const tsConfig = {
        options: {
          baseUrl: 'packages',
          paths: { '@monorepo/*': ['*'] }
        }
      };
      const tsConfigPath = path.resolve(root3Dir, 'tsconfig.json');
      const filename = path.resolve(root3Dir, 'packages/bar/index.ts');

      it('uses the alternate fs for stat checks during path-mapping resolution', () => {
        const realFs = fs;
        const statSpy = vi.spyOn(realFs, 'statSync');
        const existsSpy = vi.spyOn(realFs, 'existsSync');

        const fakeFs = {
          statSync: statSpy,
          existsSync: existsSpy
        };

        try {
          const result = cabinet.lookup({
            partial: '@monorepo/foo/hello.ts',
            filename,
            directory: root3Dir,
            tsConfig,
            tsConfigPath,
            fileSystem: fakeFs
          });
          const expected = path.resolve(root3Dir, 'packages/foo/hello.ts');

          expect(result).toBe(expected);
          const wasCalled = statSpy.mock.calls.length > 0 || existsSpy.mock.calls.length > 0;
          expect(wasCalled).toBe(true);
        } finally {
          statSpy.mockRestore();
          existsSpy.mockRestore();
        }
      });

      it('falls back to real fs when fileSystem is not provided', () => {
        const result = cabinet.lookup({
          partial: '@monorepo/foo/hello.ts',
          filename,
          directory: root3Dir,
          tsConfig,
          tsConfigPath
        });
        const expected = path.resolve(root3Dir, 'packages/foo/hello.ts');

        expect(result).toBe(expected);
      });

      it('returns empty string when alternate fs reports the resolved alias path does not exist', () => {
        const fakeFs = {
          statSync: () => undefined,
          existsSync: () => false
        };

        const result = cabinet.lookup({
          partial: '@monorepo/foo/hello.ts',
          filename,
          directory: root3Dir,
          tsConfig,
          tsConfigPath,
          fileSystem: fakeFs
        });

        expect(result).toBe('');
      });
    });

    describe('package.json imports field', () => {
      const importsDir = fixtures('ts/imports');

      it('resolves a simple #hash import from a .ts file', () => {
        const result = cabinet.lookup({
          partial: '#utils',
          filename: path.join(importsDir, 'src/utils.ts'),
          directory: importsDir
        });
        const expected = path.join(importsDir, 'src/utils.ts');

        expect(result).toBe(expected);
      });

      it('resolves a wildcard #hash import to a .tsx file', () => {
        const result = cabinet.lookup({
          partial: '#lib/button',
          filename: path.join(importsDir, 'src/utils.ts'),
          directory: importsDir
        });
        const expected = path.join(importsDir, 'src/button.tsx');

        expect(result).toBe(expected);
      });

      it('resolves a conditional #hash import (prefers import over default)', () => {
        const result = cabinet.lookup({
          partial: '#config',
          filename: path.join(importsDir, 'src/utils.ts'),
          directory: importsDir
        });
        const expected = path.join(importsDir, 'src/config-esm.ts');

        expect(result).toBe(expected);
      });

      it('returns empty string for unresolved #hash import', () => {
        const result = cabinet.lookup({
          partial: '#nonexistent',
          filename: path.join(importsDir, 'src/utils.ts'),
          directory: importsDir
        });

        expect(result).toBe('');
      });
    });
  });
});
