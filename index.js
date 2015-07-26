var path = require('path');
var debug = require('debug')('cabinet');

var getModuleType = require('module-definition');

var amdLookup = require('module-lookup-amd');
var stylusLookup = require('stylus-lookup');
var sassLookup = require('sass-lookup');
var resolveDependencyPath = require('resolve-dependency-path');
var assign = require('lodash.assign');

var defaultLookups = {};

module.exports = function(options) {
  // Lazy binding for test stubbing purposes
  defaultLookups = assign(defaultLookups, {
    '.js': jsLookup,
    '.scss': sassLookup,
    '.sass': sassLookup,
    '.styl': stylusLookup
  });

  var partial = options.partial;
  var filename = options.filename;
  var directory = options.directory;
  var config = options.config;

  var ext = path.extname(filename);

  var resolver = defaultLookups[ext];

  if (!resolver) {
    debug('using generic resolver');
    resolver = resolveDependencyPath;
  }

  debug('found a resolver for ' + ext);
  return resolver(partial, filename, directory, config);
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
 * @private
 * @param  {String} partial
 * @param  {String} filename
 * @param  {String} directory
 * @param  {String} config
 * @return {String}
 */
function jsLookup(partial, filename, directory, config) {
  var type = getModuleType.sync(filename);

  switch (type) {
    case 'amd':
      debug('using amd resolver');
      return amdLookup(config, partial, filename, directory)
    case 'commonjs':
      debug('using commonjs resolver');
      return commonJSLookup(partial);
    case 'es6':
    default:
      debug('using generic resolver for es6');
      return resolveDependencyPath(partial, filename, directory);
  }
}

/**
 * @private
 * @param  {String} partial
 * @return {String}
 */
function commonJSLookup(partial) {
  return require.resolve(partial);
}
