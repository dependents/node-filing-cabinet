import fs from 'node:fs';
import path from 'node:path';
import { debuglog } from 'node:util';
import { createRequire } from 'node:module';
import appModulePath from 'app-module-path';
import sassLookup from 'sass-lookup';
import stylusLookup from 'stylus-lookup';
import { createMatchPath } from 'tsconfig-paths';

const require = createRequire(import.meta.url);
const debug = debuglog('cabinet');

/*
 * Most JS resolvers are lazy-loaded (only required when needed)
 * e.g. dont load requirejs when we only have commonjs modules to resolve
 * this makes testing your code using this lib much easier
 */

let getModuleType;
let resolve;
let enhancedResolve;
let amdLookup;
let ts;
let resolveDependencyPath;

const defaultLookups = {
  '.js': jsLookup,
  '.jsx': jsLookup,
  '.less': sassLookup, // Less and Sass imports are very similar
  '.sass': sassLookup,
  '.scss': sassLookup,
  '.styl': stylusLookup,
  '.svelte': sfcLookup,
  '.ts': tsLookup,
  '.tsx': tsLookup,
  '.vue': sfcLookup
};

/**
 * @param {Object} options
 * @param {string} options.partial The dependency being looked up
 * @param {string} options.filename The file that contains the dependency being looked up
 * @param {string|Object} [options.config] Path to a RequireJS config
 * @param {string} [options.configPath] For AMD resolution, if `config` is an object, this is the config file path.
 * @param {Object|Function} [options.nodeModulesConfig] Config for node_modules entry-point selection. The package.json `exports` field is always honored automatically. Object form: set `entry` to a field name to prefer over `main`. Function form: fallback callback for packages with no `exports` field that need custom package.json transforms; receives and must return the parsed package.json.
 * @param {string} [options.nodeModulesConfig.entry] Field name to use instead of `main` (for example, `module`).
 * @param {string} [options.webpackConfig] Path to the webpack config
 * @param {Object} [options.ast] A pre-parsed AST for the file identified by `filename`.
 * @param {string|Object} [options.tsConfig] Path to a TypeScript config or a pre-parsed TypeScript config object.
 * @param {string} [options.tsConfigPath] A (virtual) path to a TypeScript config file when `tsConfig` is an object. Needed to calculate [Path Mapping](https://www.typescriptlang.org/docs/handbook/module-resolution.html#path-mapping). If omitted in object mode, path mapping is ignored.
 * @param {boolean} [options.noTypeDefinitions] For TypeScript dependencies, whether to prefer `.js` over `.d.ts`.
 * @param {Object} [options.fileSystem] An alternative fs implementation to use for reading tsConfigPath.
 */
export default function cabinet(options = {}) {
  const { partial, filename } = options;
  const extension = path.extname(filename);

  debug(`filename: ${filename}, extension: ${extension}`);

  let resolver = defaultLookups[extension];
  if (!resolver) {
    debug('using generic resolver');
    resolveDependencyPath ||= require('resolve-dependency-path').default;
    resolver = resolveDependencyPath;
  }

  debug(`found a resolver for ${extension}`);

  options.dependency = partial;
  const result = resolver(options);

  debug(`resolved path for ${partial}: ${result}`);
  return result;
}

cabinet.supportedFileExtensions = Object.keys(defaultLookups);

/**
 * Get the lookup resolver for a given file extension
 *
 * @param {string} extension - The file extension whose resolver should be retrieved.
 * @returns {Function|undefined}
 */
cabinet.getLookup = function(extension) {
  return defaultLookups[extension];
};

/**
 * Register a custom lookup resolver for a file extension
 *
 * @param  {string} extension - The file extension that should use the resolver
 * @param  {Function} lookupStrategy - A resolver that accepts the options object used by `cabinet`
 */
cabinet.register = function(extension, lookupStrategy) {
  defaultLookups[extension] = lookupStrategy;

  if (!cabinet.supportedFileExtensions.includes(extension)) {
    cabinet.supportedFileExtensions.push(extension);
  }
};

