import { execSync } from 'child_process';
import path from 'path';

const pip = process.platform === 'win32'
  ? path.join('.venv', 'Scripts', 'pip')
  : path.join('.venv', 'bin', 'pip');

execSync(`${pip} install -r requirements.txt`, { stdio: 'inherit' });
