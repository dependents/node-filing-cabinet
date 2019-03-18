'use strict';

const path = require('path');
const debug = require('debug')('cabinet');
const fs = require('fs');

/*
 * most js resolver are lazy-loaded (only required when needed)
 * e.g. dont load requirejs when we only have commonjs modules to resolve
 * this makes testing your code using this lib much easier
 */

let getModuleType;
let resolve;

let amdLookup;
const stylusLookup = require('stylus-lookup');
const sassLookup = require('sass-lookup');
let ts;

let resolveDependencyPath;
const appModulePath = require('app-module-path');
let webpackResolve;
const isRelative = require('is-relative-path');

const defaultLookups = {
  '.js': jsLookup,
  '.jsx': jsLookup,
  '.ts': tsLookup,
  '.tsx': tsLookup,
  '.scss': sassLookup,
  '.sass': sassLookup,
  '.styl': stylusLookup,
  // Less and Sass imports are very similar
  '.less': sassLookup
};

/**
 * @param {Object} options
 * @param {String} options.partial The dependency being looked up
 * @param {String} options.filename The file that contains the dependency being looked up
 * @param {String|Object} [options.config] Path to a requirejs config
 * @param {String} [options.configPath] For AMD resolution, if the config is an object, this represents the location of the config file.
 * @param {Object} [options.nodeModulesConfig] Config for overriding the entry point defined in a package json file
 * @param {String} [options.nodeModulesConfig.entry] The new value for "main" in package json
 * @param {String} [options.webpackConfig] Path to the webpack config
 * @param {Object} [options.ast] A preparsed AST for the file identified by filename.
 * @param {Object} [options.tsconfig] Path to a typescript config file
 * @param {Object} [options.fileSystem] An alternative filesystem / fs implementation to use for locating files.
 */
module.exports = function cabinet(options) {
  const {
    partial,
    filename,
  } = options;

  options.fileSystem = options.fileSystem || fs;
  debug('Given filename: ' + filename);

  const ext = path.extname(filename);
  debug('which has the extension: ' + ext);

  let resolver = defaultLookups[ext];

  if (!resolver) {
    debug('using generic resolver');
    if (!resolveDependencyPath) {
      resolveDependencyPath = require('resolve-dependency-path');
    }

    resolver = resolveDependencyPath;
  }

  debug(`found a resolver for ${ext}`);

  options.dependency = partial;
  const result = resolver(options);

  debug(`resolved path for ${partial}: ${result}`);
  return result;
};

module.exports.supportedFileExtensions = Object.keys(defaultLookups);

/**
 * Register a custom lookup resolver for a file extension
 *
 * @param  {String} extension - The file extension that should use the resolver
 * @param  {Function} lookupStrategy - A resolver of partial paths
 */
module.exports.register = function(extension, lookupStrategy) {
  defaultLookups[extension] = lookupStrategy;

  if (!this.supportedFileExtensions.includes(extension)) {
    this.supportedFileExtensions.push(extension);
  }
};

/**
 * Exposed for testing
 *
 * @param  {Object} options
 * @param  {String} options.config
 * @param  {String} options.webpackConfig
 * @param  {String} options.filename
 * @param  {Object} options.ast
 * @return {String}
 */
module.exports._getJSType = function(options = {}) {
  if (!getModuleType) {
    getModuleType = require('module-definition');
  }

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
  // options.fileSystem will be supported after `module-definition` depedendency has this PR merged and is then consumed in package.json:
  // https://github.com/dependents/module-definition/pull/28
  return getModuleType.sync(options.filename, options);
};

/**
 * @private
 * @param {Object} options
 * @param  {String} options.dependency
 * @param  {String} options.filename
 * @param  {String} options.directory
 * @param  {String} [options.config]
 * @param  {String} [options.webpackConfig]
 * @param  {String} [options.configPath]
 * @param  {Object} [options.nodeModulesConfig]
 * @param  {Object} [options.ast]
 * @param  {Object} [options.fileSystem]
 * @return {String}
 */
function jsLookup({dependency, filename, directory, config, webpackConfig, configPath, nodeModulesConfig, ast, fileSystem}) {
  const type = module.exports._getJSType({
    config: config,
    webpackConfig: webpackConfig,
    filename: filename,
    ast: ast,
    fileSystem: fileSystem
  });

  switch (type) {
    case 'amd':
      debug('using amd resolver');
      if (!amdLookup) {
        amdLookup = require('module-lookup-amd');
      }

      return amdLookup({
        config: config,
        // Optional in case a pre-parsed config is being passed in
        configPath: configPath,
        partial: dependency,
        directory: directory,
        filename: filename,
        fileSystem: fileSystem
      });

    case 'commonjs':
      debug('using commonjs resolver');
      return commonJSLookup({dependency, filename, directory, nodeModulesConfig, fileSystem});

    case 'webpack':
      debug('using webpack resolver for es6');
      return resolveWebpackPath({dependency, filename, directory, webpackConfig});

    case 'es6':
    default:
      debug('using commonjs resolver for es6');
      return commonJSLookup({dependency, filename, directory, nodeModulesConfig, fileSystem});
  }
}

