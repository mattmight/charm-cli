/* commands/append.mjs */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export async function commandAppend(globalFlags, cmdArgs) {
  // Parse command-specific flags
  const flags = { output: null };
  const args = [];
  
  for (let i = 0; i < cmdArgs.length; i++) {
    const arg = cmdArgs[i];
    if (arg === '-o' || arg === '--output') {
      if (i + 1 >= cmdArgs.length) {
        console.error('[ERROR] --output flag requires a filename');
        process.exit(1);
      }
      flags.output = cmdArgs[i + 1];
      i++; // Skip the next argument since it's the value for --output
    } else {
      args.push(arg);
    }
  }

  // Validate arguments
  if (args.length < 2) {
    console.error('[ERROR] Usage: charm append <input1.doc.json> <input2.doc.json> [<input3.doc.json> ...] [--output <output.doc.json>]');
    console.error('[ERROR] At least 2 input files are required');
    process.exit(1);
  }

  // Determine output path
  let outputPath;
  if (flags.output) {
    outputPath = flags.output;
  } else {
    // Auto-generate output filename based on first input
    const firstInputPath = args[0];
    const inputDir = path.dirname(firstInputPath);
    const inputBasename = path.basename(firstInputPath);
    const nameWithoutExt = inputBasename.replace(/\.doc\.json$/, '') || inputBasename.replace(/\.[^.]*$/, '');
    outputPath = path.join(inputDir, `${nameWithoutExt}-appended.doc.json`);
  }

  // Validate input files
  const inputPaths = args;
  for (const inputPath of inputPaths) {
    if (!fs.existsSync(inputPath)) {
      console.error(`[ERROR] Input file does not exist: ${inputPath}`);
      process.exit(1);
    }
    
    if (!inputPath.endsWith('.doc.json') && !inputPath.endsWith('.json')) {
      console.warn(`[WARN] Input file does not have expected .doc.json extension: ${inputPath}`);
    }
  }

  try {
    await appendDocuments(inputPaths, outputPath);
  } catch (err) {
    console.error(`[ERROR] Append operation failed: ${err.message}`);
    process.exit(1);
  }
}

async function appendDocuments(inputPaths, outputPath) {
  // Load and validate all input documents
  const inputDocuments = [];
  
  for (const inputPath of inputPaths) {
    let docJson;
    try {
      const jsonContent = fs.readFileSync(inputPath, 'utf-8');
      docJson = JSON.parse(jsonContent);
    } catch (err) {
      throw new Error(`Failed to read or parse input file ${inputPath}: ${err.message}`);
    }

    // Validate that this is a JSON document object
    if (!docJson.id) {
      throw new Error(`Input file ${inputPath} is not a valid JSON Document Object (missing 'id' field)`);
    }

    inputDocuments.push({
      document: docJson,
      filename: path.basename(inputPath)
    });
  }

  // Create the combined document content by concatenating resolved content
  let combinedContent = '';
  const documentChunks = [];

  for (let i = 0; i < inputDocuments.length; i++) {
    const { document, filename } = inputDocuments[i];
    
    // Get the resolved content from the document
    const resolvedContent = getResolvedContent(document);
    
    if (i > 0) {
      combinedContent += '\n\n<!-- document boundary -->\n\n';
    }
    
    const startOffset = combinedContent.length;
    combinedContent += resolvedContent;
    const length = resolvedContent.length;
    
    // Create a chunk entry for this document
    const chunkId = `appended-doc-${i}`;
    const documentChunk = {
      id: chunkId,
      parent: null, // Will be set after we generate the main document ID
      start: startOffset,
      length: length,
      content: resolvedContent,
      metadata: {
        original_document_id: document.id,
        original_filename: filename,
        document_index: i,
        ...(document.metadata || {})
      },
      annotations: document.annotations || {},
      embeddings: document.embeddings || {}
    };
    
    // If the original document had chunks, preserve them as sub-chunks
    if (document.chunks) {
      documentChunk.chunks = document.chunks;
    }
    
    documentChunks.push(documentChunk);
  }

  // Generate a unique ID for the combined document
  const combinedHash = crypto.createHash('sha256').update(combinedContent).digest('hex');
  const combinedId = combinedHash.substring(0, 20); // Use first 20 chars of hash
  
  // Update parent references in chunks
  documentChunks.forEach(chunk => {
    chunk.parent = combinedId;
  });

  // Create the final combined document object
  const combinedDocument = {
    id: combinedId,
    content: combinedContent,
    metadata: {
      created_by: 'charm-cli append command',
      creation_timestamp: new Date().toISOString(),
      source_documents: inputDocuments.map(({ document, filename }) => ({
        id: document.id,
        filename: filename
      })),
      document_count: inputDocuments.length
    },
    chunks: {
      documents: documentChunks
    },
    annotations: {
      description: `Combined document created from ${inputDocuments.length} source documents`
    }
  };

  // Write the combined document to output file
  try {
    fs.writeFileSync(outputPath, JSON.stringify(combinedDocument, null, 2), 'utf-8');
    console.log(`Successfully appended ${inputDocuments.length} documents to ${outputPath}`);
    console.log(`Combined document ID: ${combinedId}`);
  } catch (err) {
    throw new Error(`Failed to write output file: ${err.message}`);
  }
}

/**
 * Get the resolved content from a document object.
 * This implements the same logic as described in the JSON Document specification.
 */
function getResolvedContent(document, parentContent = null) {
  // If document has direct content, return it
  if (document.content) {
    return document.content;
  }
  
  // If document is a chunk with parent reference and start/length
  if (document.parent && typeof document.start === 'number' && typeof document.length === 'number') {
    if (!parentContent) {
      throw new Error(`Document ${document.id} is a chunk but no parent content was provided`);
    }
    return parentContent.substring(document.start, document.start + document.length);
  }
  
  // If document has content_chunk_group, concatenate chunks from that group
  if (document.content_chunk_group && document.chunks && document.chunks[document.content_chunk_group]) {
    const chunkGroup = document.chunks[document.content_chunk_group];
    return chunkGroup.map(chunk => getResolvedContent(chunk, document.content)).join('');
  }
  
  // If none of the above, throw an error
  throw new Error(`Could not resolve content for document ${document.id}: no content, parent reference, or content_chunk_group found`);
}