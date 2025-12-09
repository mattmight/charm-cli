/* commands/transmogrify.mjs */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';
import mime from 'mime-types';
import Ajv from 'ajv';
import fetch from 'node-fetch';
import { commandConvert } from './convert.mjs';
import { sleep } from '../utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Exit codes as per spec
const EXIT_CODES = {
  SUCCESS: 0,
  INVALID_FLAGS: 1,
  NO_GUIDE: 2,
  MODEL_FAILURE: 3,
  COMPILER_FAILURE: 4,
  VALIDATION_FAILURE: 5
};

/**
 * Main transmogrify command
 */
export async function commandTransmogrify(globalFlags, cmdArgs) {
  try {
    const opts = parseArgs(cmdArgs);

    // Dry run mode
    if (opts.dryRun) {
      await dryRun(globalFlags, opts);
      return;
    }

    const inputPath = opts.input;
    if (!fs.existsSync(inputPath)) {
      console.error(`[ERROR] Input file does not exist: ${inputPath}`);
      process.exit(EXIT_CODES.INVALID_FLAGS);
    }

    // Resolve source and target formats
    const fromFmt = resolveSourceFormat(opts, inputPath);
    const toFmt = resolveTargetFormat(opts);

    // Route 1: Check if covered by charm convert
    if (isCoveredByConvert(fromFmt, toFmt, inputPath)) {
      console.log('[INFO] Routing to charm convert...');
      return await routeToConvert(globalFlags, inputPath, opts, toFmt);
    }

    // Route 2: Check if PDF to Markdown conversion (uses Charmonizer image PDF endpoint)
    if (shouldUsePdfConversion(fromFmt, toFmt, inputPath)) {
      console.log('[INFO] Routing to PDF conversion (Charmonizer image PDF endpoint)...');
      return await convertPdfToMarkdown(globalFlags, inputPath, opts, toFmt);
    }

    // Route 3: Guide-based conversion
    const guidesDirs = buildGuidesDirs(globalFlags.guidesPath, opts.guidesDir);
    const guides = loadGuides(guidesDirs);

    const guide = selectGuide(guides, opts.guide, fromFmt, toFmt);
    if (!guide) {
      console.error('[ERROR] No suitable guide found for this conversion.');
      console.error(`  From: ${formatDescriptorToString(fromFmt)}`);
      console.error(`  To: ${formatDescriptorToString(toFmt)}`);
      process.exit(EXIT_CODES.NO_GUIDE);
    }

    console.log(`[INFO] Using guide: ${guide.name} (${guide.type})`);

    // Execute based on guide type
    if (guide.type === 'interpreter') {
      await runInterpreterGuide(globalFlags, guide, inputPath, fromFmt, toFmt, opts);
    } else if (guide.type === 'compiler') {
      await runCompilerGuide(globalFlags, guide, inputPath, fromFmt, toFmt, opts);
    } else {
      console.error(`[ERROR] Unknown guide type: ${guide.type}`);
      process.exit(EXIT_CODES.INVALID_FLAGS);
    }

  } catch (err) {
    console.error(`[ERROR] ${err.message}`);
    process.exit(EXIT_CODES.INVALID_FLAGS);
  }
}

/**
 * Parse command-line arguments
 */
