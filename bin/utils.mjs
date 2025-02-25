/* utils.mjs */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

/** Sleep for N seconds. */
export function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/** Read all lines from stdin (until EOF). */
export async function readAllStdin() {
  const rl = readline.createInterface({ input: process.stdin });
  let data = '';
  for await (const line of rl) {
    data += line + '\n';
  }
  return data.trim();
}

/** Async question prompt. */
export function questionAsync(rl, prompt) {
  return new Promise(resolve => {
    rl.question(prompt, answer => resolve(answer));
  });
}

/** Guess basic MIME type for an image from path. */
export function guessMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    default:
      return null;
  }
}

/** Make a data-url image attachment from file. */
export function makeImageAttachment(filePath) {
  const data = fs.readFileSync(filePath);
  const b64 = data.toString('base64');
  const mime = guessMimeType(filePath);
  if (!mime) {
    console.warn(`[WARN] Could not guess an image MIME type for file: ${filePath}`);
    return null;
  }
  return {
    type: 'image',
    url: `data:${mime};base64,${b64}`
  };
}
