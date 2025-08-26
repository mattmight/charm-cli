/* help.mjs */

export function showHelp() {
  console.log(`
Usage:
  charm [global-flags] <command> [options...]

Global Flags:
  --base-url-prefix <prefix>   (Default: "/charm" or config override)
  --model <modelName>          (Default: "gpt-4o-mini" or config override)
  --port <number>              (Default: 5002 or config override)
  --hostname <name>            (Default: "localhost" or config override)

Commands:
  run [flags] [<user message>]
    --system <file>
    --input-file <file>
    --force-response-format <format>
    --force-response-json-schema <file>
    --attach <file>
    --system-template-file <file>
    --system-param <name> <value>
    --system-param-file <name> <file>
    --input-template-file <file>
    --input-param <name> <value>
    --input-param-file <name> <file>

  chat [flags]
    --system <file>
    (Enters an interactive chat loop. Type "quit" or "exit" to stop.)

  transcribe <file>.pdf|.docx|batch.txt [flags]
    --output <file>
    --description <string>
    --intent <string>
    --graphic-instructions <str>
    --detect-document-boundaries
    --no-page-numbering
    --ocr-threshold <float>
    --poll-interval <seconds>
    --continue-on-failure
    --output-format <doc.json|md>
    --input-document-type <medical>
    --batch

  extract-markdown <file> [flags]
    --output <file>

  convert-server-config <path-to-charmonator-server-conf/config.json>

  chunk [flags]
    --input <doc.json>
    --strategy <string>
    --chunk-size <int>
    --input-chunk-group-name <str>
    --output-chunk-group-name <str>
    --inline
    --output <file>
    --poll-interval <seconds>

  summarize [flags]
    --input <doc.json>
    --method <full|map|fold|delta-fold|map-merge|merge>
    --chunk-group <str>
    --context-chunks-before <int>
    --context-chunks-after <int>
    --guidance <string>
    --guidance-file <file>
    --temperature <float>
    --annotation-field <str>
    --annotation-field-delta <str>
    --merge-summaries-guidance <str>
    --merge-summaries-guidance-file <file>
    --initial-summary <str>
    --initial-summary-file <file>
    --json-schema <file>
    --json-schema-file <file>
    --inline
    --output-file <path>
    --poll-interval <seconds>

  list
    (Lists available models from the server.)

  merge-transcriptions [flags] <doc1.doc.json> <doc2.doc.json>...
    --output <file>
    --chunk-group <str>
    --poll-interval <seconds>
    (Merges multiple .doc.json transcriptions into a single merged doc.)

Examples:
  charm run "Hello"
  charm run --attach cat.png "Here's my cat!"
  charm --model gpt-4o run --system system.md --force-response-format json_object "Time?"
  charm transcribe mydoc.pdf --description "A PDF doc" --poll-interval 5
  charm transcribe mydoc.pdf --continue-on-failure --description "Medical document"
  charm transcribe mydoc.pdf --output-format md --input-document-type medical
  charm transcribe batch-files.txt --batch --continue-on-failure --output-format md
  charm extract-markdown sample.pdf
  charm convert-server-config /path/to/charmonator/server/config.json
  charm chat --system system.md
  charm chunk --input mydoc.doc.json --strategy merge_and_split --chunk-size 1000
  charm summarize --input mydoc.doc.json --method map ...
  charm list
  charm merge-transcriptions --output final.doc.json scan1.doc.json scan2.doc.json
`);
}
