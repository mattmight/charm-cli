/* commands/extract-markdown.mjs */
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';
import path from 'path';

export async function commandExtractMarkdown(globalFlags, cmdArgs) {
  if (cmdArgs.length === 0) {
    console.error('[ERROR] No input file specified for "extract-markdown".');
    process.exit(1);
  }
  const inputPath = cmdArgs[0];

  let defaultOutput = inputPath + '.md';
  const ext = path.extname(inputPath);
  if (ext) {
    defaultOutput = inputPath.slice(0, -ext.length) + '.md';
  }

  let outputPath = defaultOutput;
  const localArgs = cmdArgs.slice(1);
  while (localArgs.length > 0) {
    const token = localArgs.shift();
    switch (token) {
      case '--output':
        outputPath = localArgs.shift();
        break;
      default:
        console.error(`[ERROR] Unknown flag for "extract-markdown": ${token}`);
        process.exit(1);
    }
  }

  let fileBuffer;
  try {
    fileBuffer = fs.readFileSync(inputPath);
  } catch (err) {
    console.error(`[ERROR] Could not read file at ${inputPath}`, err.message);
    process.exit(1);
  }

  const form = new FormData();
  form.append('file', fileBuffer, path.basename(inputPath));

  const endpoint = `http://${globalFlags.hostname}:${globalFlags.port}${globalFlags.baseUrlPrefix}/api/charmonator/v1/conversion/file`;
  let responseJson;

  try {
    const length = form.getLengthSync();
    const headers = {
      ...form.getHeaders(),
      'Content-Length': length
    };

    const resp = await fetch(endpoint, {
      method: 'POST',
      body: form,
      headers
    });
    if (!resp.ok) {
      const errBody = await resp.text();
      console.error(`[ERROR] /conversion/file => HTTP ${resp.status} => ${errBody}`);
      process.exit(1);
    }
    responseJson = await resp.json();
  } catch (err) {
    console.error('[ERROR] Failed to call /conversion/file:', err.message);
    process.exit(1);
  }

  if (!responseJson || typeof responseJson.markdownContent !== 'string') {
    console.error('[ERROR] Response missing "markdownContent" field.');
    process.exit(1);
  }

  try {
    fs.writeFileSync(outputPath, responseJson.markdownContent, 'utf-8');
    console.log(`Extracted markdown saved to: ${outputPath}`);
  } catch (err) {
    console.error('[ERROR] Could not write Markdown output:', err.message);
    process.exit(1);
  }
}
