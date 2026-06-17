import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config({ path: '../server/.env', override: true });

async function test() {
  const key = process.env.GEMINI_API_KEY;
  console.log('Using Key:', key ? `${key.substring(0, 8)}...` : 'undefined');
  if (!key) {
    console.error('No GEMINI_API_KEY found!');
    return;
  }
  try {
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent('Say hello!');
    console.log('SUCCESS!');
    console.log('Response:', result.response.text());
  } catch (err) {
    console.error('ERROR OCCURRED:');
    console.error(err);
  }
}

test();