function parseArgs(argv) {
  const opts = {
    guide: null,
    guidance: null,
    guidanceFile: null,
    from: null,
    fromFile: null,
    to: null,
    toFile: null,
    output: null,
    inputSchemaFile: null,
    outputSchemaFile: null,
    guidesDir: null,
    keepSandbox: false,
    dryRun: false,
    yes: false,
    input: null
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--guide') {
      opts.guide = argv[++i];
    } else if (arg === '--guidance') {
      opts.guidance = argv[++i];
    } else if (arg === '--guidance-file') {
      opts.guidanceFile = argv[++i];
    } else if (arg === '--from') {
      opts.from = argv[++i];
    } else if (arg === '--from-file') {
      opts.fromFile = argv[++i];
    } else if (arg === '--to' || arg === '-t') {
      opts.to = argv[++i];
    } else if (arg === '--to-file') {
      opts.toFile = argv[++i];
    } else if (arg === '--output' || arg === '-o') {
      opts.output = argv[++i];
    } else if (arg === '--input-schema-file') {
      opts.inputSchemaFile = argv[++i];
    } else if (arg === '--output-schema-file') {
      opts.outputSchemaFile = argv[++i];
    } else if (arg === '--guides-dir') {
      opts.guidesDir = argv[++i];
    } else if (arg === '--keep-sandbox') {
      opts.keepSandbox = true;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--yes' || arg === '-y') {
      opts.yes = true;
    } else if (!arg.startsWith('--')) {
      if (!opts.input) {
        opts.input = arg;
      } else {
        throw new Error(`Unexpected argument: ${arg}`);
      }
    } else {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  if (!opts.input) {
    console.error('[ERROR] Usage: charm transmogrify [flags] <input-file>');
    process.exit(EXIT_CODES.INVALID_FLAGS);
  }

  // Validate mutually exclusive options
  if (opts.guidance && opts.guidanceFile) {
    throw new Error('--guidance and --guidance-file are mutually exclusive');
  }
  if (opts.from && opts.fromFile) {
    throw new Error('--from and --from-file are mutually exclusive');
  }
  if (opts.to && opts.toFile) {
    throw new Error('--to and --to-file are mutually exclusive');
  }

  return opts;
}

/**
 * Get default guides directory
 */
function getDefaultGuidesDir() {
  // Go up from bin/commands/ to repo root
  return path.join(__dirname, '..', '..', 'guides');
}

/**
 * Build list of guides directories to search.
 * @param {string|null} guidesPath - Colon-separated list of paths from --guides-path
 * @param {string|null} guidesDir - Single path from --guides-dir (command-level override)
 * @returns {string[]} Array of directories to search in order
 */
function buildGuidesDirs(guidesPath, guidesDir) {
  // If --guides-dir is specified, it takes full precedence (backwards compatibility)
  if (guidesDir) {
    return [guidesDir];
  }

  const dirs = [];

  // Add paths from --guides-path (colon-separated)
  if (guidesPath) {
    const paths = guidesPath.split(':').filter(p => p.trim());
    dirs.push(...paths);
  }

  // Always add the default guides directory last
  dirs.push(getDefaultGuidesDir());

  return dirs;
}

/**
 * Load all guides from multiple directories.
 * @param {string[]} guidesDirs - Array of directories to search in order
 * @returns {object[]} Array of loaded guide objects
 */
function loadGuides(guidesDirs) {
  const guides = [];
  const seenNames = new Set();

  for (const guidesDir of guidesDirs) {
    if (!fs.existsSync(guidesDir)) {
      continue; // Skip non-existent directories
    }

    const entries = fs.readdirSync(guidesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      // Skip if we've already seen a guide with this name (first one wins)
      if (seenNames.has(entry.name)) continue;

      const guidePath = path.join(guidesDir, entry.name);
      const typeFile = path.join(guidePath, 'type.json');

      if (!fs.existsSync(typeFile)) continue;

      try {
        const typeContent = fs.readFileSync(typeFile, 'utf-8').trim();
        const typeObj = JSON.parse(typeContent);

        // Skip guides not intended for transmogrify command
        if (typeObj.command !== 'transmogrify') continue;

        const inputsFile = path.join(guidePath, 'inputs.json');
        const outputsFile = path.join(guidePath, 'outputs.json');

        if (!fs.existsSync(inputsFile) || !fs.existsSync(outputsFile)) {
          console.warn(`[WARN] Guide ${entry.name} missing inputs.json or outputs.json`);
          continue;
        }

        const inputs = JSON.parse(fs.readFileSync(inputsFile, 'utf-8'));
        const outputs = JSON.parse(fs.readFileSync(outputsFile, 'utf-8'));

        guides.push({
          name: entry.name,
          path: guidePath,
          type: typeObj.type,
          inputs: inputs,
          outputs: outputs
        });
        seenNames.add(entry.name);
      } catch (err) {
        console.warn(`[WARN] Failed to load guide ${entry.name}: ${err.message}`);
      }
    }
  }

  return guides;
}

/**
 * Parse a format specification string
 */
function parseFormatSpec(str) {
  if (!str) return null;

  const lines = str.split('\n');
  let mime = null;
  let variant = null;
  let description = null;
  let ext = null;

  // First line might be MIME type
  const firstLine = lines[0].trim();

  // Check if it's a simple extension
  if (firstLine.match(/^\.?\w+$/)) {
    ext = firstLine.replace(/^\./, '');
    const normalized = normalizeByExt(ext);
    mime = normalized.mime;
  } else if (firstLine.includes('/')) {
    // Parse MIME type
    const parts = firstLine.split(';').map(p => p.trim());
    mime = parts[0];

    // Check for variant
    for (let i = 1; i < parts.length; i++) {
      const param = parts[i];
      if (param.startsWith('variant=')) {
        variant = param.substring(8).trim();
      }
    }

    // Derive extension from MIME
    const mimeExt = mime.lookup ? mime.lookup(mime) : null;
    if (mimeExt) ext = mimeExt;
  }

  // If there's a blank line followed by text, that's the description
  if (lines.length > 2 && lines[1].trim() === '') {
    description = lines.slice(2).join('\n').trim();
  }

  return {
    ext,
    mime,
    variant,
    description,
    originalText: str
  };
}

/**
 * Normalize format by extension
 */
function normalizeByExt(ext) {
  ext = ext.replace(/^\./, '').toLowerCase();

  const mimeType = mime.lookup(ext) || null;

  const mapping = {
    'md': { mime: 'text/markdown', ext: 'md' },
    'markdown': { mime: 'text/markdown', ext: 'md' },
    'json': { mime: 'application/json', ext: 'json' },
    'txt': { mime: 'text/plain', ext: 'txt' },
    'docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
    'pptx': { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', ext: 'pptx' },
    'pdf': { mime: 'application/pdf', ext: 'pdf' },
    'csv': { mime: 'text/csv', ext: 'csv' },
    'tsv': { mime: 'text/tab-separated-values', ext: 'tsv' }
  };

  if (mapping[ext]) {
    return mapping[ext];
  }

  return { mime: mimeType, ext };
}

/**
 * Resolve source format
 */
function resolveSourceFormat(opts, inputPath) {
  let formatStr = null;

  if (opts.fromFile) {
    formatStr = fs.readFileSync(opts.fromFile, 'utf-8');
  } else if (opts.from) {
    formatStr = opts.from;
  } else {
    // Infer from input file extension
    const ext = path.extname(inputPath).substring(1);
    formatStr = ext;
  }

  return parseFormatSpec(formatStr);
}

/**
 * Resolve target format
 */
function resolveTargetFormat(opts) {
  let formatStr = null;

  if (opts.toFile) {
    formatStr = fs.readFileSync(opts.toFile, 'utf-8');
  } else if (opts.to) {
    formatStr = opts.to;
  } else {
    return null; // Will be resolved later based on guide
  }

  return parseFormatSpec(formatStr);
}

/**
 * Check if conversion is covered by charm convert
 */
function isCoveredByConvert(fromFmt, toFmt, inputPath) {
  if (!fromFmt || !toFmt) return false;

  const fromExt = fromFmt.ext;
  const toExt = toFmt.ext;

  // .doc.json -> .md
  if (inputPath.endsWith('.doc.json') && toExt === 'md') return true;

  // .docx -> .md
  if (fromExt === 'docx' && toExt === 'md') return true;

  // .pptx -> .md
  if (fromExt === 'pptx' && toExt === 'md') return true;

  return false;
}

/**
 * Check if should use PDF conversion endpoint
 */
function shouldUsePdfConversion(fromFmt, toFmt, inputPath) {
  if (!fromFmt || !toFmt) return false;

  const fromExt = fromFmt.ext;
  const toExt = toFmt.ext;

  // PDF -> MD (use Charmonizer image PDF endpoint)
  if (fromExt === 'pdf' && toExt === 'md') return true;

  return false;
}

/**
 * Convert PDF to Markdown by delegating to charm transcribe command
 */
async function convertPdfToMarkdown(globalFlags, inputPath, opts, toFmt) {
  console.log('[INFO] Using charm transcribe for PDF to Markdown conversion...');

  // Determine output path
  const outputPath = generateOutputPath(inputPath, toFmt, opts.output);

  // Find charm executable (same directory as this script)
  const charmPath = path.join(__dirname, '..', 'charm.mjs');

  // Build arguments for charm transcribe
  const args = [];

  // Global flags (before transcribe command)
  if (globalFlags.model) {
    args.push('--model', globalFlags.model);
  }
  if (globalFlags.hostname && globalFlags.hostname !== 'localhost') {
    args.push('--hostname', globalFlags.hostname);
  }
  if (globalFlags.port && globalFlags.port !== 5002) {
    args.push('--port', String(globalFlags.port));
  }
  if (globalFlags.baseUrlPrefix) {
    args.push('--base-url-prefix', globalFlags.baseUrlPrefix);
  }

  // transcribe command
  args.push('transcribe');

  // Input file
  args.push(inputPath);

  // Output format (markdown)
  args.push('--output-format', 'md');

  // Output path
  args.push('--output', outputPath);

  // Add guidance as description if provided
  const guidance = buildGuidance(opts);
  if (guidance) {
    args.push('--description', guidance);

    // Optional: Set medical document defaults if guidance mentions medical terms
    if (guidance.toLowerCase().includes('medical') ||
        guidance.toLowerCase().includes('patient') ||
        guidance.toLowerCase().includes('clinical')) {
      if (!guidance.includes('diagnosis') && !guidance.includes('prognosis')) {
        args.push('--intent', 'To come up with a diagnosis, a prognosis or a treatment option based on the content of the records.');
      }
      if (!guidance.includes('graphics') && !guidance.includes('images')) {
        args.push('--graphic-instructions', 'Clearly describe the contents of graphics, images and figures as it could relate to the diagnosis, prognosis or potential treatment of this patient.');
      }
    }
  }

  // Spawn charm transcribe process
  return new Promise((resolve, reject) => {
    const child = spawn('node', [charmPath, ...args], {
      stdio: 'inherit', // Pass through stdout/stderr so we see progress
      env: process.env
    });

    child.on('error', (err) => {
      console.error(`[ERROR] Failed to spawn charm transcribe: ${err.message}`);
      process.exit(EXIT_CODES.MODEL_FAILURE);
    });

    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`[SUCCESS] Output written to ${outputPath}`);
        resolve();
      } else {
        console.error(`[ERROR] charm transcribe exited with code ${code}`);
        process.exit(EXIT_CODES.MODEL_FAILURE);
      }
    });
  });
}

