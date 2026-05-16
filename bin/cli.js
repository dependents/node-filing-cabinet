#!/usr/bin/env node

import { program } from 'commander';
import Cabinet from '../index.js';
import pkg from '../package.json' with { type: 'json' };

const { name, description, version } = pkg;

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

const cabinet = new Cabinet();
const result = cabinet.lookup({
  partial,
  filename,
  directory,
  config,
  webpackConfig,
  tsConfig
});

console.log(result);
