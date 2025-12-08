/* commands/run.mjs */
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { parse } from 'csv-parse/sync';
import {
  readAllStdin,
  makeImageAttachment
} from '../utils.mjs';

/**
 * Parse CSV content and format as a text table
 */
function formatCsvAsTable(csvContent) {
  try {
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    if (records.length === 0) {
      return csvContent; // Return original if empty
    }

    const columns = Object.keys(records[0]);

    // Calculate column widths
    const widths = columns.map(col => {
      const maxDataWidth = Math.max(
        ...records.map(row => String(row[col] || '').length)
      );
      return Math.max(col.length, maxDataWidth);
    });

    // Build header
    const header = columns.map((col, i) => col.padEnd(widths[i])).join(' | ');
    const separator = widths.map(w => '-'.repeat(w)).join('-+-');

    // Build rows
    const rows = records.map(row =>
      columns.map((col, i) => String(row[col] || '').padEnd(widths[i])).join(' | ')
    );

    // Combine all parts
    return `CSV data (${records.length} rows):\n\n${header}\n${separator}\n${rows.join('\n')}`;
  } catch (err) {
    // If parsing fails, return original content
    console.warn('[WARN] Failed to parse CSV, using raw content:', err.message);
    return csvContent;
  }
}

export async function commandRun(globalFlags, cmdArgs) {
  let systemPrompt = null;  // Direct system prompt text via --system
  let systemFile = null;    // System prompt file via --system-file
  let userInputFile = null;
  let forceFormat = null;
  let forceSchemaFile = null;
  let leftoverMessage = null;

  const attachments = [];
  const csvAttachments = []; // Separate array for CSV files
  const localArgs = [...cmdArgs];

  // Templating
  let systemTemplateFile = null;
  const systemParamMap = {};
  let inputTemplateFile = null;
  const inputParamMap = {};

  function expandTemplate(templateText, paramMap) {
    let result = templateText;
    for (const [key, val] of Object.entries(paramMap)) {
      const pattern = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(pattern, val);
    }
    return result;
  }

  while (localArgs.length > 0) {
    const token = localArgs.shift();
    if (token === '--system') {
      systemPrompt = localArgs.shift();
    } else if (token === '--system-file') {
      systemFile = localArgs.shift();
    } else if (token === '--input-file') {
      userInputFile = localArgs.shift();
    } else if (token === '--force-response-format') {
      forceFormat = localArgs.shift();
    } else if (token === '--force-response-json-schema') {
      forceSchemaFile = localArgs.shift();
    } else if (token === '--attach') {
      const attachPath = localArgs.shift();
      if (!attachPath) {
        console.error('[ERROR] --attach requires a file path argument.');
        process.exit(1);
      }

      const ext = path.extname(attachPath).toLowerCase();

      // Handle CSV files separately (add to text content, not as attachments)
      if (ext === '.csv') {
        const rawContent = fs.readFileSync(attachPath, 'utf-8');
        const formattedContent = formatCsvAsTable(rawContent);
        csvAttachments.push(formattedContent);
      } else {
        // Handle images as attachments
        const attachObj = makeImageAttachment(attachPath);
        if (!attachObj) {
          console.error(`[ERROR] Could not attach file: ${attachPath}`);
          process.exit(1);
        }
        attachments.push(attachObj);
      }

    // Templates
    } else if (token === '--system-template-file') {
      systemTemplateFile = localArgs.shift();
    } else if (token === '--system-param') {
      const paramName = localArgs.shift();
      const paramValue = localArgs.shift();
      if (!paramName || !paramValue) {
        console.error('[ERROR] --system-param requires <name> <value>.');
        process.exit(1);
      }
      systemParamMap[paramName] = paramValue;
    } else if (token === '--system-param-file') {
      const paramName = localArgs.shift();
      const paramFile = localArgs.shift();
      if (!paramName || !paramFile) {
        console.error('[ERROR] --system-param-file requires <name> <filepath>.');
        process.exit(1);
      }
      try {
        systemParamMap[paramName] = fs.readFileSync(paramFile, 'utf-8');
      } catch (err) {
        console.error(`[ERROR] Could not read system-param-file for "${paramName}": ${paramFile}`);
        process.exit(1);
      }

    } else if (token === '--input-template-file') {
      inputTemplateFile = localArgs.shift();
    } else if (token === '--input-param') {
      const paramName = localArgs.shift();
      const paramValue = localArgs.shift();
      if (!paramName || !paramValue) {
        console.error('[ERROR] --input-param requires <name> <value>.');
        process.exit(1);
      }
      inputParamMap[paramName] = paramValue;
    } else if (token === '--input-param-file') {
      const paramName = localArgs.shift();
      const paramFile = localArgs.shift();
      if (!paramName || !paramFile) {
        console.error('[ERROR] --input-param-file requires <name> <filepath>.');
        process.exit(1);
      }
      try {
        inputParamMap[paramName] = fs.readFileSync(paramFile, 'utf-8');
      } catch (err) {
        console.error(`[ERROR] Could not read input-param-file for "${paramName}": ${paramFile}`);
        process.exit(1);
      }

    } else if (token.startsWith('--')) {
      console.error(`Unknown flag for "run": ${token}`);
      process.exit(1);
    } else {
      leftoverMessage = token + ' ' + localArgs.join(' ');
      localArgs.length = 0;
    }
  }

  let userMessage = '';
  if (!inputTemplateFile) {
    // Read from input file if provided
    let fileContent = '';
    if (userInputFile) {
      const rawContent = fs.readFileSync(userInputFile, 'utf-8');
      const ext = path.extname(userInputFile).toLowerCase();

      // Handle CSV files specially
      if (ext === '.csv') {
        fileContent = formatCsvAsTable(rawContent);
      } else {
        fileContent = rawContent;
      }
    }

    // Add CSV attachments to file content
    if (csvAttachments.length > 0) {
      const csvContent = csvAttachments.join('\n\n---\n\n');
      fileContent = fileContent ? `${fileContent}\n\n---\n\n${csvContent}` : csvContent;
    }

    // Combine file content with leftover message or stdin
    if (leftoverMessage) {
      // If we have both file content and a message, combine them
      if (fileContent) {
        userMessage = `${fileContent}\n\n${leftoverMessage.trim()}`;
      } else {
        userMessage = leftoverMessage.trim();
      }
    } else if (fileContent) {
      userMessage = fileContent;
    } else {
      userMessage = await readAllStdin();
    }

    if (!userMessage && attachments.length === 0) {
      console.error('[ERROR] No user message and no attachments provided.');
      process.exit(1);
    }
  }

  let userContent = '';
  if (inputTemplateFile) {
    if (leftoverMessage || userInputFile) {
      console.error('[ERROR] Cannot combine --input-template-file with leftover text or --input-file.');
      process.exit(1);
    }
    try {
      const templateRaw = fs.readFileSync(inputTemplateFile, 'utf-8');
      userContent = expandTemplate(templateRaw, inputParamMap);
    } catch (err) {
      console.error(`[ERROR] Could not read/expand input template file: ${inputTemplateFile}`);
      process.exit(1);
    }
  } else {
    userContent = userMessage;
  }

  if (attachments.length === 0) {
    // userContent stays a string
  } else {
    const arr = [];
    if (userContent) {
      // Wrap text content in proper format
      arr.push({ type: 'text', text: userContent });
    }
    for (const att of attachments) {
      arr.push(att);
    }
    userContent = arr;
  }

  let systemText = null;
  const systemOptionsCount = [systemTemplateFile, systemFile, systemPrompt].filter(Boolean).length;
  if (systemOptionsCount > 1) {
    console.error('[ERROR] Cannot combine --system, --system-file, and --system-template-file. Use only one.');
    process.exit(1);
  } else if (systemTemplateFile) {
    try {
      const raw = fs.readFileSync(systemTemplateFile, 'utf-8');
      systemText = expandTemplate(raw, systemParamMap);
    } catch (err) {
      console.error(`[ERROR] Could not read/expand system template file: ${systemTemplateFile}`);
      process.exit(1);
    }
  } else if (systemFile) {
    systemText = fs.readFileSync(systemFile, 'utf-8');
  } else if (systemPrompt) {
    systemText = systemPrompt;
  }

  if (forceFormat && forceSchemaFile) {
    console.error('[ERROR] Cannot specify both --force-response-format and --force-response-json-schema.');
    process.exit(1);
  }
  const invocationOptions = {};
  if (forceFormat) {
    invocationOptions.response_format = { type: forceFormat };
  }
  if (forceSchemaFile) {
    const schemaText = fs.readFileSync(forceSchemaFile, 'utf-8');
    let schemaObj = null;
    try {
      schemaObj = JSON.parse(schemaText);
    } catch (err) {
      console.error(`[ERROR] Could not parse JSON schema from file ${forceSchemaFile}`);
      process.exit(1);
    }
    invocationOptions.response_format = {
      type: 'json_schema',
      json_schema: { name: 'forced-schema', schema: schemaObj }
    };
  }

  const payload = {
    model: globalFlags.model,
    transcript: {
      messages: [
        { role: 'user', content: userContent }
      ]
    }
  };
  if (systemText) {
    payload.system = systemText;
  }
  if (Object.keys(invocationOptions).length > 0) {
    payload.options = invocationOptions;
  }

  const endpoint = `http://${globalFlags.hostname}:${globalFlags.port}${globalFlags.baseUrlPrefix}/api/charmonator/v1/transcript/extension`;

  // Debug logging
  if (process.env.DEBUG_CHARM) {
    console.error('[DEBUG] Payload:', JSON.stringify(payload, null, 2));
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const errBody = await response.text();
      console.error(`[ERROR] HTTP ${response.status} => ${errBody}`);
      process.exit(1);
    }
    const resultJson = await response.json();
    const assistantMessages = (resultJson.messages || []).filter(m => m.role === 'assistant');
    if (assistantMessages.length === 0) {
      console.log('(No assistant message returned.)');
      return;
    }
    for (const msg of assistantMessages) {
      if (typeof msg.content === 'string') {
        console.log(msg.content);
      } else if (Array.isArray(msg.content)) {
        msg.content.forEach(segment => {
          if (typeof segment === 'string') {
            console.log(segment);
          } else {
            console.log(`[Attachment returned: ${JSON.stringify(segment)}]`);
          }
        });
      } else {
        console.log(String(msg.content));
      }
    }
  } catch (err) {
    console.error('[ERROR] Failed to call /transcript/extension:', err.message);
    process.exit(1);
  }
}
