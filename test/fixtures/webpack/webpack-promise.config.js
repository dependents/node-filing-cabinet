module.exports = Promise.resolve({
  entry: './index.js',
  resolve: {
    alias: {
      R: './node_modules/resolve'
    }
  }
});
