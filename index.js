var path = require('path');
var debug = require('debug')('cabinet');

/*
 * most js resolver are lazy-loaded (only required when needed)
 * e.g. dont load requirejs when we only have commonjs modules to resolve
 * this makes testing your code using this lib much easier
 */

var getModuleType;
var resolve;

var amdLookup;
var stylusLookup = require('stylus-lookup');
var sassLookup = require('sass-lookup');
var ts;

var resolveDependencyPath;
var appModulePath = require('app-module-path');
var webpackResolve;
var isRelative = require('is-relative-path');

var defaultLookups = {
  '.js': jsLookup,
  '.jsx': jsLookup,
  '.ts': tsLookup,
  '.scss': sassLookup,
  '.sass': sassLookup,
  '.styl': stylusLookup,
  // Less and Sass imports are very similar
  '.less': sassLookup
};

module.exports = function cabinet(options) {
  var partial = options.partial;
  var filename = options.filename;
  var directory = options.directory;
  var config = options.config;
  var nodeModulesConfig = options.nodeModulesConfig;
  var webpackConfig = options.webpackConfig;
  var configPath = options.configPath;
  var ast = options.ast;

  var ext = path.extname(filename);

  var resolver = defaultLookups[ext];

  if (!resolver) {
    debug('using generic resolver');
    if (!resolveDependencyPath) {
      resolveDependencyPath = require('resolve-dependency-path');
    }

    resolver = resolveDependencyPath;
  }

  debug('found a resolver for ' + ext);

  // TODO: Change all resolvers to accept an options argument
  var result = resolver(partial, filename, directory, config, webpackConfig, configPath, nodeModulesConfig, ast);

  debug('resolved path for ' + partial + ': ' + result);
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

  if (this.supportedFileExtensions.indexOf(extension) === -1) {
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
module.exports._getJSType = function(options) {
  if (!getModuleType) {
    getModuleType = require('module-definition');
  }

  options = options || {};

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
};

/**
 * @private
 * @param  {String} partial
 * @param  {String} filename
 * @param  {String} directory
 * @param  {String} [config]
 * @param  {String} [webpackConfig]
 * @param  {String} [configPath]
 * @param  {Object} [nodeModulesConfig]
 * @param  {Object} [ast]
 * @return {String}
 */
function jsLookup(partial, filename, directory, config, webpackConfig, configPath, nodeModulesConfig, ast) {
  var type = module.exports._getJSType({
    config: config,
    webpackConfig: webpackConfig,
    filename: filename,
    ast: ast
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
        partial: partial,
        directory: directory,
        filename: filename
      });

    case 'commonjs':
      debug('using commonjs resolver');
      return commonJSLookup(partial, filename, directory, nodeModulesConfig);

    case 'webpack':
      debug('using webpack resolver for es6');
      return resolveWebpackPath(partial, filename, directory, webpackConfig);

    case 'es6':
    default:
      debug('using commonjs resolver for es6');
      return commonJSLookup(partial, filename, directory, nodeModulesConfig);
  }
}

function tsLookup(partial, filename, directory) {
  debug('performing a typescript lookup');

  if (!ts) {
    ts = require('typescript');
  }

  var options = {
    module: ts.ModuleKind.AMD
  };

  var host = ts.createCompilerHost({});
  debug('with options: ', options);
  var resolvedModule = ts.resolveModuleName(partial, filename, options, host).resolvedModule;
  debug('ts resolved module: ', resolvedModule);
  var result = resolvedModule ? resolvedModule.resolvedFileName : '';

  debug('result: ' + result);
  return result ? path.resolve(result) : '';
}

/**
 * @private
 * @param  {String} partial
 * @param  {String} filename
 * @param  {String} directory
 * @return {String}
 */
function commonJSLookup(partial, filename, directory, nodeModulesConfig) {
  if (!resolve) {
    resolve = require('resolve');
  }
  // Need to resolve partials within the directory of the module, not filing-cabinet
  var moduleLookupDir = path.join(directory, 'node_modules');

  debug('adding ' + moduleLookupDir + ' to the require resolution paths');

  appModulePath.addPath(moduleLookupDir);

  // Make sure the partial is being resolved to the filename's context
  // 3rd party modules will not be relative
  if (partial[0] === '.') {
    partial = path.resolve(path.dirname(filename), partial);
  }

  var result = '';

  // Allows us to configure what is used as the "main" entry point
  function packageFilter(packageJson) {
    packageJson.main = packageJson[nodeModulesConfig.entry] ? packageJson[nodeModulesConfig.entry] : packageJson.main;
    return packageJson;
  }

  try {
    result = resolve.sync(partial, {
      extensions: ['.js', '.jsx'],
      basedir: directory,
      packageFilter: nodeModulesConfig && nodeModulesConfig.entry ? packageFilter : undefined,
      // Add fileDir to resolve index.js files in that dir
      moduleDirectory: ['node_modules', directory]
    });
    debug('resolved path: ' + result);
  } catch (e) {
    debug('could not resolve ' + partial);
  }

  return result;
}

function resolveWebpackPath(partial, filename, directory, webpackConfig) {
  if (!webpackResolve) {
    webpackResolve = require('enhanced-resolve');
  }
  webpackConfig = path.resolve(webpackConfig);

  try {
    var loadedConfig = require(webpackConfig);

    if (typeof loadedConfig === 'function') {
      loadedConfig = loadedConfig();
    }
  } catch (e) {
    debug('error loading the webpack config at ' + webpackConfig);
    debug(e.message);
    debug(e.stack);
    return '';
  }

  var resolveConfig = Object.assign({}, loadedConfig.resolve);

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
    var resolver = webpackResolve.create.sync(resolveConfig);

    // We don't care about what the loader resolves the partial to
    // we only wnat the path of the resolved file
    partial = stripLoader(partial);

    var lookupPath = isRelative(partial) ? path.dirname(filename) : directory;

    return resolver(lookupPath, partial);
  } catch (e) {
    debug('error when resolving ' + partial);
    debug(e.message);
    debug(e.stack);
    return '';
  }
}

function stripLoader(partial) {
  var exclamationLocation = partial.indexOf('!');

  if (exclamationLocation === -1) { return partial; }

  return partial.slice(exclamationLocation + 1);
}
