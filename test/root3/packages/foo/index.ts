/* The module name can be just './hello'.
But '#foo/hello' is demonstration of "Path Mapping" of `tsconfig`
and "Subpath imports"(defined in package.json's `imports` field) of node.js */
import { hello } from "#foo/hello";
// import { hello } from './hello' => this will work, too
// import { hello } from '@monorepo/foo/hello' // => this will not work for tsc, without additional configuration on tsconfig.json

hello("world");

export const doubleNumbers = (data: number[]) => data.map((i) => i * 2);
