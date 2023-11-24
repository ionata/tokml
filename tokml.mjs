#!/usr/bin/env node

import tokml from './lib/index.js';
import rw from 'rw';
import minimist from 'minimist';
import path from 'node:path';

const __dirname = path.resolve(path.dirname(''));

const argv = minimist(process.argv.slice(2), {
  boolean: 'simplestyle',
});

if (process.stdin.isTTY && !argv._[0]) {
  process.stdout.write(rw.readFileSync(__dirname + '/HELP.md'));
  process.exit(1);
}

const input = rw.readFileSync(argv._.length ? argv._[0] : '/dev/stdin', 'utf8');
process.stdout.write(tokml(JSON.parse(input), argv));
