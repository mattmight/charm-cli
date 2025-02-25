/* commands/summarize.mjs */
import fs from 'fs';
import fetch from 'node-fetch';
import { sleep } from '../utils.mjs';

export async function commandSummarize(globalFlags, cmdArgs) {
  let inputPath = null;
  let method = 'map';
  let chunkGroup = 'pages';
  let contextBefore = 0;
  let contextAfter = 0;
  let guidance = null;
  let temperature = null;
  let annotationField = 'summary';
  let annotationFieldDelta = 'summary_delta';

  let mergeSummariesGuidance = null;
  let initialSummary = null;
  let jsonSchemaPath = null;

  let inline = false;
  let outputFile = null;
  let pollInterval = 3;

  const localArgs = [...cmdArgs];
  while (localArgs.length > 0) {
    const token = localArgs.shift();
    switch (token) {
      case '--input':
        inputPath = localArgs.shift();
        break;
      case '--method':
        method = localArgs.shift();
        break;
      case '--chunk-group':
        chunkGroup = localArgs.shift();
        break;
      case '--context-chunks-before':
        contextBefore = parseInt(localArgs.shift(), 10);
        break;
      case '--context-chunks-after':
        contextAfter = parseInt(localArgs.shift(), 10);
        break;
      case '--guidance':
        guidance = localArgs.shift();
        break;
      case '--guidance-file':
        if (guidance) {
          console.error('[ERROR] Cannot combine --guidance with --guidance-file.');
          process.exit(1);
        }
        {
          const filePath = localArgs.shift();
          try {
            guidance = fs.readFileSync(filePath, 'utf-8');
          } catch (err) {
            console.error(`[ERROR] Could not read file for --guidance-file: ${filePath}\n`, err.message);
            process.exit(1);
          }
        }
        break;
      case '--temperature':
        temperature = parseFloat(localArgs.shift());
        break;
      case '--annotation-field':
        annotationField = localArgs.shift();
        break;
      case '--annotation-field-delta':
        annotationFieldDelta = localArgs.shift();
        break;
      case '--merge-summaries-guidance':
        if (mergeSummariesGuidance) {
          console.error('[ERROR] Already specified merge-summaries-guidance; cannot repeat.');
          process.exit(1);
        }
        mergeSummariesGuidance = localArgs.shift();
        break;
      case '--merge-summaries-guidance-file':
        if (mergeSummariesGuidance) {
          console.error('[ERROR] Cannot combine --merge-summaries-guidance with --merge-summaries-guidance-file.');
          process.exit(1);
        }
        {
          const filePath = localArgs.shift();
          try {
            mergeSummariesGuidance = fs.readFileSync(filePath, 'utf-8');
          } catch (err) {
            console.error(`[ERROR] Could not read file for --merge-summaries-guidance-file: ${filePath}\n`, err.message);
            process.exit(1);
          }
        }
        break;
      case '--initial-summary':
        if (initialSummary) {
          console.error('[ERROR] Already specified initial-summary; cannot repeat.');
          process.exit(1);
        }
        initialSummary = localArgs.shift();
        break;
      case '--initial-summary-file':
        if (initialSummary) {
          console.error('[ERROR] Cannot combine --initial-summary with --initial-summary-file.');
          process.exit(1);
        }
        {
          const filePath = localArgs.shift();
          try {
            initialSummary = fs.readFileSync(filePath, 'utf-8');
          } catch (err) {
            console.error(`[ERROR] Could not read file for --initial-summary-file: ${filePath}\n`, err.message);
            process.exit(1);
          }
        }
        break;
      case '--json-schema':
        if (jsonSchemaPath) {
          console.error('[ERROR] Already specified a schema source; cannot combine --json-schema with --json-schema-file.');
          process.exit(1);
        }
        jsonSchemaPath = localArgs.shift();
        break;
      case '--json-schema-file':
        if (jsonSchemaPath) {
          console.error('[ERROR] Already specified a schema source; cannot combine --json-schema with --json-schema-file.');
          process.exit(1);
        }
        jsonSchemaPath = localArgs.shift();
        break;
      case '--inline':
        inline = true;
        break;
      case '--output-file':
        outputFile = localArgs.shift();
        break;
      case '--poll-interval':
        pollInterval = parseFloat(localArgs.shift());
        break;
      default:
        console.error(`[ERROR] Unknown flag for "summarize": ${token}`);
        process.exit(1);
    }
  }

  if (!inputPath) {
    console.error('[ERROR] You must specify --input <doc.json>.');
    process.exit(1);
  }
  if (!inline && !outputFile) {
    outputFile = inputPath.replace(/\.doc\.json$/i, '') + '.summarized.doc.json';
  }

  let docObj;
  try {
    const text = fs.readFileSync(inputPath, 'utf-8');
    docObj = JSON.parse(text);
  } catch (err) {
    console.error(`[ERROR] Could not read/parse: ${inputPath}\n`, err.message);
    process.exit(1);
  }

  const body = {
    document: docObj,
    method,
    model: globalFlags.model
  };
  if (method !== 'full') {
    body.chunk_group = chunkGroup;
    body.context_chunks_before = contextBefore;
    body.context_chunks_after = contextAfter;
  }
  if (guidance) body.guidance = guidance;
  if (typeof temperature === 'number') body.temperature = temperature;
  if (annotationField) body.annotation_field = annotationField;
  if (annotationFieldDelta) body.annotation_field_delta = annotationFieldDelta;
  if (mergeSummariesGuidance) body.merge_summaries_guidance = mergeSummariesGuidance;
  if (initialSummary) body.initial_summary = initialSummary;

  if (jsonSchemaPath) {
    try {
      const raw = fs.readFileSync(jsonSchemaPath, 'utf-8');
      const parsedSchema = JSON.parse(raw);
      body.json_schema = parsedSchema;
    } catch (err) {
      console.error(`[ERROR] Could not read/parse JSON schema file: ${jsonSchemaPath}\n`, err.message);
      process.exit(1);
    }
  }

  const endpoint = `http://${globalFlags.hostname}:${globalFlags.port}${globalFlags.baseUrlPrefix}/api/charmonizer/v1/summaries`;
  let jobId;
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[ERROR] Summarization job => HTTP ${resp.status} => ${errText}`);
      process.exit(1);
    }
    const json = await resp.json();
    jobId = json.job_id;
    if (!jobId) {
      console.error('[ERROR] Server did not return a job_id.');
      process.exit(1);
    }
    console.log(`Summarization job started. job_id=${jobId}`);
  } catch (err) {
    console.error('[ERROR] Failed to submit summarization job:', err.message);
    process.exit(1);
  }

  const statusUrl = `${endpoint}/${jobId}`;
  const resultUrl = `${statusUrl}/result`;
  while (true) {
    await sleep(pollInterval);
    let statusRes;
    try {
      const resp = await fetch(statusUrl);
      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[ERROR] Poll => HTTP ${resp.status} => ${errText}`);
        process.exit(1);
      }
      statusRes = await resp.json();
    } catch (err) {
      console.error('[ERROR] Polling summarization job failed:', err.message);
      process.exit(1);
    }
    if (statusRes.status === 'error') {
      console.error('[ERROR] Summarization job failed:', statusRes.error || '(No error detail)');
      process.exit(1);
    } else if (statusRes.status === 'complete') {
      console.log('Summarization job complete! Fetching final result...');
      break;
    } else {
      console.log(
        `Status: ${statusRes.status}, chunks_completed=${statusRes.chunks_completed || 0}/` +
        `${statusRes.chunks_total || 0}...`
      );
    }
  }

  let finalDoc;
  try {
    const resp = await fetch(resultUrl);
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[ERROR] Could not get final summary => HTTP ${resp.status} => ${errText}`);
      process.exit(1);
    }
    finalDoc = await resp.json();
  } catch (err) {
    console.error('[ERROR] Failed to retrieve summarization result:', err.message);
    process.exit(1);
  }

  let targetPath = outputFile || inputPath;
  if (inline) {
    if (!outputFile) {
      targetPath = inputPath;
    }
  }
  try {
    fs.writeFileSync(targetPath, JSON.stringify(finalDoc, null, 2), 'utf-8');
    console.log(`Wrote summarized doc to: ${targetPath}`);
  } catch (err) {
    console.error('[ERROR] Could not write output file:', err.message);
    process.exit(1);
  }
}
