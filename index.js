var path = require('path');
var debug = require('debug')('cabinet');

var getModuleType = require('module-definition');
var resolve = require('resolve');

var amdLookup = require('module-lookup-amd');
var stylusLookup = require('stylus-lookup');
var sassLookup = require('sass-lookup');

var resolveDependencyPath = require('resolve-dependency-path');
var appModulePath = require('app-module-path');
var webpackResolve = require('enhanced-resolve');
var isRelative = require('is-relative-path');
var objectAssign = require('object-assign');

var defaultLookups = {
  '.js': jsLookup,
  '.jsx': jsLookup,
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
  var webpackConfig = options.webpackConfig;
  var configPath = options.configPath;
  var ast = options.ast;

  var ext = path.extname(filename);

  var resolver = defaultLookups[ext];

  if (!resolver) {
    debug('using generic resolver');
    resolver = resolveDependencyPath;
  }

  debug('found a resolver for ' + ext);

  // TODO: Change all resolvers to accept an options argument
  var result = resolver(partial, filename, directory, config, webpackConfig, configPath, ast);

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
 * @param  {Object} [ast]
 * @return {String}
 */
function jsLookup(partial, filename, directory, config, webpackConfig, configPath, ast) {
  var type = module.exports._getJSType({
    config: config,
    webpackConfig: webpackConfig,
    filename: filename,
    ast: ast
  });

  switch (type) {
    case 'amd':
      debug('using amd resolver');
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
      return commonJSLookup(partial, filename, directory);

    case 'webpack':
      debug('using webpack resolver for es6');
      return resolveWebpackPath(partial, filename, directory, webpackConfig);

    case 'es6':
    default:
      debug('using commonjs resolver for es6');
      return commonJSLookup(partial, filename, directory);
  }
}

/**
 * TODO: Export to a separate module
 *
 * @private
 * @param  {String} partial
 * @param  {String} filename
 * @param  {String} directory
 * @return {String}
 */
function commonJSLookup(partial, filename, directory) {
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

  try {
    result = resolve.sync(partial, {
      basedir: directory,
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
  webpackConfig = path.resolve(webpackConfig);

  try {
    var loadedConfig = require(webpackConfig);
  } catch (e) {
    debug('error loading the webpack config at ' + webpackConfig);
    debug(e.message);
    debug(e.stack);
    return '';
  }

  var resolveConfig = objectAssign({}, loadedConfig.resolve);

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
