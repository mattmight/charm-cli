/* commands/chunk.mjs */
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { sleep } from '../utils.mjs';

export async function commandChunk(globalFlags, cmdArgs) {
  let inputPath = null;
  let strategy = null;
  let chunkSize = null;
  let inputChunkGroupName = 'all';
  let outputChunkGroupName = 'rechunked';
  let inline = false;
  let outputPath = null;
  let pollInterval = 3;

  const localArgs = [...cmdArgs];
  while (localArgs.length > 0) {
    const token = localArgs.shift();
    if (token === '--input') {
      inputPath = localArgs.shift();
    } else if (token === '--strategy') {
      strategy = localArgs.shift();
    } else if (token === '--chunk-size') {
      chunkSize = parseInt(localArgs.shift(), 10);
    } else if (token === '--input-chunk-group-name') {
      inputChunkGroupName = localArgs.shift();
    } else if (token === '--output-chunk-group-name') {
      outputChunkGroupName = localArgs.shift();
    } else if (token === '--inline') {
      inline = true;
    } else if (token === '--output') {
      outputPath = localArgs.shift();
    } else if (token === '--poll-interval') {
      pollInterval = parseFloat(localArgs.shift());
    } else {
      console.error(`[ERROR] Unknown flag for "chunk": ${token}`);
      process.exit(1);
    }
  }

  if (!inputPath) {
    console.error('[ERROR] You must specify --input <file.json>.');
    process.exit(1);
  }
  if (!strategy) {
    console.error('[ERROR] You must specify --strategy (e.g. "merge_and_split").');
    process.exit(1);
  }
  if (!chunkSize || chunkSize <= 0) {
    console.error('[ERROR] You must specify a positive --chunk-size (in tokens).');
    process.exit(1);
  }

  if (!outputPath) {
    if (inline) {
      outputPath = inputPath;
    } else {
      outputPath = inputPath.replace(/\.json$/i, '') + '.chunk.json';
    }
  }

  let docObj;
  try {
    const text = fs.readFileSync(inputPath, 'utf-8');
    docObj = JSON.parse(text);
  } catch (err) {
    console.error(`[ERROR] Could not read/parse input JSON file: ${inputPath}\n`, err.message);
    process.exit(1);
  }

  const body = {
    document: docObj,
    strategy,
    chunk_size: chunkSize,
    chunk_group: inputChunkGroupName
  };

  const endpoint = `http://${globalFlags.hostname}:${globalFlags.port}${globalFlags.baseUrlPrefix}/api/charmonizer/v1/chunkings`;
  let jobId;
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[ERROR] chunking job request => HTTP ${resp.status} => ${errText}`);
      process.exit(1);
    }
    const json = await resp.json();
    jobId = json.job_id;
    if (!jobId) {
      console.error('[ERROR] Server did not return a job_id.');
      process.exit(1);
    }
    console.log(`Chunking job started. job_id=${jobId}`);
  } catch (err) {
    console.error('[ERROR] Failed to submit chunking job:', err.message);
    process.exit(1);
  }

  const statusUrl = `http://${globalFlags.hostname}:${globalFlags.port}${globalFlags.baseUrlPrefix}/api/charmonizer/v1/chunkings/${jobId}`;
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
      console.error('[ERROR] Polling chunking job failed:', err.message);
      process.exit(1);
    }

    if (statusRes.status === 'error') {
      console.error('[ERROR] Chunking job failed:', statusRes.error || '(Unknown error)');
      process.exit(1);
    } else if (statusRes.status === 'complete') {
      console.log('Chunking job complete! Fetching final result...');
      break;
    } else {
      console.log(`Status: ${statusRes.status}, progress=${statusRes.progress || 0}%`);
    }
  }

  let finalResult;
  try {
    const resp = await fetch(resultUrl);
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[ERROR] Could not get final chunk result => HTTP ${resp.status} => ${errText}`);
      process.exit(1);
    }
    finalResult = await resp.json();
  } catch (err) {
    console.error('[ERROR] Failed to retrieve chunk result:', err.message);
    process.exit(1);
  }

  const topLevelOrigFilename = docObj.metadata?.originating_filename;
  const newChunkArray = (finalResult.chunks || []).map((item, idx) => {
    const childMetadata = {
      chunk_index: item.chunk_index,
      title: item.chunk_data.title
    };
    if (topLevelOrigFilename) {
      childMetadata.originating_filename = topLevelOrigFilename;
    }
    return {
      id: docObj.id + '/' + outputChunkGroupName + '@' + idx,
      parent: docObj.id,
      content: item.chunk_data.body,
      metadata: childMetadata
    };
  });

  if (inline) {
    if (!docObj.chunks) {
      docObj.chunks = {};
    }
    docObj.chunks[outputChunkGroupName] = newChunkArray;
    try {
      fs.writeFileSync(outputPath, JSON.stringify(docObj, null, 2), 'utf-8');
      console.log(`Wrote updated doc (with new chunk group "${outputChunkGroupName}") to: ${outputPath}`);
    } catch (err) {
      console.error('[ERROR] Could not write output file:', err.message);
      process.exit(1);
    }
  } else {
    const newDoc = {
      id: docObj.id,
      content: docObj.content || '',
      metadata: docObj.metadata || {},
      chunks: {}
    };
    newDoc.chunks[outputChunkGroupName] = newChunkArray;
    try {
      fs.writeFileSync(outputPath, JSON.stringify(newDoc, null, 2), 'utf-8');
      console.log(`Wrote new JSON document with chunk group "${outputChunkGroupName}" to: ${outputPath}`);
    } catch (err) {
      console.error('[ERROR] Could not write output file:', err.message);
      process.exit(1);
    }
  }
}
