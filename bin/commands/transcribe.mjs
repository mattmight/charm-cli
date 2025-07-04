/* commands/transcribe.mjs */
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';
import path from 'path';
import { sleep } from '../utils.mjs';
import crypto from 'crypto';

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
  let continueOnFailure = false;

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
      case '--continue-on-failure':
        continueOnFailure = true;
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
  if (continueOnFailure) form.append('continue_on_failure', 'true');

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
  
  let finalDoc; // Declare finalDoc here so it's in scope for the entire function

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
      if (continueOnFailure) {
        console.log('[WARN] Job failed, but --continue-on-failure specified. Creating partial result...');
        finalDoc = await createPartialResultFromError(statusRes, inputFile, globalFlags);
        break;
      } else {
        console.error('[ERROR] Job error:', statusRes.error);
        process.exit(1);
      }
    } else if (statusRes.status === 'complete') {
      console.log('Conversion complete! Fetching final result...');
      break;
    } else {
      const pagesTotal = statusRes.pages_total || 0;
      const pagesConverted = statusRes.pages_converted || 0;
      console.log(`Progress: ${pagesConverted}/${pagesTotal} pages... (status=${statusRes.status})`);
    }
  }

  if (!finalDoc) { // Only fetch if not already set by error handling
    try {
      const resp = await fetch(resultUrl);
      if (!resp.ok && resp.status !== 202) {
        const errBody = await resp.text();
        if (continueOnFailure) {
          console.log('[WARN] Could not retrieve final result, but --continue-on-failure specified. Creating partial result...');
          finalDoc = await createPartialResultFromHttpError(resp.status, errBody, inputFile, globalFlags);
        } else {
          console.error(`[ERROR] Could not retrieve final => HTTP ${resp.status} => ${errBody}`);
          process.exit(1);
        }
      } else if (resp.status === 202) {
        if (continueOnFailure) {
          console.log('[WARN] Still processing, but --continue-on-failure specified. Creating partial result...');
          finalDoc = await createPartialResultFromTimeout(inputFile, globalFlags);
        } else {
          console.warn('[WARN] Still processing, got 202. Exiting with error code.');
          process.exit(1);
        }
      } else {
        finalDoc = await resp.json();
      }
    } catch (err) {
      if (continueOnFailure) {
        console.log('[WARN] Failed to fetch final doc object, but --continue-on-failure specified. Creating partial result...');
        finalDoc = await createPartialResultFromException(err, inputFile, globalFlags);
      } else {
        console.error('[ERROR] Failed to fetch final doc object:', err.message);
        process.exit(1);
      }
    }
  }

  try {
    fs.writeFileSync(outputPath, JSON.stringify(finalDoc, null, 2), 'utf-8');
    console.log(`Saved final doc object to ${outputPath}`);
  } catch (err) {
    console.error('[ERROR] Could not write output:', err.message);
    process.exit(1);
  }
}

// Helper function to create a partial result document when transcription fails
async function createPartialResultFromError(statusRes, inputFile, globalFlags) {
  const fileBuffer = fs.readFileSync(inputFile);
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  
  const errorContent = `<!-- TRANSCRIPTION FAILURE -->
<!-- This page failed to transcribe due to an error -->

# Transcription Failed

**Error Type:** ${statusRes.error_type || 'Unknown'}
**Error Message:** ${statusRes.error || 'No error message provided'}
**Timestamp:** ${new Date().toISOString()}
**Model:** ${globalFlags.model}

---

*This content was generated because the --continue-on-failure flag was used and the transcription process encountered an error.*`;

  return {
    id: fileHash,
    content: errorContent,
    metadata: {
      mimetype: path.extname(inputFile) === '.pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      document_sha256: fileHash,
      size_bytes: fileBuffer.length,
      originating_filename: path.basename(inputFile),
      transcription_status: 'failed',
      transcription_error: {
        error_type: statusRes.error_type || 'job_error',
        error_message: statusRes.error || 'Unknown error',
        timestamp: new Date().toISOString(),
        model_used: globalFlags.model,
        failure_point: 'job_processing'
      }
    },
    chunks: {
      pages: [{
        id: `${fileHash}/pages@0`,
        parent: fileHash,
        start: 0,
        length: errorContent.length,
        content: errorContent,
        metadata: {
          page_number: 1,
          text_extraction_method: 'error_placeholder',
          extraction_confidence: 0,
          model_name: globalFlags.model,
          isFirstPage: true,
          originating_filename: path.basename(inputFile),
          originating_file_sha256: fileHash,
          transcription_failed: true,
          error_type: statusRes.error_type || 'job_error',
          error_message: statusRes.error || 'Unknown error'
        },
        annotations: {
          description: "This page contains a transcription failure notice because the original transcription process failed."
        }
      }]
    }
  };
}