/**
 * Convert doc.json to markdown (same as transcribe command)
 */
function convertDocToMarkdown(docObject) {
  if (!docObject) {
    return '# Error\n\nNo document content available.';
  }

  let markdown = '';

  // Add document metadata as HTML comment if available
  if (docObject.metadata) {
    const meta = docObject.metadata;
    markdown += '<!--\n';
    if (meta.originating_filename) markdown += `filename: ${meta.originating_filename}\n`;
    if (meta.document_sha256) markdown += `sha256: ${meta.document_sha256}\n`;
    if (meta.size_bytes) markdown += `size: ${meta.size_bytes} bytes\n`;
    if (meta.transcription_status) markdown += `status: ${meta.transcription_status}\n`;
    markdown += '-->\n\n';
  }

  // Add main document content if available
  if (docObject.content) {
    markdown += docObject.content + '\n\n';
  }

  // Add page content from chunks if available
  if (docObject.chunks && docObject.chunks.pages) {
    for (const page of docObject.chunks.pages) {
      if (page.content) {
        // Add page separator for multi-page documents
        if (docObject.chunks.pages.length > 1 && page.metadata && page.metadata.page_number) {
          markdown += `<!-- Page ${page.metadata.page_number} -->\n\n`;
        }
        markdown += page.content + '\n\n';
      }
    }
  }

  return markdown.trim();
}

