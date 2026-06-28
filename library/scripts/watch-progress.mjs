import { statSync, existsSync } from 'node:fs';

const files = [
  { name: 'Naibod', path: 'library/shelves/naibod-enarratio.txt', expectedSize: 1100000, finished: false }, 
  { name: 'Dariot', path: 'library/shelves/dariot-ad-astrorum.txt', expectedSize: 178053, finished: true },
  { name: 'Alchabitius', path: 'library/shelves/alchabitius-libellus.txt', expectedSize: 193800, finished: true }
];

function drawBar(percent, width = 40) {
  const filled = Math.min(width, Math.max(0, Math.floor((percent / 100) * width)));
  const empty = width - filled;
  return `[${'='.repeat(filled)}${' '.repeat(empty)}]`;
}

console.clear();
console.log('=== Bibliotheca OCR Progress Monitor ===\n');

setInterval(() => {
  process.stdout.write('\x1B[3;1H'); // Move cursor to line 3
  
  for (const file of files) {
    let size = 0;
    if (existsSync(file.path)) {
      size = statSync(file.path).size;
    }
    
    // Estimate progress based on typical OCR text size per page 
    // (We don't know total pages exactly here, so we use an estimate)
    // For Naibod ~200 pages, Alchabitius ~400 pages, Dariot ~180 pages
    let percent = (size / file.expectedSize) * 100;
    if (file.finished) percent = 100;
    else if (percent > 99) percent = 99; // Cap at 99% until fully done
    
    const kb = (size / 1024).toFixed(1).padStart(6, ' ');
    console.log(`${file.name.padEnd(12)} ${drawBar(percent)} ${percent.toFixed(1).padStart(5)}% (${kb} KB)`);
  }
  console.log('\n(Press Ctrl+C to exit)');
}, 1000);
