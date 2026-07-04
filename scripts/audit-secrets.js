import fs from 'fs';
import path from 'path';

const SECRET_PATTERNS = [
  /sk-ant-sid\d+-[a-zA-Z0-9-_]{40,}/g, // Anthropic API Key (approximation)
  /sk-ant-[a-zA-Z0-9-_]{40,}/g,       // Anthropic API Key
  /sk_live_[a-zA-Z0-9]{24,}/g,         // Stripe Live Secret Key
  /AIzaSy[a-zA-Z0-9-_]{33}/g,          // Google/Firebase API Key
  /TEST_API_KEY=[a-zA-Z0-9-_]+/gi,     // Dummy test key
];

const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  '.venv',
  '.firebase',
  '.agents',
  '.claude',
  '.jules',
  'dist',
  'build'
];

function scanDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const fullPath = path.join(dir, file);
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch (e) {
      continue;
    }
    
    if (stat.isDirectory()) {
      if (EXCLUDED_DIRS.includes(file)) continue;
      scanDirectory(fullPath);
    } else if (stat.isFile()) {
      auditFile(fullPath);
    }
  }
}

function auditFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz', '.mp4', '.mp3', '.wav', '.webp'];
  if (binaryExtensions.includes(ext) || filePath.includes('package-lock.json')) {
    return;
  }

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return;
  }

  let modified = false;
  let newContent = content;

  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(newContent)) {
      newContent = newContent.replace(pattern, (match) => {
        console.log(`Found and redacting potential secret in: ${filePath}`);
        modified = true;
        if (match.startsWith('TEST_API_KEY=')) {
          return 'TEST_API_KEY=[REDACTED_SECRET]';
        }
        return '[REDACTED_SECRET]';
      });
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, newContent, 'utf8');
  }
}

const targetPath = process.argv[2] || process.cwd();
console.log(`Starting secrets audit in: ${targetPath}`);

let targetStat;
try {
  targetStat = fs.statSync(targetPath);
} catch (e) {
  console.error(`Error: path "${targetPath}" does not exist.`);
  process.exit(1);
}

if (targetStat.isFile()) {
  auditFile(targetPath);
} else if (targetStat.isDirectory()) {
  scanDirectory(targetPath);
} else {
  console.error('Invalid path type.');
  process.exit(1);
}

console.log('Secrets audit completed.');
