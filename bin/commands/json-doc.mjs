/* commands/json-doc.mjs */
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

export async function commandJsonDoc(globalFlags, cmdArgs) {
  if (cmdArgs.length === 0) {
    showJsonDocUsage();
    process.exit(1);
  }

  const [subcommand, ...rest] = cmdArgs;

  switch (subcommand) {
    case 'extract-markdown':
      await doExtractMarkdown(globalFlags, rest);
      break;
    case 'extract-summary':
      await doExtractSummary(globalFlags, rest);
      break;
    case 'extract-chunk-annotations':
      await doExtractChunkAnnotations(globalFlags, rest);
      break;
    case 'merge-chunks':
      await doMergeChunks(globalFlags, rest);
      break;
    case 'concatenate':
      await doConcatenate(globalFlags, rest);
      break;
    case 'wrap':
      await doWrap(globalFlags, rest);
      break;
    default:
      console.error(`[ERROR] Unknown json-doc subcommand: ${subcommand}`);
      showJsonDocUsage();
      process.exit(1);
  }
}

function showJsonDocUsage() {
  console.log(`
Usage: charm json-doc <subcommand> [options]

Subcommands:
  extract-markdown <file.doc.json> [--metadata]
      Extract markdown content from a document.

  extract-summary <file.doc.json> [--field <name>] [--separator <sep>]
      Extract summary annotation from a document.

  extract-chunk-annotations <file.doc.json> --chunk-group <name> [--target <name>] [--metadata]
      Extract annotations from each chunk in a chunk group.

  merge-chunks <file.doc.json> --max-tokens <n> [--encoding <name>] [--chunk-group <name>] [--new-group <name>] [--overlap <n>] [--output <file>] [--inline]
      Merge small chunks into larger ones up to max_tokens.

  concatenate <output.doc.json> <input1.doc.json> [input2.doc.json ...]
      Combine multiple documents into a single master document.

  wrap [--output <file>]
      Read raw content from stdin and wrap it into a document.
`);
}

function getEndpoint(globalFlags, path) {
  return `http://${globalFlags.hostname}:${globalFlags.port}${globalFlags.baseUrlPrefix}/api/charmonator/v1/documents${path}`;
}

async function doExtractMarkdown(globalFlags, args) {
  let filePath = null;
  let includeMetadata = false;

  const localArgs = [...args];
  while (localArgs.length > 0) {
    const token = localArgs.shift();
    if (token === '--metadata') {
      includeMetadata = true;
    } else if (!filePath && !token.startsWith('-')) {
      filePath = token;
    } else {
      console.error(`[ERROR] Unknown option: ${token}`);
      process.exit(1);
    }
  }

  if (!filePath) {
    console.error('[ERROR] File path required');
    console.error('Usage: charm json-doc extract-markdown <file.doc.json> [--metadata]');
    process.exit(1);
  }

  let document;
  try {
    document = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`[ERROR] Could not read/parse file: ${filePath}`);
    console.error(err.message);
    process.exit(1);
  }

  const endpoint = getEndpoint(globalFlags, '/markdown');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document,
        include_metadata: includeMetadata
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ERROR] HTTP ${response.status}: ${errText}`);
      process.exit(1);
    }

    const result = await response.json();
    console.log(result.markdown);
  } catch (err) {
    console.error(`[ERROR] Request failed: ${err.message}`);
    process.exit(1);
  }
}

async function doExtractSummary(globalFlags, args) {
  let filePath = null;
  let field = 'summary';
  let separator = '\n\n--\n\n';

  const localArgs = [...args];
  while (localArgs.length > 0) {
    const token = localArgs.shift();
    if (token === '--field') {
      field = localArgs.shift();
    } else if (token === '--separator') {
      separator = localArgs.shift();
    } else if (!filePath && !token.startsWith('-')) {
      filePath = token;
    } else {
      console.error(`[ERROR] Unknown option: ${token}`);
      process.exit(1);
    }
  }

  if (!filePath) {
    console.error('[ERROR] File path required');
    console.error('Usage: charm json-doc extract-summary <file.doc.json> [--field <name>] [--separator <sep>]');
    process.exit(1);
  }

  let document;
  try {
    document = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`[ERROR] Could not read/parse file: ${filePath}`);
    console.error(err.message);
    process.exit(1);
  }

  const endpoint = getEndpoint(globalFlags, '/summary');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document,
        field,
        separator
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ERROR] HTTP ${response.status}: ${errText}`);
      process.exit(1);
    }

    const result = await response.json();
    if (result.summary === null) {
      console.error(`[WARN] ${result.message || 'No summary found'}`);
    } else {
      console.log(result.summary);
    }
  } catch (err) {
    console.error(`[ERROR] Request failed: ${err.message}`);
    process.exit(1);
  }
}

