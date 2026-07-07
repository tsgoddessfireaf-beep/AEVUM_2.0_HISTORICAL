import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const functionsDir = path.join(__dirname, '../functions');
const serverDir = path.join(__dirname, '../server');

function cleanAndSync() {
  const items = [
    { name: 'lib', type: 'dir' },
    { name: 'routes', type: 'dir' },
    { name: 'index.js', type: 'file' }
  ];

  for (const item of items) {
    const dest = path.join(functionsDir, item.name);
    const src = path.join(serverDir, item.name);

    try {
      const stat = fs.lstatSync(dest);
      if (stat.isDirectory() || stat.isSymbolicLink()) {
        fs.rmSync(dest, { recursive: true, force: true });
      } else {
        fs.unlinkSync(dest);
      }
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }

    if (item.type === 'dir') {
      try {
        const linkType = process.platform === 'win32' ? 'junction' : 'dir';
        fs.symlinkSync(src, dest, linkType);
        console.log(`[sync-functions] Created symlink/junction for ${item.name}`);
      } catch (e) {
        let warningMsg = `[sync-functions] Failed to create symlink for ${item.name}, copying instead: ${e.message}`;
        if (process.platform === 'win32') {
          warningMsg += `\n[WARNING] On Windows, copying is a static fallback. If you modify any files in server/${item.name}, you must rerun this script to sync changes.`;
        }
        console.warn(warningMsg);
        fs.cpSync(src, dest, { recursive: true });
      }
    } else {
      try {
        fs.symlinkSync(src, dest, 'file');
        console.log(`[sync-functions] Created symlink for ${item.name}`);
      } catch (e) {
        let warningMsg = `[sync-functions] Failed to create symlink for ${item.name}, copying instead: ${e.message}`;
        if (process.platform === 'win32') {
          warningMsg += `\n[WARNING] On Windows, copying is a static fallback. If you modify server/${item.name}, you must rerun this script to sync changes.`;
        }
        console.warn(warningMsg);
        fs.copyFileSync(src, dest);
      }
    }
  }
}

cleanAndSync();
