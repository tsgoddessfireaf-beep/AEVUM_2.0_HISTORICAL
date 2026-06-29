import fetch from 'node-fetch';

const HOSTING_URL = 'http://localhost:5000';
const FUNCTIONS_URL = 'http://localhost:5001/flutter-ai-playground-f880c/us-central1/api';
const STORAGE_URL = 'http://localhost:9199/v0/b/flutter-ai-playground-f880c.appspot.com/o';

async function verify() {
  console.log('=== Starting Emulator Verification ===\n');

  // 1. Check Hosting / API Health
  try {
    console.log(`Checking Hosting API health at ${HOSTING_URL}/api/health...`);
    const res = await fetch(`${HOSTING_URL}/api/health`);
    const data = await res.json();
    console.log('Result:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.log(`❌ Failed to connect to Hosting API: ${e.message}`);
  }

  // 2. Check Functions API Health directly
  try {
    console.log(`\nChecking Functions API health directly at ${FUNCTIONS_URL}/health...`);
    const res = await fetch(`${FUNCTIONS_URL}/health`);
    const data = await res.json();
    console.log('Result:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.log(`❌ Failed to connect to Functions API: ${e.message}`);
  }

  // 3. Check Storage Emulator for Library files
  try {
    console.log(`\nChecking Storage Emulator at ${STORAGE_URL}...`);
    const res = await fetch(`${STORAGE_URL}?prefix=library/`);
    const data = await res.json();
    if (data.items && data.items.length > 0) {
      console.log(`✅ Storage contains ${data.items.length} library files.`);
      console.log('Sample files:');
      data.items.slice(0, 5).forEach(item => console.log(`  - ${item.name}`));
    } else {
      console.log('⚠️ Storage emulator is running but library bucket is empty. Run upload script.');
    }
  } catch (e) {
    console.log(`❌ Failed to connect to Storage Emulator: ${e.message}`);
  }

  // 4. Check Firestore Emulator
  try {
    console.log(`\nChecking Firestore Emulator at http://localhost:8080...`);
    const res = await fetch('http://localhost:8080/');
    if (res.ok) {
      console.log('✅ Firestore emulator is responding.');
    } else {
      console.log(`⚠️ Firestore emulator responded with status: ${res.status}`);
    }
  } catch (e) {
    console.log(`❌ Failed to connect to Firestore Emulator: ${e.message}`);
  }

  console.log('\n=== Verification Complete ===');
}

verify().catch(console.error);
