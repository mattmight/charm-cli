/* commands/chat.mjs */
import fs from 'fs';
import fetch from 'node-fetch';
import readline from 'readline';
import { questionAsync } from '../utils.mjs';

export async function commandChat(globalFlags, cmdArgs) {
  let systemFile = null;
  const localArgs = [...cmdArgs];
  while (localArgs.length > 0) {
    if (localArgs[0] === '--system') {
      localArgs.shift();
      systemFile = localArgs.shift();
    } else {
      console.error(`[ERROR] Unknown flag for "chat": ${localArgs[0]}`);
      process.exit(1);
    }
  }

  let systemText = null;
  if (systemFile) {
    try {
      systemText = fs.readFileSync(systemFile, 'utf-8');
    } catch (err) {
      console.error(`[ERROR] Could not read --system file: ${systemFile}\n`, err.message);
      process.exit(1);
    }
  }

  const transcript = { messages: [] };

  console.log('Entering chat mode. Type "exit" or "quit" to end.\n');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  while (true) {
    const userInput = await questionAsync(rl, '> ');
    if (!userInput.trim()) continue;
    if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
      console.log('Exiting chat.');
      break;
    }

    transcript.messages.push({ role: 'user', content: userInput });

    const payload = {
      model: globalFlags.model,
      transcript,
      options: { stream: false }
    };
    if (systemText) {
      payload.system = systemText;
    }

    const endpoint = `http://${globalFlags.hostname}:${globalFlags.port}${globalFlags.baseUrlPrefix}/api/charmonator/v1/transcript/extension`;
    let resultJson;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errBody = await response.text();
        console.error(`[ERROR] HTTP ${response.status} => ${errBody}`);
        continue;
      }
      resultJson = await response.json();
    } catch (err) {
      console.error('[ERROR] Failed to call /transcript/extension:', err.message);
      continue;
    }

    const assistantMessages = (resultJson.messages || []).filter(m => m.role === 'assistant');
    for (const msg of assistantMessages) {
      transcript.messages.push(msg);
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
  }

  rl.close();
}
