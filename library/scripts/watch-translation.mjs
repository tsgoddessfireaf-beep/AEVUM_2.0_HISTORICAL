import { readFileSync, existsSync } from 'node:fs';

const tasks = [
  { 
    name: 'Dariot Trans', 
    logPath: 'C:\\Users\\tsgod\\.gemini\\antigravity-ide\\brain\\9fc04157-0d16-4ea1-b971-6c74f0c716d0\\.system_generated\\tasks\\task-738.log',
    total: 10
  },
  { 
    name: 'Alchab. Trans', 
    logPath: 'C:\\Users\\tsgod\\.gemini\\antigravity-ide\\brain\\9fc04157-0d16-4ea1-b971-6c74f0c716d0\\.system_generated\\tasks\\task-1160.log',
    total: 71
  },
  { 
    name: 'Naibod Trans', 
    logPath: 'C:\\Users\\tsgod\\.gemini\\antigravity-ide\\brain\\9fc04157-0d16-4ea1-b971-6c74f0c716d0\\.system_generated\\tasks\\task-1298.log',
    total: 157
  }
];

function drawBar(percent, width = 40) {
  const filled = Math.min(width, Math.max(0, Math.floor((percent / 100) * width)));
  const empty = width - filled;
  return `[${'='.repeat(filled)}${' '.repeat(empty)}]`;
}

console.clear();
console.log('=== Bibliotheca Translation Progress Monitor ===\n');

setInterval(() => {
  process.stdout.write('\x1B[3;1H'); 
  
  for (const task of tasks) {
    let completed = 0;
    let isDone = false;
    if (existsSync(task.logPath)) {
      const log = readFileSync(task.logPath, 'utf8');
      const matches = [...log.matchAll(/chunk (\d+)\/\d+:/g)];
      if (matches.length > 0) {
        completed = Math.max(...matches.map(m => parseInt(m[1], 10)));
      }
      if (log.includes('DONE:')) {
        isDone = true;
      }
    }
    
    let percent = isDone ? 100 : (completed / task.total) * 100;
    console.log(`${task.name.padEnd(14)} ${drawBar(percent)} ${percent.toFixed(1).padStart(5)}% (${isDone ? task.total : completed}/${task.total} Chunks)`);
  }
  console.log('\n(Press Ctrl+C to exit)');
}, 1000);
