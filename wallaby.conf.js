
module.exports = function (w) {

  return {
    files: [
      'index.js',
      'test/**/*.js?(x)',
      '!test/test.js'
    ],

    tests: [
      'test/test.js',
    ],

    env: {
      type: 'node'
    },

    // or any other supported testing framework:
    // https://wallabyjs.com/docs/integration/overview.html#supported-testing-frameworks
    testFramework: 'mocha'
  };
};