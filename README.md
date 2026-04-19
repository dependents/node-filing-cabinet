# filing-cabinet

[![CI](https://img.shields.io/github/actions/workflow/status/dependents/node-filing-cabinet/ci.yml?branch=main&label=CI&logo=github)](https://github.com/dependents/node-filing-cabinet/actions/workflows/ci.yml?query=branch%3Amain)
[![npm version](https://img.shields.io/npm/v/filing-cabinet?logo=npm&logoColor=fff)](https://www.npmjs.com/package/filing-cabinet)
[![npm downloads](https://img.shields.io/npm/dm/filing-cabinet)](https://www.npmjs.com/package/filing-cabinet)

> Get the file associated with a dependency/partial's path

## Installation

```sh
npm install filing-cabinet
```

## Quick Start

```js
const path = require('path');
const cabinet = require('filing-cabinet');

const result = cabinet({
  // import Button from './button'
  partial: './button',
  filename: path.join(__dirname, 'src', 'app.js'),
  directory: __dirname
});

if (result) {
  console.log(result); // -> /absolute/path/to/src/button.js
} else {
  console.error('Dependency could not be resolved');
}
```

## API

| Member | Type | Description |
| --- | --- | --- |
| [`cabinet(options)`](#cabinetoptions) | `Function` | Resolve a dependency to an absolute path |
| [`cabinet.register(extension, resolver)`](#cabinetregisterextension-resolver) | `Function` | Register a custom resolver for a file extension |
| [`cabinet.unregister(extension)`](#cabinetunregisterextension) | `Function` | Remove a registered resolver |
| [`cabinet.getLookup(extension)`](#cabinetgetlookupextension) | `Function` | Get the resolver for a file extension |
| [`cabinet.supportedFileExtensions`](#cabinetsupportedfileextensions) | `string[]` | All currently registered file extensions |

### `cabinet(options)`

Resolves a dependency string from the context of a file.

**Returns:** `string` - absolute path to the resolved file, or an empty string if it could not be resolved.

#### Options

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `partial` | `string` | **Yes** | Dependency path to resolve |
| `directory` | `string` | **Yes** | Project root path used for resolution |
| `filename` | `string` | **Yes** | Path to the file containing `partial` |
| `ast` | `Object` | No | Pre-parsed AST for `filename` (avoids reparsing in JS module type detection) |
| `config` | `string \| Object` | No | **JS only.** RequireJS config (path or object) for AMD resolution |
| `configPath` | `string` | No | **JS only.** Path to the RequireJS config file when `config` is an object |
| `webpackConfig` | `string` | No | **JS only.** Webpack config path for webpack-style resolution; if the config exports an array, the first config is used |
| `nodeModulesConfig` | `Object \| Function` | No | Controls package entry selection when resolving from `node_modules` ([see examples below](#node-modules-config-examples)) |
| `nodeModulesConfig.entry` | `string` | No | Object form: field name to prefer instead of `main` (for example `module`) |
| `nodeModulesConfig` (function) | `Function` | No | Function form: custom [`resolve` packageFilter](https://github.com/browserify/resolve#resolveid-opts-cb) callback for full control of package entry selection |
| `tsConfig` | `string \| Object` | No | **TS only.** TypeScript config path or pre-parsed config object |
| `tsConfigPath` | `string` | No | **TS only.** (Virtual) path to tsconfig when `tsConfig` is an object; needed for [Path Mapping](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping) |
| `noTypeDefinitions` | `boolean` | No | **TS only.** Prefer `*.js` over `*.d.ts` when resolving TypeScript dependencies |

<a id="node-modules-config-examples"></a>

#### `nodeModulesConfig` examples

Object form - use a specific `package.json` field instead of `main`:

```js
cabinet({
  partial: 'some-package',
  filename: '/path/to/file.js',
  directory: '/path/to',
  nodeModulesConfig: { entry: 'module' }
});
```

Function form - full control via a custom `packageFilter`:

```js
cabinet({
  partial: 'some-package',
  filename: '/path/to/file.js',
  directory: '/path/to',
  nodeModulesConfig: (pkg) => {
    // prefer "module", fall back to "main"
    pkg.main = pkg.module ?? pkg.main;
    return pkg;
  }
});
```

### `cabinet.register(extension, resolver)`

Register a custom resolver for a file extension.

* `extension` - file extension to handle (for example `.py`, `.php`)
* `resolver` - function that receives the same `options` object passed to [`cabinet(options)`](#cabinetoptions) and returns the resolved absolute path, or an empty string

```js
cabinet.register('.py', (options) => {
  // resolve options.partial relative to options.filename
  return '/resolved/path/to/file.py';
});
```

For examples of resolver implementations, take a look at the built-in resolvers:

* [sass-lookup](https://github.com/dependents/node-sass-lookup)
* [stylus-lookup](https://github.com/dependents/node-stylus-lookup)
* [module-lookup-amd](https://github.com/dependents/node-module-lookup-amd)

If no resolver is registered for an extension, filing-cabinet falls back to a generic file resolver with extension defaulting behavior.

### `cabinet.unregister(extension)`

Remove the resolver registered for `extension`.

```js
cabinet.unregister('.py');
```

### `cabinet.getLookup(extension)`

Return the resolver function registered for `extension`, or `undefined` if none is registered.

```js
const resolver = cabinet.getLookup('.ts'); // built-in TypeScript resolver
```

### `cabinet.supportedFileExtensions`

A `string[]` of all currently registered file extensions. Updated automatically by `register()` and `unregister()`.

```js
console.log(cabinet.supportedFileExtensions);
// ['.js', '.jsx', '.less', '.sass', '.scss', '.styl', '.svelte', '.ts', '.tsx', '.vue']
```

## Supported Languages

By default, filing-cabinet supports:

* JavaScript (CommonJS, AMD, ES6)
* TypeScript
* Sass (`.scss`, `.sass`), Less (`.less`), and Stylus (`.styl`)
* Svelte
* Vue

## Package `#imports` Field

filing-cabinet automatically resolves [Node.js package `imports`](https://nodejs.org/api/packages.html#subpath-imports) (dependencies starting with `#`) for both JavaScript and TypeScript files. No extra configuration is needed.

## CLI

Install globally:

```sh
npm install -g filing-cabinet
```

Run:

```sh
filing-cabinet [options] <path>
```

Run `filing-cabinet --help` for full usage.

## License

[MIT](LICENSE)