/**
 * Unregister a custom lookup resolver for a file extension
 *
 * @param  {string} extension - The file extension whose resolver should be removed
 */
cabinet.unregister = function(extension) {
  delete defaultLookups[extension];
  cabinet.supportedFileExtensions = Object.keys(defaultLookups);
};

/**
 * @param  {Object} options
 * @param  {string} options.config
 * @param  {string} options.webpackConfig
 * @param  {string} options.filename
 * @param  {Object} options.ast
 * @return {'amd'|'webpack'|'commonjs'|'es6'|string}
 */
function getJSType(options = {}) {
  getModuleType ||= require('module-definition').default;

  if (options.config) {
    return 'amd';
  }

  if (options.webpackConfig) {
    return 'webpack';
  }

  if (options.ast) {
    debug('reusing the given ast');
    return getModuleType.fromSource(options.ast);
  }

  debug('using the filename to find the module type');
  return getModuleType.sync(options.filename);
}

const webpackResolverByConfig = new Map();
let compilerHost;

function getCompilerHost() {
  ts ||= require('typescript');
  compilerHost ||= ts.createCompilerHost({});
  return compilerHost;
}

function getCompilerOptionsFromTsConfig(tsConfig) {
  debug(`given typescript config: ${tsConfig}`);

  if (!tsConfig) {
    debug('no tsconfig given, defaulting');
    return {};
  }

  ts ||= require('typescript');
  let compilerOptions = {};

  if (typeof tsConfig === 'string') {
    debug('string tsconfig given, parsing');

    try {
      const tsParsedConfig = ts.readJsonConfigFile(tsConfig, ts.sys.readFile);
      compilerOptions = ts.parseJsonSourceFileConfigFileContent(
        tsParsedConfig,
        ts.sys,
        path.dirname(tsConfig)
      ).options;
      debug('successfully parsed tsconfig');
    } catch {
      debug('could not parse tsconfig');
      throw new Error('could not read tsconfig');
    }
  } else if ('compilerOptions' in tsConfig) {
    debug('raw tsconfig json given, parsing');
    compilerOptions = ts.convertCompilerOptionsFromJson(tsConfig.compilerOptions).options;
  } else {
    debug('parsed tsconfig given, plucking options');
    compilerOptions = tsConfig.options;
  }

  debug(`processed typescript config (${typeof tsConfig}): ${tsConfig}`);

  return compilerOptions;
}

/**
 * @private
 * @param  {Object} options
 * @param  {String} options.dependency
 * @param  {String} options.filename
 * @param  {String} options.directory
 * @param  {String} [options.config]
 * @param  {String} [options.webpackConfig]
 * @param  {String} [options.configPath]
 * @param  {Object} [options.nodeModulesConfig]
 * @param  {Object} [options.ast]
 * @return {String}
 */
function jsLookup(options) {
  const { dependency, filename, directory, config, webpackConfig, configPath, ast } = options;
  const type = getJSType({
    config,
    webpackConfig,
    filename,
    ast
  });

  switch (type) {
    case 'amd': {
      debug('using amd resolver');
      amdLookup ||= require('module-lookup-amd').default;

      return amdLookup({
        config,
        // Optional in case a pre-parsed config is being passed in
        configPath,
        partial: dependency,
        directory,
        filename
      });
    }

    case 'commonjs':
    case 'es6': {
      debug('using commonjs resolver for commonjs/es6');
      return commonJSLookup(options);
    }

    case 'webpack': {
      debug('using webpack resolver for es6');
      return resolveWebpackPath({
        dependency,
        filename,
        directory,
        webpackConfig
      });
    }

    default: {
      return commonJSLookup(options);
    }
  }
}

