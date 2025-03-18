/* commands/merge-transcriptions.mjs */
import fs from 'fs';
import fetch from 'node-fetch';
import { sleep } from '../utils.mjs';

/**
 * Merges multiple .doc.json transcripts of the same document into one composite .doc.json.
 *
 * Usage example:
 *   charm merge-transcriptions --output merged.doc.json file1.doc.json file2.doc.json
 *
 * Steps:
 *  1. Load each input .doc.json (all must have the same chunk group name for pages, default "pages").
 *  2. For each page index, gather the raw Markdown from each doc's chunk.
 *  3. Call GPT-4 (or the configured model) with a "merge transcriptions" prompt to unify them.
 *  4. Merge page-level metadata (conflicts become "ALT" in a special comment field).
 *  5. Merge doc-level metadata similarly.
 *  6. The final doc sets "content_chunk_group" to the chosen chunk group, ensuring a valid doc object.
 *  7. Output a single .doc.json with the merged pages in that chunk group.
 */
export async function commandMergeTranscriptions(globalFlags, cmdArgs) {
  let outputPath = null;
  const inputPaths = [];
  let pollInterval = 3;
  let chunkGroupName = 'pages'; // Default chunk group
  let modelName = globalFlags.model || 'gpt-4o'; // default fallback

  // Parse CLI flags
  const localArgs = [...cmdArgs];
  while (localArgs.length > 0) {
    const token = localArgs.shift();
    if (token === '--output') {
      outputPath = localArgs.shift();
    } else if (token === '--poll-interval') {
      pollInterval = parseFloat(localArgs.shift());
    } else if (token === '--chunk-group') {
      chunkGroupName = localArgs.shift();
    } else if (token.startsWith('--')) {
      console.error(`[ERROR] Unknown flag for "merge-transcriptions": ${token}`);
      process.exit(1);
    } else {
      // It's presumably an input file path:
      inputPaths.push(token);
    }
  }

  if (inputPaths.length < 2) {
    console.error('[ERROR] You must provide at least two .doc.json files to merge.');
    console.error('Usage: charm merge-transcriptions --output merged.doc.json file1.doc.json file2.doc.json ...');
    process.exit(1);
  }
  if (!outputPath) {
    outputPath = 'merged.doc.json';
  }

  // Load all doc objects
  const docs = [];
  for (const p of inputPaths) {
    try {
      const text = fs.readFileSync(p, 'utf-8');
      docs.push(JSON.parse(text));
    } catch (err) {
      console.error(`[ERROR] Could not read/parse: ${p} => ${err.message}`);
      process.exit(1);
    }
  }

  // Extract chunk arrays for the chosen group from each doc
  const chunkArrays = docs.map(d => d.chunks?.[chunkGroupName] || []);
  const pageCount = chunkArrays[0].length;
  for (let i = 1; i < chunkArrays.length; i++) {
    if (chunkArrays[i].length !== pageCount) {
      console.error(`[ERROR] Mismatch in number of chunks for group "${chunkGroupName}" among input docs.`);
      process.exit(1);
    }
  }

  // Merge doc-level metadata
  const baseDoc = docs[0];
  const mergedMetadata = {};
  const allDocKeys = new Set();
  docs.forEach(d => {
    if (d.metadata) {
      Object.keys(d.metadata).forEach(k => allDocKeys.add(k));
    }
  });
  for (const k of allDocKeys) {
    const values = docs.map(d => (d.metadata ? d.metadata[k] : undefined));
    const allSame = values.every(v => JSON.stringify(v) === JSON.stringify(values[0]));
    if (allSame) {
      mergedMetadata[k] = values[0];
    } else {
      mergedMetadata[k] = values[0];
      const altList = values
        .slice(1)
        .filter(x => JSON.stringify(x) !== JSON.stringify(values[0]))
        .map(x => `ALT: ${JSON.stringify(x)}`)
        .join(' | ');
      if (altList) {
        mergedMetadata[k + '_conflicts'] = altList;
      }
    }
  }

  // Create the merged doc skeleton
  const mergedDoc = {
    id: 'merged-' + (baseDoc.id || 'doc'),
    metadata: mergedMetadata,
    // Set content_chunk_group to the user-selected chunk group:
    content_chunk_group: chunkGroupName,
    chunks: {
      [chunkGroupName]: []
    }
  };

  // System prompt to merge transcriptions
  const mergeSystemMessage = `
You are given multiple OCR-like Markdown transcriptions of the same page.
Your goal is to merge them into a single best-guess transcription, with inline
<!-- ALT: ... --> comments for differences. Follow these steps:
1. Compare all transcriptions fragment by fragment.
2. If two or more transcriptions agree, that's likely correct.
3. If disagreement, pick the one that seems most accurate, and comment the others as <!-- ALT: ... -->.
4. Preserve Markdown structure from the best source(s).
5. Output only final Markdown + inline comments, no extra commentary.
`.trim();

  // For each page index, unify the content
  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const pageChunks = docs.map(d => d.chunks[chunkGroupName][pageIndex]);
    let userContent = '';
    pageChunks.forEach((pg, i) => {
      userContent += `TRANSCRIPTION #${i + 1}:\n\n${pg.content}\n\n`;
    });

    // Prepare request to model
    const payload = {
      model: modelName,
      system: mergeSystemMessage,
      transcript: {
        messages: [
          { role: 'user', content: userContent }
        ]
      },
      // For better consistency in merges, we can do a low temperature:
      options: {
        response_format: { type: 'text' },
        temperature: 0.2
      }
    };

    const endpoint = `http://${globalFlags.hostname}:${globalFlags.port}${globalFlags.baseUrlPrefix}/api/charmonator/v1/transcript/extension`;
    let mergedPageMarkdown = '';
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[ERROR] Merging page #${pageIndex + 1} => HTTP ${resp.status} => ${errText}`);
        process.exit(1);
      }
      const resultJson = await resp.json();
      const assistantMsgs = (resultJson.messages || []).filter(m => m.role === 'assistant');
      if (!assistantMsgs.length) {
        console.error(`[ERROR] No assistant message returned for page #${pageIndex + 1}.`);
        process.exit(1);
      }
      mergedPageMarkdown = assistantMsgs.map(m => m.content).join('\n');
    } catch (err) {
      console.error(`[ERROR] Failed to merge page #${pageIndex + 1}:`, err.message);
      process.exit(1);
    }

    // Merge page-level metadata
    const mergedPageMetadata = {};
    const pageKeys = new Set();
    pageChunks.forEach(pg => {
      if (pg.metadata) {
        Object.keys(pg.metadata).forEach(k => pageKeys.add(k));
      }
    });
    for (const k of pageKeys) {
      const vals = pageChunks.map(pg => (pg.metadata ? pg.metadata[k] : undefined));
      const allSame = vals.every(v => JSON.stringify(v) === JSON.stringify(vals[0]));
      if (allSame) {
        mergedPageMetadata[k] = vals[0];
      } else {
        mergedPageMetadata[k] = vals[0];
        const altList = vals
          .slice(1)
          .filter(x => JSON.stringify(x) !== JSON.stringify(vals[0]))
          .map(x => `ALT: ${JSON.stringify(x)}`)
          .join(' | ');
        if (altList) {
          mergedPageMetadata[k + '_conflicts'] = altList;
        }
      }
    }

    // Construct the final chunk
    const newPageChunk = {
      id: `${mergedDoc.id}/${chunkGroupName}@${pageIndex}`,
      parent: mergedDoc.id,
      content: mergedPageMarkdown,
      metadata: mergedPageMetadata
    };
    mergedDoc.chunks[chunkGroupName].push(newPageChunk);
  }

  // Write out the result
  try {
    fs.writeFileSync(outputPath, JSON.stringify(mergedDoc, null, 2), 'utf-8');
    console.log(`Merged transcription doc with ${pageCount} pages => ${outputPath}`);
  } catch (err) {
    console.error('[ERROR] Could not write merged doc:', err.message);
    process.exit(1);
  }
}
