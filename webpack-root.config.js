var path = require('path');

module.exports = {
  entry: "./index.js",
  resolve: {
    modulesDirectories: ['test/root1'],
    root: [
        path.resolve(__dirname, './test/root2')
    ]
  }
};