function resolveFromTsAliasPath(resolvedTsAliasPath, extensions, fileSystem) {
  const fsOpt = fileSystem || fs;
  let stat;

  try {
    // throwIfNoEntry: false avoids constructing an Error on every path-mapping miss;
    // the outer try/catch preserves the original behavior of swallowing all other OS errors.
    // TODO: Maybe revisit this in the future.
    stat = fsOpt.statSync(resolvedTsAliasPath, { throwIfNoEntry: false });
  } catch {}

  if (!stat) {
    // tsconfig-paths returns an extensionless path when path.{extension} exists; recover it
    for (const extension of extensions) {
      const withExt = resolvedTsAliasPath + extension;
      if (fsOpt.existsSync(withExt)) return withExt;
    }
    /* c8 ignore next 3 */

    return '';
  }

  if (stat.isDirectory()) {
    // tsconfig-paths returns a directory path when directory/index.{extension} exists; resolve it
    for (const extension of extensions) {
      const indexFile = path.join(resolvedTsAliasPath, `index${extension}`);
      if (fsOpt.existsSync(indexFile)) return indexFile;
    }
    /* c8 ignore next 3 */

    return '';
  }

  return resolvedTsAliasPath;
}

function tsLookup({ dependency, filename, directory, webpackConfig, tsConfig, tsConfigPath, noTypeDefinitions, fileSystem }) {
  debug('performing a typescript lookup');

  // Handle #hash imports via package.json imports field
  if (dependency && dependency.startsWith('#')) {
    debug('using hash import resolver');
    const hashResult = resolveHashImport(dependency, filename);
    if (hashResult) return hashResult;
  }

  if (typeof tsConfig === 'string') {
    tsConfigPath ||= path.dirname(tsConfig);
  }

  if (!tsConfig && webpackConfig) {
    debug('using webpack resolver for typescript');
    return resolveWebpackPath({
      dependency,
      filename,
      directory,
      webpackConfig
    });
  }

  const compilerOptions = getCompilerOptionsFromTsConfig(tsConfig);
  const host = getCompilerHost();

  debug('with options: %o', compilerOptions);

  const namedModule = ts.resolveModuleName(dependency, filename, compilerOptions, host);
  let result = '';

  if (namedModule.resolvedModule) {
    result = namedModule.resolvedModule.resolvedFileName;

    if (namedModule.resolvedModule.extension === '.d.ts' && noTypeDefinitions) {
      const resolvedFileNameWithoutExtension = result.slice(
        0,
        -namedModule.resolvedModule.extension.length
      );
      try {
        result = ts.resolveJSModule(resolvedFileNameWithoutExtension, path.dirname(filename), host);
      } catch(error) {
        debug(`ts.resolveJSModule threw an Error: ${error.message}`);
      }
    }
  } else {
    const suffix = '.d.ts';
    const lookUpLocations = (namedModule.failedLookupLocations ?? [])
      .filter(string => string.endsWith(suffix))
      .map(string => string.slice(0, -suffix.length));

    result = lookUpLocations.find(location => ts.sys.fileExists(location)) || '';
  }

  if (!result && tsConfigPath && compilerOptions.baseUrl && compilerOptions.paths) {
    const extensions = ['.ts', '.tsx', '.d.ts', '.js', '.jsx', '.json', '.node'];

    const absoluteBaseUrl = path.join(path.dirname(tsConfigPath), compilerOptions.baseUrl);
    // Get absolute path by ts path mapping. `undefined` if non-existent
    // REF: https://github.com/jonaskello/tsconfig-paths#creatematchpath
    const tsMatchPath = createMatchPath(absoluteBaseUrl, compilerOptions.paths);
    const resolvedTsAliasPath = tsMatchPath(dependency, undefined, undefined, extensions);

    if (resolvedTsAliasPath) {
      result = resolveFromTsAliasPath(resolvedTsAliasPath, extensions, fileSystem);
    }
  }

  debug(`result: ${result}`);
  return result ? path.resolve(result) : '';
}