/**
 * Route to charm convert
 */
async function routeToConvert(globalFlags, inputPath, opts, toFmt) {
  const convertArgs = [inputPath, '--to', toFmt.ext];

  if (opts.output) {
    // convert doesn't support --output, so we'll need to handle it
    const tempOutput = generateOutputPath(inputPath, toFmt, null);
    await commandConvert(globalFlags, convertArgs);

    // Move the file if needed
    if (tempOutput !== opts.output) {
      fs.renameSync(tempOutput, opts.output);
      console.log(`Moved output to ${opts.output}`);
    }
  } else {
    await commandConvert(globalFlags, convertArgs);
  }
}

/**
 * Select best guide for conversion
 */
function selectGuide(guides, forcedGuideName, fromFmt, toFmt) {
  if (forcedGuideName) {
    const guide = guides.find(g => g.name === forcedGuideName);
    if (!guide) {
      console.error(`[ERROR] Guide '${forcedGuideName}' not found`);
      process.exit(EXIT_CODES.NO_GUIDE);
    }
    return guide;
  }

  // Score all guides
  let bestGuide = null;
  let bestScore = -1;

  for (const guide of guides) {
    const inputScore = scoreFormatMatch(fromFmt, guide.inputs);
    const outputScore = scoreFormatMatch(toFmt, guide.outputs);

    if (inputScore === -1 || outputScore === -1) continue;

    const totalScore = inputScore + outputScore;

    // Tie-breaker: prefer interpreter over compiler
    const typeBonus = guide.type === 'interpreter' ? 0.5 : 0;
    const finalScore = totalScore + typeBonus;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestGuide = guide;
    }
  }

  return bestGuide;
}

