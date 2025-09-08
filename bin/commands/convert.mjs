/* commands/convert.mjs */
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { sleep } from '../utils.mjs';

export async function commandConvert(globalFlags, cmdArgs) {
  // Parse command-specific flags
  const flags = { to: null };
  const args = [];
  
  for (let i = 0; i < cmdArgs.length; i++) {
    const arg = cmdArgs[i];
    if (arg === '-t' || arg === '--to') {
      if (i + 1 >= cmdArgs.length) {
        console.error('[ERROR] --to flag requires a file extension');
        process.exit(1);
      }
      flags.to = cmdArgs[i + 1];
      i++; // Skip the next argument since it's the value for --to
    } else {
      args.push(arg);
    }
  }

  // Determine input and output paths
  let inputPath, outputPath;
  
  if (flags.to) {
    // Auto-generate output filename based on --to flag
    if (args.length < 1) {
      console.error('[ERROR] Usage: charm convert <input-file> [<output-file>] or charm convert <input-file> --to <extension>');
      process.exit(1);
    }
    
    inputPath = args[0];
    
    // Generate output filename by changing extension
    const inputDir = path.dirname(inputPath);
    const inputBasename = path.basename(inputPath);
    
    let outputBasename;
    if (inputBasename.endsWith('.doc.json')) {
      // Special case: foo.doc.json -> foo.md
      outputBasename = inputBasename.replace(/\.doc\.json$/, `.${flags.to}`);
    } else {
      // General case: foo.ext -> foo.newext
      const nameWithoutExt = inputBasename.replace(/\.[^.]*$/, '');
      outputBasename = `${nameWithoutExt}.${flags.to}`;
    }
    
    outputPath = path.join(inputDir, outputBasename);
  } else {
    // Traditional usage with explicit output file
    if (args.length < 2) {
      console.error('[ERROR] Usage: charm convert <input-file> <output-file> or charm convert <input-file> --to <extension>');
      process.exit(1);
    }
    
    inputPath = args[0];
    outputPath = args[1];
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`[ERROR] Input file does not exist: ${inputPath}`);
    process.exit(1);
  }

  const inputExt = path.extname(inputPath).toLowerCase();
  const outputExt = path.extname(outputPath).toLowerCase();

  try {
    if (inputExt === '.json' && inputPath.endsWith('.doc.json') && outputExt === '.md') {
      await convertDocJsonToMarkdown(inputPath, outputPath);
    } else if (inputExt === '.docx' && outputExt === '.md') {
      await convertDocxToMarkdown(inputPath, outputPath, globalFlags);
    } else {
      console.error(`[ERROR] Unsupported conversion: ${inputExt} to ${outputExt}`);
      console.error('Currently supported conversions:');
      console.error('  .doc.json -> .md');
      console.error('  .docx -> .md');
      process.exit(1);
    }
  } catch (err) {
    console.error(`[ERROR] Conversion failed: ${err.message}`);
    process.exit(1);
  }
}

async function convertDocJsonToMarkdown(inputPath, outputPath) {
  let docJson;
  try {
    const jsonContent = fs.readFileSync(inputPath, 'utf-8');
    docJson = JSON.parse(jsonContent);
  } catch (err) {
    throw new Error(`Failed to read or parse input file: ${err.message}`);
  }

  let markdownContent = '';

  if (docJson.markdownContent) {
    markdownContent = docJson.markdownContent;
  } else if (docJson.content) {
    markdownContent = docJson.content;
  } else if (docJson.text) {
    markdownContent = docJson.text;
  } else if (docJson.chunks && Array.isArray(docJson.chunks)) {
    markdownContent = docJson.chunks.map(chunk => {
      if (typeof chunk === 'string') {
        return chunk;
      } else if (chunk.content) {
        return chunk.content;
      } else if (chunk.text) {
        return chunk.text;
      }
      return '';
    }).join('\n\n');
  } else {
    throw new Error('Could not find markdown content in the doc.json file. Expected fields: markdownContent, content, text, or chunks array.');
  }

  try {
    fs.writeFileSync(outputPath, markdownContent, 'utf-8');
    console.log(`Converted ${inputPath} to ${outputPath}`);
  } catch (err) {
    throw new Error(`Failed to write output file: ${err.message}`);
  }
}

async function convertDocxToMarkdown(inputPath, outputPath, globalFlags) {
  let fileBuffer;
  try {
    fileBuffer = fs.readFileSync(inputPath);
  } catch (err) {
    throw new Error(`Could not read file at ${inputPath}: ${err.message}`);
  }

  const form = new FormData();
  form.append('file', fileBuffer, path.basename(inputPath));
  form.append('model', globalFlags.model);

  let length;
  try {
    length = form.getLengthSync();
  } catch (err) {
    throw new Error(`form.getLengthSync() failed: ${err.message}`);
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
      throw new Error(`HTTP ${response.status} => ${errBody}`);
    }
    const result = await response.json();
    if (!result.job_id) {
      throw new Error('No job_id returned by the server.');
    }
    jobId = result.job_id;
  } catch (err) {
    throw new Error(`Failed to start document conversion: ${err.message}`);
  }

  const statusUrl = `http://${globalFlags.hostname}:${globalFlags.port}${globalFlags.baseUrlPrefix}/api/charmonizer/v1/conversions/documents/${jobId}`;
  const resultUrl = `${statusUrl}/result`;
  
  const pollInterval = 3;

  while (true) {
    await sleep(pollInterval);
    
    try {
      const resp = await fetch(statusUrl);
      if (!resp.ok) {
        const errBody = await resp.text();
        throw new Error(`HTTP ${resp.status} => ${errBody}`);
      }
      const statusData = await resp.json();
      
      if (statusData.status === 'complete' || statusData.status === 'completed') {
        break;
      } else if (statusData.status === 'failed') {
        throw new Error(`Conversion job failed: ${statusData.error || 'Unknown error'}`);
      }
      
      console.log(`Conversion in progress... (status: ${statusData.status})`);
    } catch (err) {
      throw new Error(`Failed to check conversion status: ${err.message}`);
    }
  }

  try {
    const resp = await fetch(resultUrl);
    if (!resp.ok) {
      const errBody = await resp.text();
      throw new Error(`HTTP ${resp.status} => ${errBody}`);
    }
    const docJson = await resp.json();
    
    let markdownContent = '';
    
    if (docJson.markdownContent) {
      markdownContent = docJson.markdownContent;
    } else if (docJson.content) {
      markdownContent = docJson.content;
    } else if (docJson.text) {
      markdownContent = docJson.text;
    } else if (docJson.chunks && Array.isArray(docJson.chunks)) {
      markdownContent = docJson.chunks.map(chunk => {
        if (typeof chunk === 'string') {
          return chunk;
        } else if (chunk.content) {
          return chunk.content;
        } else if (chunk.text) {
          return chunk.text;
        }
        return '';
      }).join('\n\n');
    } else {
      throw new Error('Could not find markdown content in the conversion result. Expected fields: markdownContent, content, text, or chunks array.');
    }

    fs.writeFileSync(outputPath, markdownContent, 'utf-8');
    console.log(`Converted ${inputPath} to ${outputPath}`);
  } catch (err) {
    throw new Error(`Failed to retrieve or write conversion result: ${err.message}`);
  }
}