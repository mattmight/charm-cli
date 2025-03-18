/* commands/list.mjs */
import fetch from 'node-fetch';

export async function commandList(globalFlags, cmdArgs) {
  const endpoint = `http://${globalFlags.hostname}:${globalFlags.port}${globalFlags.baseUrlPrefix}/api/charmonator/v1/models`;
  try {
    const resp = await fetch(endpoint);
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[ERROR] GET /models => HTTP ${resp.status} => ${errText}`);
      process.exit(1);
    }
    const data = await resp.json();
    if (!data.models) {
      console.log('No model list found in response.');
      return;
    }

    console.log('Available models:\n');
    for (const m of data.models) {
      // Each model object typically has { id, name, description }
      console.log(`  ID:   ${m.id}`);
      console.log(`  Name: ${m.name || '(no name)'}`);
      if (m.description) {
        console.log(`  Desc: ${m.description}`);
      }
      console.log('');
    }
  } catch (err) {
    console.error('[ERROR] Failed to retrieve models:', err.message);
    process.exit(1);
  }
}