/**
 * Score format match against guide format specs
 */
function scoreFormatMatch(fmt, specs) {
  if (!fmt) return -1;

  let bestScore = -1;

  for (const spec of specs) {
    const candidate = parseFormatSpec(spec);
    if (!candidate) continue;

    let score = 0;

    // Wildcard match
    if (spec === '*/*' || spec === 'any') {
      score = 0;
    } else {
      // Exact variant match
      if (candidate.variant && fmt.variant && candidate.variant === fmt.variant) {
        score += 5;
      }

      // Exact MIME match
      if (candidate.mime && fmt.mime && candidate.mime === fmt.mime) {
        score += 4;
      }

      // Extension match
      if (candidate.ext && fmt.ext && candidate.ext === fmt.ext) {
        score += 3;
      }

      // Description substring match
      if (candidate.description && fmt.description &&
          fmt.description.includes(candidate.description)) {
        score += 1;
      }

      // If no matches at all, skip this candidate
      if (score === 0 && spec !== '*/*' && spec !== 'any') {
        continue;
      }
    }

    if (score > bestScore) {
      bestScore = score;
    }
  }

  return bestScore;
}

/**
 * Generate output path
 */
function generateOutputPath(inputPath, toFmt, customOutput) {
  if (customOutput) return customOutput;

  const inputDir = path.dirname(inputPath);
  const inputBasename = path.basename(inputPath);
  const nameWithoutExt = inputBasename.replace(/\.[^.]*$/, '');

  const ext = toFmt.ext || 'out';
  return path.join(inputDir, `${nameWithoutExt}.${ext}`);
}

/**
 * Build guidance string
 */
function buildGuidance(opts) {
  let guidance = '';

  if (opts.guidance) {
    guidance = opts.guidance;
  }

  if (opts.guidanceFile) {
    const fileContent = fs.readFileSync(opts.guidanceFile, 'utf-8');
    guidance = guidance ? `${guidance}\n\n${fileContent}` : fileContent;
  }

  return guidance;
}

/**
 * Format descriptor to human-readable string
 */
function formatDescriptorToString(fmt) {
  if (!fmt) return 'unknown';

  let str = '';
  if (fmt.mime) str += fmt.mime;
  if (fmt.variant) str += `; variant=${fmt.variant}`;
  if (fmt.ext && !str) str += fmt.ext;
  if (fmt.description) str += `\n${fmt.description}`;

  return str || fmt.originalText || 'unknown';
}

/**
 * Render system prompt with Handlebars
 */
function renderSystem(systemPath, vars) {
  const templateContent = fs.readFileSync(systemPath, 'utf-8');
  const template = Handlebars.compile(templateContent);
  return template(vars);
}

/**
 * Run interpreter guide
 */
