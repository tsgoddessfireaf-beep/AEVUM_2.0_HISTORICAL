#!/usr/bin/env node

/**
 * Cross-platform Python runner for the ephemeris service.
 * Finds the venv and runs the Python command regardless of OS.
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { platform } from 'os';

const isWindows = platform() === 'win32';
const venvDir = join(process.cwd(), '.venv');
const pythonBin = isWindows
  ? join(venvDir, 'Scripts', 'python.exe')
  : join(venvDir, 'bin', 'python');

if (!existsSync(pythonBin)) {
  console.error(`❌ Python venv not found at ${pythonBin}`);
  console.error('   Run: npm run install:all');
  process.exit(1);
}

const args = process.argv.slice(2);
const cmd = `"${pythonBin}" ${args.join(' ')}`;

try {
  execSync(cmd, { stdio: 'inherit', shell: true });
} catch (err) {
  process.exit(err.status || 1);
}
