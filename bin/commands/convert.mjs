/* commands/convert.mjs */
import fs from 'fs';
import path from 'path';

export async function commandConvert(globalFlags, cmdArgs) {
  if (cmdArgs.length < 2) {
    console.error('[ERROR] Usage: charm convert <input-file> <output-file>');
    process.exit(1);
  }

  const inputPath = cmdArgs[0];
  const outputPath = cmdArgs[1];

  if (!fs.existsSync(inputPath)) {
    console.error(`[ERROR] Input file does not exist: ${inputPath}`);
    process.exit(1);
  }

  const inputExt = path.extname(inputPath).toLowerCase();
  const outputExt = path.extname(outputPath).toLowerCase();

  try {
    if (inputExt === '.json' && inputPath.endsWith('.doc.json') && outputExt === '.md') {
      await convertDocJsonToMarkdown(inputPath, outputPath);
    } else {
      console.error(`[ERROR] Unsupported conversion: ${inputExt} to ${outputExt}`);
      console.error('Currently supported conversions:');
      console.error('  .doc.json -> .md');
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