async function runInterpreterGuide(globalFlags, guide, inputPath, fromFmt, toFmt, opts) {
  // Build prompt variables
  const guidance = buildGuidance(opts);
  const inputFormat = formatDescriptorToString(fromFmt);
  let outputFormat = formatDescriptorToString(toFmt);

  // Load input schema if provided
  let inputSchema = null;
  if (opts.inputSchemaFile) {
    const inputSchemaContent = fs.readFileSync(opts.inputSchemaFile, 'utf-8');
    try {
      inputSchema = JSON.parse(inputSchemaContent);
    } catch (err) {
      console.error(`[ERROR] Invalid input JSON schema: ${err.message}`);
      process.exit(EXIT_CODES.INVALID_FLAGS);
    }
  }

  // Load output schema if provided
  let schema = null;
  if (opts.outputSchemaFile) {
    const schemaContent = fs.readFileSync(opts.outputSchemaFile, 'utf-8');
    try {
      schema = JSON.parse(schemaContent);

      // Expand output format with schema
      outputFormat = `application/json\nas an instance of the following schema:\n\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\``;
    } catch (err) {
      console.error(`[ERROR] Invalid JSON schema: ${err.message}`);
      process.exit(EXIT_CODES.INVALID_FLAGS);
    }
  }

  // Render system prompt
  const systemPath = path.join(guide.path, 'SYSTEM.hbs');
  const system = renderSystem(systemPath, {
    guidance,
    input_format: inputFormat,
    output_format: outputFormat,
    input_schema: inputSchema ? JSON.stringify(inputSchema, null, 2) : null
  });

  // Read input file
  const inputExt = path.extname(inputPath).toLowerCase();
  let userContent;
  let attachments = null;

  if (['.png', '.jpg', '.jpeg', '.gif'].includes(inputExt)) {
    // Image attachment
    const imageBuffer = fs.readFileSync(inputPath);
    const base64 = imageBuffer.toString('base64');
    const mimeType = mime.lookup(inputPath) || 'image/png';

    attachments = [{
      type: 'image',
      source: {
        type: 'base64',
        media_type: mimeType,
        data: base64
      }
    }];

    userContent = `Convert this image to ${toFmt.ext || 'the requested format'}.`;
  } else {
    // Text content
    userContent = fs.readFileSync(inputPath, 'utf-8');
  }

  // Call Charmonator
  // Note: We don't pass schema for structured output because:
  // 1. Schema is already in the prompt text (line 757)
  // 2. Complex schemas with allOf, etc. aren't supported by OpenAI's structured output
  console.log('[INFO] Calling Charmonator API...');
  const result = await callCharmonator(globalFlags, system, userContent, attachments, null);

  // Write output
  const outputPath = generateOutputPath(inputPath, toFmt, opts.output);

  // Validate JSON if applicable
  if (toFmt.ext === 'json' || toFmt.mime === 'application/json') {
    validateJsonOutput(result, schema, opts.outputSchemaFile);
  }

  fs.writeFileSync(outputPath, result, 'utf-8');
  console.log(`[SUCCESS] Output written to ${outputPath}`);
}

/**
 * Run compiler guide
 */
async function runCompilerGuide(globalFlags, guide, inputPath, fromFmt, toFmt, opts) {
  // Build prompt variables
  const guidance = buildGuidance(opts);
  const inputFormat = formatDescriptorToString(fromFmt);
  let outputFormat = formatDescriptorToString(toFmt);

  // Load schema if provided
  let schema = null;
  if (opts.outputSchemaFile) {
    const schemaContent = fs.readFileSync(opts.outputSchemaFile, 'utf-8');
    try {
      schema = JSON.parse(schemaContent);
      outputFormat = `application/json\nas an instance of the following schema:\n\n\`\`\`json\n${JSON.stringify(schema, null, 2)}\n\`\`\``;
    } catch (err) {
      console.error(`[ERROR] Invalid JSON schema: ${err.message}`);
      process.exit(EXIT_CODES.INVALID_FLAGS);
    }
  }

  // Render system prompt
  const systemPath = path.join(guide.path, 'SYSTEM.hbs');
  const system = renderSystem(systemPath, { guidance, input_format: inputFormat, output_format: outputFormat });

  // Read input content for the prompt
  const inputContent = fs.readFileSync(inputPath, 'utf-8');

  // Call Charmonator to get compile.py
  console.log('[INFO] Generating compiler script...');
  const assistantMessage = await callCharmonator(globalFlags, system, inputContent, null, null);

  // Extract Python code
  const code = extractCodeFromMessage(assistantMessage);
  if (!code) {
    console.error('[ERROR] No Python code found in model response');
    process.exit(EXIT_CODES.MODEL_FAILURE);
  }

  // Run in sandbox
  const outputPath = generateOutputPath(inputPath, toFmt, opts.output);
  await runCompilerSandbox(guide, code, inputPath, outputPath, opts);

  // Validate JSON if applicable
  if (toFmt.ext === 'json' || toFmt.mime === 'application/json') {
    const result = fs.readFileSync(outputPath, 'utf-8');
    validateJsonOutput(result, schema, opts.outputSchemaFile);
  }

  console.log(`[SUCCESS] Output written to ${outputPath}`);
}

