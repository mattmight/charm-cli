#!/usr/bin/env node

/* charm.mjs (the main entry point) */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

import { commandRun } from './commands/run.mjs';
import { commandChat } from './commands/chat.mjs';
import { commandTranscribe } from './commands/transcribe.mjs';
import { commandExtractMarkdown } from './commands/extract-markdown.mjs';
import { commandConvertServerConfig } from './commands/convert-server-config.mjs';
import { commandChunk } from './commands/chunk.mjs';
import { commandSummarize } from './commands/summarize.mjs';
import { commandList } from './commands/list.mjs';
import { commandMergeTranscriptions } from './commands/merge-transcriptions.mjs'; // <-- ADDED
import { commandConvert } from './commands/convert.mjs';

import { showHelp } from './help.mjs';

// Helper to load user config from ~/.config/charm/config.json
function loadUserConfig() {
  const configPath = path.join(os.homedir(), '.config', 'charm', 'config.json');
  let userConfig = {};
  try {
    if (fs.existsSync(configPath)) {
      const text = fs.readFileSync(configPath, 'utf-8');
      userConfig = JSON.parse(text);
    }
  } catch (err) {
    console.warn(`[WARN] Could not parse config at ${configPath}:`, err.message);
  }
  return userConfig;
}

// Default config
const defaultConfig = {
  port: 5002,
  hostname: 'localhost',
  baseUrlPrefix: '/charm',
  model: 'gpt-4o-mini'
};

// Merge user config
const userConfig = loadUserConfig();
const mergedConfig = { ...defaultConfig, ...userConfig };

// Parse CLI args
function parseArgs(argv) {
  const args = [...argv];
  const parsed = {
    _global: {},
    command: null,
    commandArgs: []
  };
  if (args[0] && args[0].match(/node(\.exe)?$/i)) args.shift();
  const scriptPath = fileURLToPath(import.meta.url);
  if (args[0] && path.basename(args[0]) === path.basename(scriptPath)) args.shift();

  while (args.length > 0) {
    if (!args[0].startsWith('--')) {
      parsed.command = args.shift();
      break;
    }
    const flag = args.shift();
    switch (flag) {
      case '--base-url-prefix':
        parsed._global.baseUrlPrefix = args.shift();
        break;
      case '--model':
        parsed._global.model = args.shift();
        break;
      case '--port':
        parsed._global.port = parseInt(args.shift(), 10);
        break;
      case '--hostname':
        parsed._global.hostname = args.shift();
        break;
      default:
        console.error(`Unknown global flag: ${flag}`);
        process.exit(1);
    }
  }
  if (!parsed.command && args.length > 0) {
    parsed.command = args.shift();
  }
  parsed.commandArgs = args;
  return parsed;
}

const parsed = parseArgs(process.argv);

// Merge final global flags
const finalGlobalFlags = {
  port: mergedConfig.port,
  hostname: mergedConfig.hostname,
  baseUrlPrefix: mergedConfig.baseUrlPrefix,
  model: mergedConfig.model
};
if (typeof parsed._global.port === 'number') {
  finalGlobalFlags.port = parsed._global.port;
}
if (typeof parsed._global.hostname === 'string') {
  finalGlobalFlags.hostname = parsed._global.hostname;
}
if (typeof parsed._global.baseUrlPrefix === 'string') {
  finalGlobalFlags.baseUrlPrefix = parsed._global.baseUrlPrefix;
}
if (typeof parsed._global.model === 'string') {
  finalGlobalFlags.model = parsed._global.model;
}

const command = parsed.command || 'help';
const cmdArgs = parsed.commandArgs;

// Main driver
async function main() {
  if (command === 'help' || command === null) {
    showHelp();
    process.exit(0);
  }

  switch (command) {
    case 'run':
      await commandRun(finalGlobalFlags, cmdArgs);
      break;
    case 'chat':
      await commandChat(finalGlobalFlags, cmdArgs);
      break;
    case 'transcribe':
      await commandTranscribe(finalGlobalFlags, cmdArgs);
      break;
    case 'extract-markdown':
      await commandExtractMarkdown(finalGlobalFlags, cmdArgs);
      break;
    case 'convert-server-config':
      await commandConvertServerConfig(finalGlobalFlags, cmdArgs);
      break;
    case 'chunk':
      await commandChunk(finalGlobalFlags, cmdArgs);
      break;
    case 'summarize':
      await commandSummarize(finalGlobalFlags, cmdArgs);
      break;
    case 'list':
      await commandList(finalGlobalFlags, cmdArgs);
      break;
    case 'merge-transcriptions': // <-- ADDED
      await commandMergeTranscriptions(finalGlobalFlags, cmdArgs);
      break;
    case 'convert':
      await commandConvert(finalGlobalFlags, cmdArgs);
      break;
    default:
      console.error(`[ERROR] Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

main().catch(err => {
  console.error('[ERROR] Uncaught exception:', err);
  process.exit(1);
});
