'use strict';

const path = require('node:path');

const fixtures = (...parts) => path.join(__dirname, 'fixtures', ...parts);

module.exports = { fixtures };