/**
 * Call Charmonator API
 */
async function callCharmonator(globalFlags, system, userContent, attachments, schema) {
  const endpoint = `http://${globalFlags.hostname}:${globalFlags.port}${globalFlags.baseUrlPrefix}/api/charmonator/v1/transcript/extension`;

  // Build message content
  let messageContent;
  if (attachments) {
    messageContent = [{ type: 'text', text: userContent }, ...attachments];
  } else {
    messageContent = userContent;
  }

  const payload = {
    model: globalFlags.model,
    system: system,
    transcript: {
      messages: [{
        role: 'user',
        content: messageContent
      }]
    },
    options: {}
  };

  // Add response format if schema provided
  if (schema) {
    payload.options.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'output',
        schema: schema
      }
    };
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`HTTP ${response.status}: ${errBody}`);
    }

    const result = await response.json();

    // Debug logging if needed
    if (process.env.DEBUG_TRANSMOGRIFY) {
      console.error('[DEBUG] API Response keys:', Object.keys(result));
    }

    // The API returns { messages: [...] } not { transcript: { messages: [...] } }
    const messages = result.messages || [];

    if (!messages || messages.length === 0) {
      throw new Error('No messages in response from Charmonator');
    }

    // Find assistant message
    const assistantMsg = messages.find(m => m.role === 'assistant');

    if (!assistantMsg) {
      throw new Error('No assistant message in response');
    }

    // Extract text content
    if (typeof assistantMsg.content === 'string') {
      return assistantMsg.content;
    } else if (Array.isArray(assistantMsg.content)) {
      const textParts = assistantMsg.content.filter(c => c.type === 'text');
      return textParts.map(c => c.text).join('\n');
    }

    throw new Error('Could not extract content from assistant message');

  } catch (err) {
    console.error(`[ERROR] Charmonator API call failed: ${err.message}`);
    process.exit(EXIT_CODES.MODEL_FAILURE);
  }
}

/**
 * Extract Python code from model response
 */
function extractCodeFromMessage(text) {
  // Try to find fenced code block
  const pythonFence = /```python\s*\n([\s\S]*?)\n```/;
  let match = text.match(pythonFence);

  if (match) return match[1];

  // Try any fenced block
  const anyFence = /```\s*\n([\s\S]*?)\n```/;
  match = text.match(anyFence);

  if (match) return match[1];

  // Return raw text as fallback
  return text.trim();
}

/**
 * Run compiler in sandbox
 */
