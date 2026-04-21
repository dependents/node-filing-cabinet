#!/usr/bin/env node

'use strict';

const { program } = require('commander');
const cabinet = require('../index.js');
const { name, description, version } = require('../package.json');

program
  .name(name)
  .description(description)
  .version(version)
  .argument('<path>', 'dependency path to resolve')
  .option('-f, --filename <path>', 'file containing the dependency')
  .option('-d, --directory <path>', 'project root used for resolution')
  .option('-c, --config [path]', 'RequireJS config file (AMD resolution)')
  .option('-w, --webpack-config [path]', 'Webpack config file')
  .option('-t, --ts-config [path]', 'TypeScript config file')
  .showHelpAfterError()
  .parse();

const partial = program.args[0];
const { filename, directory, config, webpackConfig, tsConfig } = program.opts();

const result = cabinet({
  partial,
  filename,
  directory,
  config,
  webpackConfig,
  tsConfig
});

console.log(result);
