var path = require('path');
var debug = require('debug')('cabinet');

var getModuleType = require('module-definition');
var isRelative = require('is-relative-path');
var resolve = require('resolve');

var amdLookup = require('module-lookup-amd');
var stylusLookup = require('stylus-lookup');
var sassLookup = require('sass-lookup');
var resolveDependencyPath = require('resolve-dependency-path');

var appModulePath = require('app-module-path');
var assign = require('object-assign');

var webpackResolve = require('enhanced-resolve');

var defaultLookups = {};

module.exports = function(options) {
  // Lazy binding for test stubbing purposes
  assign(defaultLookups, {
    '.js': jsLookup,
    '.scss': sassLookup,
    '.sass': sassLookup,
    '.styl': stylusLookup
  });

  var partial = options.partial;
  var filename = options.filename;
  var directory = options.directory;
  var config = options.config;
  var webpackConfig = options.webpackConfig;

  var ext = path.extname(filename);

  var resolver = defaultLookups[ext];

  if (!resolver) {
    debug('using generic resolver');
    resolver = resolveDependencyPath;
  }

  debug('found a resolver for ' + ext);

  var result = resolver(partial, filename, directory, config, webpackConfig);

  // TODO: Remove. All resolvers should provide a complete path
  if (result && !path.extname(result)) {
    result = result + ext;
  }

  debug('resolved path for ' + partial + ': ' + result);
  return result;
};

/**
 * Register a custom lookup resolver for a file extension
 *
 * @param  {String} extension - The file extension that should use the resolver
 * @param  {Function} lookupStrategy - A resolver of partial paths
 */
module.exports.register = function(extension, lookupStrategy) {
  defaultLookups[extension] = lookupStrategy;
};

/**
 * Exposed for testing
 *
 * @param  {String} config
 * @param  {String} webpackConfig
 * @param  {String} filename
 * @return {String}
 */
module.exports._getJSType = function(config, webpackConfig, filename) {
  if (config) {
    return 'amd';
  }

  if (webpackConfig) {
    return 'webpack';
  }

  return getModuleType.sync(filename);
};

/**
 * @private
 * @param  {String} partial
 * @param  {String} filename
 * @param  {String} directory
 * @param  {String} config
 * @return {String}
 */
function jsLookup(partial, filename, directory, config, webpackConfig) {
  var type = module.exports._getJSType(config, webpackConfig, filename);

  switch (type) {
    case 'amd':
      debug('using amd resolver');
      return amdLookup({
        config: config,
        partial: partial,
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
      debug('using generic resolver for es6');
      return resolveDependencyPath(partial, filename, directory);
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
  if (isRelative(partial)) {
    partial = path.resolve(path.dirname(filename), partial);
  }

  var result = '';

  try {
    result = resolve.sync(partial, {basedir: path.dirname(filename)});
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
    var aliases = loadedConfig.resolve ? loadedConfig.resolve.alias : [];

    var resolver = webpackResolve.create.sync({
      alias: aliases
    });

    var resolvedPath = resolver(directory, partial);

    return resolvedPath;

  } catch (e) {
    debug('error loading the webpack config at ' + webpackConfig);
    debug(e.message);
    debug(e.stack);
  }

  return '';
}
