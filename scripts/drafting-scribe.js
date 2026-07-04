import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Anthropic from '@anthropic-ai/sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY not found. Skipping ARCHITECTURE.md update.');
    process.exit(0);
  }

  const anthropic = new Anthropic({ apiKey });

  // Get the last commit message and diff
  let gitInfo;
  try {
    gitInfo = execSync('git log -1 -p').toString();
  } catch (e) {
    console.error('Failed to retrieve git log:', e.message);
    process.exit(1);
  }

  const archPath = path.join(__dirname, '../ARCHITECTURE.md');
  let archContent = '';
  if (fs.existsSync(archPath)) {
    archContent = fs.readFileSync(archPath, 'utf8');
  } else {
    console.warn('ARCHITECTURE.md not found. A new one will be created.');
  }

  console.log('Sending request to Claude to update ARCHITECTURE.md...');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      system: "You are the Drafting Scribe for the Aevum codebase. Your job is to maintain the ARCHITECTURE.md documentation. You will receive the recent commit diff and the current ARCHITECTURE.md content. Update the ARCHITECTURE.md to accurately reflect any structural, logic, or architectural changes introduced in the commit. Output ONLY the complete updated markdown content of ARCHITECTURE.md. Do not include any chat formatting, introduction, or markdown code block wrapper.",
      messages: [
        {
          role: 'user',
          content: `Here is the current ARCHITECTURE.md:\n\n${archContent}\n\nHere is the recent commit diff:\n\n${gitInfo}`
        }
      ]
    });

    const updatedContent = response.content[0].text;
    if (updatedContent && updatedContent.trim()) {
      fs.writeFileSync(archPath, updatedContent, 'utf8');
      console.log('ARCHITECTURE.md successfully updated.');
    } else {
      console.warn('Received empty response from Claude. No changes made.');
    }
  } catch (e) {
    console.error('Error communicating with Anthropic API:', e.message);
    process.exit(1);
  }
}

main();
