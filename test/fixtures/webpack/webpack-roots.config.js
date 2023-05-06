var path = require('path');

module.exports = {
  entry: "./index.js",
  resolve: {
    roots: [
        path.resolve(__dirname, './test/root2'),
        path.resolve(__dirname, './node_modules')
    ]
  }
};
