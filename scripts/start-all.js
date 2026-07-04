#!/usr/bin/env node

/**
 * Production startup script.
 * Runs ephemeris sidecar and Express server sequentially.
 * In production, use a process manager (PM2, systemd) to daemonize both.
 */

import { spawn } from 'child_process';
import { join } from 'path';
import { platform } from 'os';
import { fileURLToPath } from 'url';

const __dirname = join(fileURLToPath(import.meta.url), '..');

const isWindows = platform() === 'win32';
const venvDir = join(process.cwd(), 'ephemeris-service', '.venv');
const pythonBin = isWindows
  ? join(venvDir, 'Scripts', 'python.exe')
  : join(venvDir, 'bin', 'python');

console.log('🚀 Starting Aevum services...\n');

// Start ephemeris service
console.log('📍 Starting ephemeris sidecar on port 8000...');
const ephemeris = spawn(pythonBin, ['-m', 'uvicorn', 'main:app', '--port', '8000'], {
  cwd: join(process.cwd(), 'ephemeris-service'),
  stdio: 'inherit',
  shell: isWindows,
});

ephemeris.on('error', (err) => {
  console.error('❌ Ephemeris service failed:', err.message);
  process.exit(1);
});

// Give ephemeris time to start
setTimeout(() => {
  console.log('\n🌐 Starting Express API on port 3001...');
  const server = spawn('npm', ['start'], {
    cwd: join(process.cwd(), 'server'),
    stdio: 'inherit',
    shell: isWindows,
  });

  server.on('error', (err) => {
    console.error('❌ Server failed:', err.message);
    ephemeris.kill();
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n⏹️  Shutting down...');
    server.kill();
    ephemeris.kill();
    process.exit(0);
  });
}, 2000);
