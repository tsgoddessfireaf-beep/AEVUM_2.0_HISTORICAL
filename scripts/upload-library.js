import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shelvesDir = path.join(__dirname, '../library/shelves');

// Set emulator host env var so the Admin SDK connects to the local Storage emulator
process.env.FIREBASE_STORAGE_EMULATOR_HOST = '127.0.0.1:9199';

admin.initializeApp({
  projectId: 'flutter-ai-playground-f880c',
  storageBucket: 'flutter-ai-playground-f880c.appspot.com'
});

const bucket = admin.storage().bucket();

async function uploadLibrary() {
  console.log('Uploading library files to Storage emulator...');
  const files = fs.readdirSync(shelvesDir);
  
  for (const file of files) {
    if (file.endsWith('.txt')) {
      const localPath = path.join(shelvesDir, file);
      const destination = `library/${file}`;
      
      console.log(`Uploading ${file} -> ${destination}`);
      await bucket.upload(localPath, {
        destination,
        metadata: {
          contentType: 'text/plain',
        }
      });
    }
  }
  console.log('Library upload complete.');
}

uploadLibrary().catch(e => {
  console.error('Error uploading library:', e);
  process.exit(1);
});
