/* commands/transcribe.mjs */
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';
import path from 'path';
import { sleep } from '../utils.mjs';

export async function commandTranscribe(globalFlags, cmdArgs) {
  if (cmdArgs.length === 0) {
    console.error('[ERROR] No file specified. Expecting a .pdf or .docx file.');
    process.exit(1);
  }
  const inputFile = cmdArgs[0];
  const ext = path.extname(inputFile).toLowerCase();

  let outputPath;
  if (ext === '.pdf') {
    outputPath = inputFile.replace(/\.pdf$/i, '.pdf.doc.json');
  } else if (ext === '.docx') {
    outputPath = inputFile.replace(/\.docx$/i, '.docx.doc.json');
  } else {
    outputPath = inputFile + '.doc.json';
  }

  let description = null;
  let intent = null;
  let graphicInstructions = null;
  let detectDocBoundaries = false;
  let pageNumbering = true;
  let ocrThreshold = 1.0;
  let pollInterval = 3;

  const localArgs = cmdArgs.slice(1);
  while (localArgs.length > 0) {
    const token = localArgs.shift();
    switch (token) {
      case '--output':
        outputPath = localArgs.shift();
        break;
      case '--description':
        description = localArgs.shift();
        break;
      case '--intent':
        intent = localArgs.shift();
        break;
      case '--graphic-instructions':
        graphicInstructions = localArgs.shift();
        break;
      case '--detect-document-boundaries':
        detectDocBoundaries = true;
        break;
      case '--no-page-numbering':
        pageNumbering = false;
        break;
      case '--ocr-threshold':
        ocrThreshold = localArgs.shift();
        break;
      case '--poll-interval':
        pollInterval = parseFloat(localArgs.shift());
        if (isNaN(pollInterval) || pollInterval <= 0) {
          console.error('[ERROR] Invalid --poll-interval.');
          process.exit(1);
        }
        break;
      default:
        console.error(`[ERROR] Unknown flag for "transcribe": ${token}`);
        process.exit(1);
    }
  }

  let fileBuffer;
  try {
    fileBuffer = fs.readFileSync(inputFile);
  } catch (err) {
    console.error(`[ERROR] Could not read file at ${inputFile}`, err.message);
    process.exit(1);
  }

  const form = new FormData();
  form.append('file', fileBuffer, path.basename(inputFile));
  form.append('model', globalFlags.model);

  if (description) form.append('description', description);
  if (intent) form.append('intent', intent);
  if (graphicInstructions) form.append('graphic_instructions', graphicInstructions);
  if (detectDocBoundaries) form.append('detect_document_boundaries', 'true');
  if (!pageNumbering) form.append('page_numbering', 'false');
  if (ocrThreshold !== null) form.append('ocr_threshold', ocrThreshold);

  let length;
  try {
    length = form.getLengthSync();
  } catch (err) {
    console.error('[ERROR] form.getLengthSync() failed:', err.message);
    process.exit(1);
  }

  const headers = {
    ...form.getHeaders(),
    'Content-Length': length
  };

  const endpoint = `http://${globalFlags.hostname}:${globalFlags.port}${globalFlags.baseUrlPrefix}/api/charmonizer/v1/conversions/documents`;
  let jobId;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: form,
      headers
    });
    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[ERROR] HTTP ${response.status} => ${errBody}`);
      process.exit(1);
    }
    const result = await response.json();
    if (!result.job_id) {
      console.error('[ERROR] No job_id returned by the server.');
      process.exit(1);
    }
    jobId = result.job_id;
  } catch (err) {
    console.error('[ERROR] Failed to start document conversion:', err.message);
    process.exit(1);
  }

  const statusUrl = `http://${globalFlags.hostname}:${globalFlags.port}${globalFlags.baseUrlPrefix}/api/charmonizer/v1/conversions/documents/${jobId}`;
  const resultUrl = `${statusUrl}/result`;

  while (true) {
    await sleep(pollInterval);

    let statusRes;
    try {
      const resp = await fetch(statusUrl);
      if (!resp.ok) {
        const errBody = await resp.text();
        console.error(`[ERROR] Polling => HTTP ${resp.status} => ${errBody}`);
        process.exit(1);
      }
      statusRes = await resp.json();
    } catch (err) {
      console.error('[ERROR] Polling job status failed:', err.message);
      process.exit(1);
    }

    if (statusRes.status === 'error') {
      console.error('[ERROR] Job error:', statusRes.error);
      process.exit(1);
    } else if (statusRes.status === 'complete') {
      console.log('Conversion complete! Fetching final result...');
      break;
    } else {
      const pagesTotal = statusRes.pages_total || 0;
      const pagesConverted = statusRes.pages_converted || 0;
      console.log(`Progress: ${pagesConverted}/${pagesTotal} pages... (status=${statusRes.status})`);
    }
  }

  let finalDoc;
  try {
    const resp = await fetch(resultUrl);
    if (!resp.ok && resp.status !== 202) {
      const errBody = await resp.text();
      console.error(`[ERROR] Could not retrieve final => HTTP ${resp.status} => ${errBody}`);
      process.exit(1);
    }
    if (resp.status === 202) {
      console.warn('[WARN] Still processing, got 202. Exiting with error code.');
      process.exit(1);
    }
    finalDoc = await resp.json();
  } catch (err) {
    console.error('[ERROR] Failed to fetch final doc object:', err.message);
    process.exit(1);
  }

  try {
    fs.writeFileSync(outputPath, JSON.stringify(finalDoc, null, 2), 'utf-8');
    console.log(`Saved final doc object to ${outputPath}`);
  } catch (err) {
    console.error('[ERROR] Could not write output:', err.message);
    process.exit(1);
  }
}
