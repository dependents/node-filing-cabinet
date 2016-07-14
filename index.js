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
var fileExists = require('file-exists');

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
  var configPath = options.configPath;

  var ext = path.extname(filename);

  var resolver = defaultLookups[ext];

  if (!resolver) {
    debug('using generic resolver');
    resolver = resolveDependencyPath;
  }

  debug('found a resolver for ' + ext);

  // TODO: Change all resolvers to accept an options argument
  var result = resolver(partial, filename, directory, config, webpackConfig, configPath);

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
function jsLookup(partial, filename, directory, config, webpackConfig, configPath) {
  var type = module.exports._getJSType(config, webpackConfig, filename);

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
      debug('using generic resolver for es6');
      var result = resolveDependencyPath(partial, filename, directory);
      debug('es6 resolver result: ' + result);
      // For codebases transpiling es6 to commonjs
      // es6 to amd transpilation would have picked up a require config
      if (!fileExists(result)) {
        debug('es6 result was not a real file');
        debug('trying commonjs resolver');
        result = commonJSLookup(partial, filename, directory);
      }

      return result;
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
    var aliases = loadedConfig.resolve ? loadedConfig.resolve.alias : [];

    var resolver = webpackResolve.create.sync({
      alias: aliases
    });

    // We don't care about what the loader resolves the partial to
    // we only wnat the path of the resolved file
    partial = stripLoader(partial);
    var resolvedPath = resolver(directory, partial);

    return resolvedPath;

  } catch (e) {
    debug('error loading the webpack config at ' + webpackConfig);
    debug(e.message);
    debug(e.stack);
  }

  return '';
}

function stripLoader(partial) {
  var exclamationLocation = partial.indexOf('!');

  if (exclamationLocation === -1) { return partial; }

  return partial.slice(exclamationLocation + 1);
}