async function doExtractChunkAnnotations(globalFlags, args) {
  let filePath = null;
  let chunkGroup = null;
  let target = 'summary';
  let includeMetadata = false;

  const localArgs = [...args];
  while (localArgs.length > 0) {
    const token = localArgs.shift();
    if (token === '--chunk-group') {
      chunkGroup = localArgs.shift();
    } else if (token === '--target') {
      target = localArgs.shift();
    } else if (token === '--metadata') {
      includeMetadata = true;
    } else if (!filePath && !token.startsWith('-')) {
      filePath = token;
    } else {
      console.error(`[ERROR] Unknown option: ${token}`);
      process.exit(1);
    }
  }

  if (!filePath) {
    console.error('[ERROR] File path required');
    process.exit(1);
  }

  if (!chunkGroup) {
    console.error('[ERROR] --chunk-group is required');
    console.error('Usage: charm json-doc extract-chunk-annotations <file.doc.json> --chunk-group <name> [--target <name>] [--metadata]');
    process.exit(1);
  }

  let document;
  try {
    document = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`[ERROR] Could not read/parse file: ${filePath}`);
    console.error(err.message);
    process.exit(1);
  }

  const endpoint = getEndpoint(globalFlags, '/chunks/annotations');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document,
        chunk_group: chunkGroup,
        target,
        include_metadata: includeMetadata
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ERROR] HTTP ${response.status}: ${errText}`);
      process.exit(1);
    }

    const result = await response.json();
    console.log(JSON.stringify(result.annotations, null, 2));
  } catch (err) {
    console.error(`[ERROR] Request failed: ${err.message}`);
    process.exit(1);
  }
}

async function doMergeChunks(globalFlags, args) {
  let filePath = null;
  let maxTokens = null;
  let encoding = 'cl100k_base';
  let chunkGroup = 'pages';
  let newGroupName = null;
  let overlapTokens = 0;
  let outputFile = null;
  let inline = false;

  const localArgs = [...args];
  while (localArgs.length > 0) {
    const token = localArgs.shift();
    switch (token) {
      case '--max-tokens':
        maxTokens = parseInt(localArgs.shift(), 10);
        break;
      case '--encoding':
        encoding = localArgs.shift();
        break;
      case '--chunk-group':
        chunkGroup = localArgs.shift();
        break;
      case '--new-group':
        newGroupName = localArgs.shift();
        break;
      case '--overlap':
        overlapTokens = parseInt(localArgs.shift(), 10);
        break;
      case '--output':
        outputFile = localArgs.shift();
        break;
      case '--inline':
        inline = true;
        break;
      default:
        if (!filePath && !token.startsWith('-')) {
          filePath = token;
        } else {
          console.error(`[ERROR] Unknown option: ${token}`);
          process.exit(1);
        }
    }
  }

  if (!filePath) {
    console.error('[ERROR] File path required');
    process.exit(1);
  }

  if (!maxTokens) {
    console.error('[ERROR] --max-tokens is required');
    console.error('Usage: charm json-doc merge-chunks <file.doc.json> --max-tokens <n> [options]');
    process.exit(1);
  }

  let document;
  try {
    document = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error(`[ERROR] Could not read/parse file: ${filePath}`);
    console.error(err.message);
    process.exit(1);
  }

  const endpoint = getEndpoint(globalFlags, '/chunks/merge');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document,
        max_tokens: maxTokens,
        encoding,
        chunk_group: chunkGroup,
        new_group_name: newGroupName,
        overlap_tokens: overlapTokens
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ERROR] HTTP ${response.status}: ${errText}`);
      process.exit(1);
    }

    const result = await response.json();

    console.log(`Merged ${result.old_chunk_count} chunks into ${result.new_chunk_count} chunks`);
    console.log(`New chunk group: ${result.new_group_name}`);

    // Write output
    let targetPath = outputFile;
    if (inline) {
      targetPath = filePath;
    } else if (!outputFile) {
      // Default output name
      const dir = path.dirname(filePath);
      const base = path.basename(filePath, '.doc.json');
      targetPath = path.join(dir, `${base}.merged.doc.json`);
    }

    fs.writeFileSync(targetPath, JSON.stringify(result.document, null, 2), 'utf-8');
    console.log(`Wrote merged document to: ${targetPath}`);
  } catch (err) {
    console.error(`[ERROR] Request failed: ${err.message}`);
    process.exit(1);
  }
}

async function doConcatenate(globalFlags, args) {
  if (args.length < 2) {
    console.error('[ERROR] At least two arguments required: output file and at least one input file');
    console.error('Usage: charm json-doc concatenate <output.doc.json> <input1.doc.json> [input2.doc.json ...]');
    process.exit(1);
  }

  const outputPath = args[0];
  const inputPaths = args.slice(1);

  const documents = [];
  for (const inputPath of inputPaths) {
    try {
      const doc = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
      documents.push(doc);
    } catch (err) {
      console.error(`[ERROR] Could not read/parse file: ${inputPath}`);
      console.error(err.message);
      process.exit(1);
    }
  }

  const endpoint = getEndpoint(globalFlags, '/combine');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documents
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ERROR] HTTP ${response.status}: ${errText}`);
      process.exit(1);
    }

    const result = await response.json();
    fs.writeFileSync(outputPath, JSON.stringify(result.document, null, 2), 'utf-8');
    console.log(`Combined ${documents.length} documents into: ${outputPath}`);
  } catch (err) {
    console.error(`[ERROR] Request failed: ${err.message}`);
    process.exit(1);
  }
}

async function doWrap(globalFlags, args) {
  let outputFile = null;

  const localArgs = [...args];
  while (localArgs.length > 0) {
    const token = localArgs.shift();
    if (token === '--output') {
      outputFile = localArgs.shift();
    } else {
      console.error(`[ERROR] Unknown option: ${token}`);
      process.exit(1);
    }
  }

  // Read content from stdin
  let content = '';
  try {
    content = fs.readFileSync(0, 'utf-8'); // 0 = stdin
  } catch (err) {
    console.error('[ERROR] Could not read from stdin');
    console.error(err.message);
    process.exit(1);
  }

  const endpoint = getEndpoint(globalFlags, '');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[ERROR] HTTP ${response.status}: ${errText}`);
      process.exit(1);
    }

    const result = await response.json();

    if (outputFile) {
      fs.writeFileSync(outputFile, JSON.stringify(result.document, null, 2), 'utf-8');
      console.log(`Wrote wrapped document to: ${outputFile}`);
    } else {
      console.log(JSON.stringify(result.document, null, 2));
    }
  } catch (err) {
    console.error(`[ERROR] Request failed: ${err.message}`);
    process.exit(1);
  }
}
