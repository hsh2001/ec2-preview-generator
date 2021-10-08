#!/usr/bin/env node

const { argv } = process;

if (argv.includes('init')) {
  import('./init');
} else if (argv.includes('create')) {
  import('../scripts/create');
}