function commonJSLookup(options) {
  const { filename, directory, nodeModulesConfig, tsConfig } = options;
  let { dependency } = options;

  if (!dependency) {
    debug('blank dependency given. Returning early.');
    return '';
  }

  // Handle #hash imports via package.json imports field
  if (dependency.startsWith('#')) {
    debug('using hash import resolver');
    const hashResult = resolveHashImport(dependency, filename);
    if (hashResult) return hashResult;
  }

  // Need to resolve partials within the directory of the module, not filing-cabinet
  const moduleLookupDir = path.join(directory, 'node_modules');

  debug(`adding ${moduleLookupDir} to the require resolution paths`);

  appModulePath.addPath(moduleLookupDir);

  // Make sure the partial is being resolved to the filename's context
  // 3rd party modules will not be relative
  if (isRelativePath(dependency)) {
    dependency = path.resolve(path.dirname(filename), dependency);
  }

  const tsCompilerOptions = getCompilerOptionsFromTsConfig(tsConfig);
  const allowMixedJsAndTs = tsCompilerOptions.allowJs;
  let extensions = ['.js', '.jsx', '.json', '.mjs', '.cjs'];
  let result = '';

  if (allowMixedJsAndTs) {
    // Let the typescript engine take a stab at resolving this one. This lookup will
    // respect any custom paths in tsconfig.json
    result = tsLookup(options);
    if (result) {
      debug(`typescript successfully resolved commonjs module: ${result}`);
      return result;
    }

    // Otherwise, let the commonJS resolver look for plain .ts file imports.
    extensions = [...extensions, '.ts', '.tsx'];
  }

  const mainFields = nodeModulesConfig?.entry ? [nodeModulesConfig.entry, 'main'] : ['main'];

  enhancedResolve ||= require('enhanced-resolve');

  try {
    const resolver = enhancedResolve.create.sync({
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions,
      mainFields,
      modules: ['node_modules', directory]
    });
    result = resolver(path.dirname(filename), dependency);
    debug(`resolved path: ${result}`);
  } catch {
    debug(`could not resolve ${dependency}`);

    // For custom packageFilter functions, fall back to resolve which supports them.
    // enhanced-resolve has no equivalent hook for arbitrary package.json transforms.
    if (typeof nodeModulesConfig === 'function') {
      resolve ||= require('resolve');
      try {
        result = resolve.sync(dependency, {
          extensions,
          basedir: path.dirname(filename),
          packageFilter: nodeModulesConfig,
          // Add fileDir to resolve index.js files in that dir
          moduleDirectory: ['node_modules', directory]
        });
        debug(`resolved path via custom filter: ${result}`);
      } catch {
        debug(`could not resolve ${dependency}`);
      }
    } else {
      // A package's exports field can gate off a subpath that exists on disk.
      // Retry without exports so those still resolve.
      // TODO: drop this fallback in the next major and honor exports strictly, like Node.js
      try {
        const resolver = enhancedResolve.create.sync({
          exportsFields: [],
          conditionNames: ['import', 'require', 'node', 'default'],
          extensions,
          mainFields,
          modules: ['node_modules', directory]
        });
        result = resolver(path.dirname(filename), dependency);
        debug(`resolved path ignoring exports: ${result}`);
      } catch {
        debug(`could not resolve ${dependency}`);
      }
    }
  }

  return result;
}

function sfcLookup(options) {
  const { dependency } = options;

  if (!dependency) {
    debug('blank dependency given. Returning early.');
    return '';
  }

  if (dependency.endsWith('.js') || dependency.endsWith('.jsx')) {
    return jsLookup(options);
  }

  if (dependency.endsWith('.ts') || dependency.endsWith('.tsx')) {
    return tsLookup(options);
  }

  if (dependency.endsWith('.scss') || dependency.endsWith('.sass') || dependency.endsWith('.less')) {
    return sassLookup(options);
  }

  if (dependency.endsWith('.styl')) {
    return stylusLookup(options);
  }

  if (options.tsConfig || options.tsConfigPath) {
    return tsLookup(options);
  }

  return jsLookup(options);
}

