// Requires a plugin that only exists in the analyzed project's node_modules,
// not anywhere reachable from this config's own location.
require('fake-webpack-plugin');

module.exports = {
  resolve: {
    extensions: ['.js']
  }
};
