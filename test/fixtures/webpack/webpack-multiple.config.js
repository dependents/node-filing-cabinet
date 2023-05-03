module.exports = [
  {
    entry: "./index.js",
    resolve: {
      modulesDirectories: ['test/root1', 'node_modules'],
    }
  },
  {
    entry: "./index.js",
    resolve: {
      modulesDirectories: ['test/root2', 'node_modules'],
    }
  },
];