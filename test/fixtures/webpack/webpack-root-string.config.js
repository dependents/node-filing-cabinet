var path = require('path');

module.exports = {
  entry: "./index.js",
  resolve: {
    root: path.resolve(__dirname, './test/root2'),
  }
};