// Helper function for HTTP errors during result fetch
async function createPartialResultFromHttpError(httpStatus, errorBody, inputFile, globalFlags) {
  const fileBuffer = fs.readFileSync(inputFile);
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  
  const errorContent = `<!-- TRANSCRIPTION FAILURE -->
<!-- Result retrieval failed with HTTP error -->

# Transcription Result Retrieval Failed

**HTTP Status:** ${httpStatus}
**Error Response:** ${errorBody}
**Timestamp:** ${new Date().toISOString()}
**Model:** ${globalFlags.model}

---

*This content was generated because the --continue-on-failure flag was used and the result could not be retrieved from the server.*`;

  return {
    id: fileHash,
    content: errorContent,
    metadata: {
      mimetype: path.extname(inputFile) === '.pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      document_sha256: fileHash,
      size_bytes: fileBuffer.length,
      originating_filename: path.basename(inputFile),
      transcription_status: 'failed',
      transcription_error: {
        error_type: 'http_error',
        error_message: `HTTP ${httpStatus}: ${errorBody}`,
        timestamp: new Date().toISOString(),
        model_used: globalFlags.model,
        failure_point: 'result_retrieval'
      }
    },
    chunks: {
      pages: [{
        id: `${fileHash}/pages@0`,
        parent: fileHash,
        start: 0,
        length: errorContent.length,
        content: errorContent,
        metadata: {
          page_number: 1,
          text_extraction_method: 'error_placeholder',
          extraction_confidence: 0,
          model_name: globalFlags.model,
          isFirstPage: true,
          originating_filename: path.basename(inputFile),
          originating_file_sha256: fileHash,
          transcription_failed: true,
          error_type: 'http_error',
          error_message: `HTTP ${httpStatus}: ${errorBody}`
        },
        annotations: {
          description: "This page contains a transcription failure notice because the result could not be retrieved from the server."
        }
      }]
    }
  };
}

// Helper function for timeout errors
async function createPartialResultFromTimeout(inputFile, globalFlags) {
  const fileBuffer = fs.readFileSync(inputFile);
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  
  const errorContent = `<!-- TRANSCRIPTION FAILURE -->
<!-- Transcription process timed out -->

# Transcription Timed Out

**Error Type:** Processing Timeout
**Timestamp:** ${new Date().toISOString()}
**Model:** ${globalFlags.model}

---

*This content was generated because the --continue-on-failure flag was used and the transcription process did not complete within the expected timeframe.*`;

  return {
    id: fileHash,
    content: errorContent,
    metadata: {
      mimetype: path.extname(inputFile) === '.pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      document_sha256: fileHash,
      size_bytes: fileBuffer.length,
      originating_filename: path.basename(inputFile),
      transcription_status: 'failed',
      transcription_error: {
        error_type: 'timeout',
        error_message: 'Transcription process timed out',
        timestamp: new Date().toISOString(),
        model_used: globalFlags.model,
        failure_point: 'processing_timeout'
      }
    },
    chunks: {
      pages: [{
        id: `${fileHash}/pages@0`,
        parent: fileHash,
        start: 0,
        length: errorContent.length,
        content: errorContent,
        metadata: {
          page_number: 1,
          text_extraction_method: 'error_placeholder',
          extraction_confidence: 0,
          model_name: globalFlags.model,
          isFirstPage: true,
          originating_filename: path.basename(inputFile),
          originating_file_sha256: fileHash,
          transcription_failed: true,
          error_type: 'timeout',
          error_message: 'Transcription process timed out'
        },
        annotations: {
          description: "This page contains a transcription failure notice because the transcription process timed out."
        }
      }]
    }
  };
}

// Helper function for general exceptions
async function createPartialResultFromException(error, inputFile, globalFlags) {
  const fileBuffer = fs.readFileSync(inputFile);
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  
  const errorContent = `<!-- TRANSCRIPTION FAILURE -->
<!-- Transcription failed with exception -->

# Transcription Exception

**Error Type:** Exception
**Error Message:** ${error.message || 'Unknown exception'}
**Timestamp:** ${new Date().toISOString()}
**Model:** ${globalFlags.model}

---

*This content was generated because the --continue-on-failure flag was used and the transcription process encountered an exception.*`;

  return {
    id: fileHash,
    content: errorContent,
    metadata: {
      mimetype: path.extname(inputFile) === '.pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      document_sha256: fileHash,
      size_bytes: fileBuffer.length,
      originating_filename: path.basename(inputFile),
      transcription_status: 'failed',
      transcription_error: {
        error_type: 'exception',
        error_message: error.message || 'Unknown exception',
        timestamp: new Date().toISOString(),
        model_used: globalFlags.model,
        failure_point: 'exception_during_processing'
      }
    },
    chunks: {
      pages: [{
        id: `${fileHash}/pages@0`,
        parent: fileHash,
        start: 0,
        length: errorContent.length,
        content: errorContent,
        metadata: {
          page_number: 1,
          text_extraction_method: 'error_placeholder',
          extraction_confidence: 0,
          model_name: globalFlags.model,
          isFirstPage: true,
          originating_filename: path.basename(inputFile),
          originating_file_sha256: fileHash,
          transcription_failed: true,
          error_type: 'exception',
          error_message: error.message || 'Unknown exception'
        },
        annotations: {
          description: "This page contains a transcription failure notice because the transcription process encountered an exception."
        }
      }]
    }
  };
}