async function runCompilerSandbox(guide, code, inputPath, outputPath, opts) {
  // Create sandbox
  const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'charm-transmog-'));

  try {
    // Write compile.py
    const compilePyPath = path.join(sandboxDir, 'compile.py');
    fs.writeFileSync(compilePyPath, code, 'utf-8');

    // Copy helpers.py if it exists
    const helpersPath = path.join(guide.path, 'helpers.py');
    if (fs.existsSync(helpersPath)) {
      const sandboxHelpersPath = path.join(sandboxDir, 'helpers.py');
      fs.copyFileSync(helpersPath, sandboxHelpersPath);
    }

    // Copy input file
    const sandboxInputPath = path.join(sandboxDir, path.basename(inputPath));
    fs.copyFileSync(inputPath, sandboxInputPath);

    // Determine output filename
    const outputBasename = path.basename(outputPath);
    const sandboxOutputPath = path.join(sandboxDir, outputBasename);

    // Confirm execution (unless --yes or env var)
    const shouldConfirm = !opts.yes &&
                          !process.env.CHARM_TRANSMOGRIFY_TRUST_COMPILED &&
                          process.stdin.isTTY;

    if (shouldConfirm) {
      console.log('\n[WARN] About to execute model-generated Python code.');
      console.log('Review the code at:', compilePyPath);
      console.log('');

      // Simple confirmation
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise((resolve) => {
        rl.question('Execute? [y/N] ', resolve);
      });
      rl.close();

      if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
        console.log('[INFO] Execution cancelled.');
        if (!opts.keepSandbox) {
          fs.rmSync(sandboxDir, { recursive: true, force: true });
        } else {
          console.log(`[INFO] Sandbox preserved at: ${sandboxDir}`);
        }
        process.exit(0);
      }
    }

    console.log('[INFO] Executing compiler...');

    // Execute Python script
    const timeout = parseInt(process.env.CHARM_TRANSMOGRIFY_TIMEOUT_SEC || '120') * 1000;
    const inputData = fs.readFileSync(inputPath);

    await new Promise((resolve, reject) => {
      const proc = spawn('python3', [compilePyPath, sandboxOutputPath], {
        cwd: sandboxDir,
        env: { PATH: process.env.PATH }, // Minimal env
        timeout: timeout
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          console.error('[ERROR] Compiler execution failed');
          console.error('STDOUT:', stdout);
          console.error('STDERR:', stderr);

          if (opts.keepSandbox) {
            console.error(`[INFO] Sandbox preserved at: ${sandboxDir}`);
          }

          reject(new Error(`Compiler exited with code ${code}`));
        } else {
          if (stderr) console.warn('[WARN]', stderr);
          resolve();
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn python3: ${err.message}`));
      });

      // Write input to stdin
      proc.stdin.write(inputData);
      proc.stdin.end();
    });

    // Move output file
    if (!fs.existsSync(sandboxOutputPath)) {
      throw new Error(`Compiler did not create output file: ${sandboxOutputPath}`);
    }

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.copyFileSync(sandboxOutputPath, outputPath);

  } catch (err) {
    console.error(`[ERROR] Sandbox execution failed: ${err.message}`);

    if (opts.keepSandbox) {
      console.error(`[INFO] Sandbox preserved at: ${sandboxDir}`);
    }

    process.exit(EXIT_CODES.COMPILER_FAILURE);
  } finally {
    // Clean up sandbox unless --keep-sandbox
    if (!opts.keepSandbox) {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    }
  }
}

/**
 * Validate JSON output
 */
function validateJsonOutput(content, schema, schemaFile) {
  // Parse JSON
  try {
    JSON.parse(content);
  } catch (err) {
    console.error(`[ERROR] Output is not valid JSON: ${err.message}`);
    process.exit(EXIT_CODES.VALIDATION_FAILURE);
  }

  // Validate against schema if provided
  if (schema && schemaFile) {
    try {
      const ajv = new Ajv();
      const validate = ajv.compile(schema);
      const data = JSON.parse(content);
      const valid = validate(data);

      if (!valid) {
        console.warn('[WARN] Output does not match schema:');
        console.warn(JSON.stringify(validate.errors, null, 2));
      }
    } catch (err) {
      console.warn(`[WARN] Schema validation failed: ${err.message}`);
    }
  }
}

/**
 * Dry run mode - print plan without executing
 */
async function dryRun(globalFlags, opts) {
  console.log('[DRY RUN MODE]');
  console.log('');
  console.log('Configuration:');
  console.log(`  Input: ${opts.input}`);
  console.log(`  From: ${opts.from || opts.fromFile || '(inferred)'}`);
  console.log(`  To: ${opts.to || opts.toFile || '(inferred)'}`);
  console.log(`  Output: ${opts.output || '(auto-generated)'}`);
  console.log(`  Guide: ${opts.guide || '(auto-select)'}`);
  console.log(`  Guidance: ${opts.guidance || opts.guidanceFile || '(none)'}`);
  console.log('');

  if (!fs.existsSync(opts.input)) {
    console.log('[INFO] Input file does not exist (dry run only)');
    return;
  }

  const fromFmt = resolveSourceFormat(opts, opts.input);
  const toFmt = resolveTargetFormat(opts);

  console.log('Resolved formats:');
  console.log(`  From: ${formatDescriptorToString(fromFmt)}`);
  console.log(`  To: ${toFmt ? formatDescriptorToString(toFmt) : '(not specified)'}`);
  console.log('');

  if (isCoveredByConvert(fromFmt, toFmt, opts.input)) {
    console.log('Route: charm convert');
  } else if (shouldUsePdfConversion(fromFmt, toFmt, opts.input)) {
    console.log('Route: PDF conversion (Charmonizer image PDF endpoint)');
  } else {
    const guidesDirs = buildGuidesDirs(globalFlags.guidesPath, opts.guidesDir);
    const guides = loadGuides(guidesDirs);
    const guide = selectGuide(guides, opts.guide, fromFmt, toFmt);

    if (guide) {
      console.log(`Route: ${guide.name} (${guide.type})`);
    } else {
      console.log('Route: (no suitable guide found)');
    }
  }
}