function resolveWebpackPath({ dependency, filename, directory, webpackConfig }) {
  enhancedResolve ||= require('enhanced-resolve');

  webpackConfig = path.resolve(webpackConfig);
  let resolver = webpackResolverByConfig.get(webpackConfig);
  let resolveConfig;

  if (!resolver) {
    let loadedConfig;

    try {
      loadedConfig = require(webpackConfig);

      if (typeof loadedConfig === 'function') {
        loadedConfig = loadedConfig();
      }

      // Webpack 2+ allows Promise exports; we're synchronous so bail out gracefully.
      if (loadedConfig && typeof loadedConfig.then === 'function') {
        debug(`webpack config at ${webpackConfig} exports a Promise, which is not supported in synchronous mode`);
        return '';
      }

      if (Array.isArray(loadedConfig)) {
        loadedConfig = loadedConfig[0];
      }
    } catch(error) {
      debug(`error loading the webpack config at ${webpackConfig}:\n${error.stack}`);
      return '';
    }

    resolveConfig = { ...loadedConfig.resolve };

    if (!resolveConfig.modules && (resolveConfig.root || resolveConfig.roots || resolveConfig.modulesDirectories)) {
      resolveConfig.modules = [];

      // `resolve.root` is a string, it may be used in webpack 1.x.
      // here: https://github.com/webpack/webpack/issues/472#issuecomment-166946925
      if (typeof resolveConfig.root === 'string') {
        resolveConfig.modules = [...resolveConfig.modules, resolveConfig.root];
      }

      if (Array.isArray(resolveConfig.root)) {
        resolveConfig.modules = [...resolveConfig.modules, ...resolveConfig.root];
      }

      // https://webpack.js.org/configuration/resolve/#resolveroots
      if (Array.isArray(resolveConfig.roots)) {
        resolveConfig.modules = [...resolveConfig.modules, ...resolveConfig.roots];
      }

      if (resolveConfig.modulesDirectories) {
        resolveConfig.modules = [
          ...resolveConfig.modules,
          ...resolveConfig.modulesDirectories
        ];
      }
    }
  }

  try {
    if (!resolver) {
      resolver = enhancedResolve.create.sync(resolveConfig);
      webpackResolverByConfig.set(webpackConfig, resolver);
    }

    // We don't care about what the loader resolves the dependency to
    // we only want the path of the resolved file
    dependency = stripLoader(dependency);

    const lookupPath = isRelativePath(dependency) ? path.dirname(filename) : directory;

    return resolver(lookupPath, dependency);
  } catch(error) {
    debug(`error when resolving ${dependency}:\n${error.stack}`);
    return '';
  }
}

function stripLoader(dependency) {
  const exclamationLocation = dependency.indexOf('!');

  if (exclamationLocation === -1) return dependency;

  return dependency.slice(exclamationLocation + 1);
}

// Source: https://github.com/mrjoelkemp/is-relative-path/blob/v1.0.2/index.js
/**
 * @param  {String}  filename
 * @return {Boolean}
 */
function isRelativePath(filename) {
  if (typeof filename !== 'string') {
    throw new TypeError(`Path must be a string. Received ${filename}`);
  }

  return filename[0] === '.';
}

// Hash import resolution for package.json "imports" field using enhanced-resolve
function resolveHashImport(dependency, filename) {
  debug(`resolving hash import: ${dependency} from ${filename}`);

  enhancedResolve ||= require('enhanced-resolve');

  try {
    const resolver = enhancedResolve.create.sync({
      importsFields: ['imports'],
      conditionNames: ['import', 'require', 'node', 'default'],
      extensions: ['.js', '.ts', '.tsx', '.jsx', '.mjs', '.cjs', '.json']
    });

    const result = resolver(path.dirname(filename), dependency);
    debug(`hash import resolved: ${result}`);

    return result;
  } catch(error) {
    debug(`could not resolve hash import ${dependency}: ${error.message}`);

    return '';
  }
}
