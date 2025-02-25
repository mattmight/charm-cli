/* commands/convert-server-config.mjs */
import fs from 'fs';
import path from 'path';
import os from 'os';
import readline from 'readline';
import { questionAsync } from '../utils.mjs';

function promptYesNo(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return questionAsync(rl, question).then(answer => {
    rl.close();
    return answer.trim().toLowerCase();
  });
}

export async function commandConvertServerConfig(globalFlags, cmdArgs) {
  if (cmdArgs.length < 1) {
    console.error('[ERROR] No path to server config.json provided.');
    process.exit(1);
  }
  const serverConfigPath = cmdArgs[0];

  let serverConf;
  try {
    const raw = fs.readFileSync(serverConfigPath, 'utf-8');
    serverConf = JSON.parse(raw);
  } catch (err) {
    console.error(`[ERROR] Could not read/parse server config at ${serverConfigPath}:`, err.message);
    process.exit(1);
  }

  const localConf = {};

  // 1) Pull port
  if (serverConf.server && typeof serverConf.server.port === 'number') {
    localConf.port = serverConf.server.port;
  } else {
    localConf.port = 5002;
  }

  // 2) Use hostname = 'localhost'
  localConf.hostname = 'localhost';

  // 3) baseUrl => baseUrlPrefix
  const rawBaseUrl =
    serverConf.server && serverConf.server.baseUrl
      ? serverConf.server.baseUrl
      : '/ai2';
  localConf.baseUrlPrefix = rawBaseUrl.replace(/^\/+/, '');

  // 4) default model
  if (serverConf.models && typeof serverConf.models === 'object') {
    const modelNames = Object.keys(serverConf.models);
    if (modelNames.length > 0) {
      localConf.model = modelNames[0];
    }
  }
  if (!localConf.model) {
    localConf.model = 'gpt-4o-mini';
  }

  const charmDir = path.join(os.homedir(), '.config', 'charm');
  const localPath = path.join(charmDir, 'config.json');

  if (fs.existsSync(localPath)) {
    console.log(`[INFO] A local config file already exists at: ${localPath}`);
    const answer = await promptYesNo('Overwrite? [y/N]: ');
    if (answer !== 'y') {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  try {
    fs.mkdirSync(charmDir, { recursive: true });
  } catch (err) {
    // ignore if exists
  }

  try {
    fs.writeFileSync(localPath, JSON.stringify(localConf, null, 2), 'utf-8');
    console.log(`Wrote local charm config to: ${localPath}`);
    console.log('Done.');
  } catch (err) {
    console.error('[ERROR] Could not write local charm config:', err.message);
    process.exit(1);
  }
}
