#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

// Get the project root (one level up from scripts/)
const projectRoot = path.join(__dirname, '..');

// Path to the TypeScript compiler
const tscPath = path.join(projectRoot, 'node_modules', 'typescript', 'lib', 'tsc.js');

// Path to tsconfig.json
const tsconfigPath = path.join(projectRoot, 'tsconfig.json');

// Run tsc with Node directly
const child = spawn(process.execPath, [tscPath, '-p', tsconfigPath], {
  stdio: 'inherit',
  cwd: projectRoot
});

child.on('close', (code) => {
  process.exit(code || 0);
});