function tsLookup({dependency, filename, tsConfig, fileSystem}) {
  debug('performing a typescript lookup');

  const defaultTsConfig = {
    compilerOptions: {}
  };

  if (!ts) {
    ts = require('typescript');
  }

  debug('given typescript config: ', tsConfig);

  if (!tsConfig) {
    tsConfig = defaultTsConfig;
    debug('no tsconfig given, defaulting');

  } else if (typeof tsConfig === 'string') {
    debug('string tsconfig given, parsing');
    try {
      tsConfig = JSON.parse(fileSystem.readFileSync(tsConfig, 'utf8'));
      debug('successfully parsed tsconfig');
    } catch (e) {
      debug('could not parse tsconfig');
      throw new Error('could not read tsconfig');
    }
  }

  debug('processed typescript config: ', tsConfig);
  debug('processed typescript config type: ', typeof tsConfig);

  const {options} = ts.convertCompilerOptionsFromJson(tsConfig.compilerOptions);

  // Preserve for backcompat. Consider removing this as a breaking change.
  if (!options.module) {
    options.module = ts.ModuleKind.AMD;
  }

  var host = ts.createCompilerHost({});

  // Override host methods, to support finding files in provided fs.
  const isDirectory = dirPath => fileSystem.lstatSync(dirPath).isDirectory();
  const getDirectories = dirPath => fileSystem.readdirSync(dirPath).map(name => path.join(dirPath, name)).filter(isDirectory);
  const pathExists = filePath => fileSystem.existsSync(filePath);

  host.getDirectories = getDirectories;
  host.fileExists = pathExists;
  host.directoryExists = pathExists;

  debug('with options: ', options);

  const namedModule = ts.resolveModuleName(dependency, filename, options, host);
  let result = '';

  if (namedModule.resolvedModule) {
    result = namedModule.resolvedModule.resolvedFileName;
  } else {
    const suffix = '.d.ts';
    const lookUpLocations = namedModule.failedLookupLocations
      .filter((string) => string.endsWith(suffix))
      .map((string) => string.substr(0, string.length - suffix.length));

    result = lookUpLocations.find(ts.sys.fileExists) || '';
  }

  debug('result: ' + result);
  return result ? path.resolve(result) : '';
}

function commonJSLookup({dependency, filename, directory, nodeModulesConfig, fileSystem}) {
  if (!resolve) {
    resolve = require('resolve');
  }

  if (!dependency) {
    debug('blank dependency given. Returning early.');
    return '';
  }

  // Need to resolve partials within the directory of the module, not filing-cabinet
  const moduleLookupDir = path.join(directory, 'node_modules');

  debug('adding ' + moduleLookupDir + ' to the require resolution paths');

  appModulePath.addPath(moduleLookupDir);

  // Make sure the partial is being resolved to the filename's context
  // 3rd party modules will not be relative
  if (dependency[0] === '.') {
    dependency = path.resolve(path.dirname(filename), dependency);
  }

  let result = '';

  // Allows us to configure what is used as the "main" entry point
  function packageFilter(packageJson) {
    packageJson.main = packageJson[nodeModulesConfig.entry] ? packageJson[nodeModulesConfig.entry] : packageJson.main;
    return packageJson;
  }

  try {
    result = resolve.sync(dependency, {
      extensions: ['.js', '.jsx'],
      basedir: directory,
      packageFilter: nodeModulesConfig && nodeModulesConfig.entry ? packageFilter : undefined,
      // Add fileDir to resolve index.js files in that dir
      moduleDirectory: ['node_modules', directory],
      readFile: fileSystem.readFile,
      isFile: function isFile(file) {
          try {
            var stat = fileSystem.statSync(file);
          } catch (e) {
            if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')){
              return false;
            }
            throw e;
          }
          return stat.isFile() || stat.isFIFO();
      }
    });
    debug('resolved path: ' + result);
  } catch (e) {
    debug('could not resolve ' + dependency);
  }

  return result;
}

function resolveWebpackPath({dependency, filename, directory, webpackConfig}) {
  if (!webpackResolve) {
    webpackResolve = require('enhanced-resolve');
  }
  webpackConfig = path.resolve(webpackConfig);
  let loadedConfig;

  try {
    loadedConfig = require(webpackConfig);

    if (typeof loadedConfig === 'function') {
      loadedConfig = loadedConfig();
    }
  } catch (e) {
    debug('error loading the webpack config at ' + webpackConfig);
    debug(e.message);
    debug(e.stack);
    return '';
  }

  const resolveConfig = Object.assign({}, loadedConfig.resolve);

  if (!resolveConfig.modules && (resolveConfig.root || resolveConfig.modulesDirectories)) {
    resolveConfig.modules = [];

    if (resolveConfig.root) {
      resolveConfig.modules = resolveConfig.modules.concat(resolveConfig.root);
    }

    if (resolveConfig.modulesDirectories) {
      resolveConfig.modules = resolveConfig.modules.concat(resolveConfig.modulesDirectories);
    }
  }

  try {
    const resolver = webpackResolve.create.sync(resolveConfig);

    // We don't care about what the loader resolves the dependency to
    // we only wnat the path of the resolved file
    dependency = stripLoader(dependency);

    const lookupPath = isRelative(dependency) ? path.dirname(filename) : directory;

    return resolver(lookupPath, dependency);
  } catch (e) {
    debug('error when resolving ' + dependency);
    debug(e.message);
    debug(e.stack);
    return '';
  }
}

function stripLoader(dependency) {
  const exclamationLocation = dependency.indexOf('!');

  if (exclamationLocation === -1) { return dependency; }

  return dependency.slice(exclamationLocation + 1);
}
