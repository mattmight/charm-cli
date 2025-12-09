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
  --guides-path <paths>        Colon-separated list of paths to search for guides
                               (built-in ./guides/ is always searched last)
  --conf <path>                Path to a custom config file
                               (Default: ~/.config/charm/config.json)

Commands:
  run [flags] [<user message>]
    --system <text>
    --system-file <file>
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
    --system <text>
    --system-file <file>
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
    --guide <name>              (use a preset guide, e.g., health-records)
    --guides-dir <path>         (custom guides directory)
    --list-guides               (list available summarizer guides)
    --tokens-budget <int>       (max tokens for summary, for map/fold methods)
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

  convert <input-file> [<output-file>] [flags]
    --to <extension>
    (Converts files between formats. Use --to flag for auto-naming or specify output file.)
    (Supported conversions: .doc.json -> .md, .docx -> .md)

  append <input1.doc.json> <input2.doc.json> [<input3.doc.json> ...] [flags]
    --output <file>
    (Appends multiple JSON documents together, preserving each as a separate chunk in a 'documents' chunk group.)

  transmogrify [flags] <input-file>
    --guide <name>
    --guidance <string>
    --guidance-file <file>
    --from <format>
    --from-file <file>
    --to <format>
    --to-file <file>
    --output <path>
    --output-schema-file <file>
    --guides-dir <path>
    --keep-sandbox
    --dry-run
    --yes
    (Performs complex format conversions using AI-generated code. Falls back to 'convert' when possible.)

  json-doc <subcommand> [options]
    Subcommands:
      extract-markdown <file.doc.json> [--metadata]
          Extract markdown content from a document.

      extract-summary <file.doc.json> [--field <name>] [--separator <sep>]
          Extract summary annotation from a document.

      extract-chunk-annotations <file.doc.json> --chunk-group <name> [--target <name>] [--metadata]
          Extract annotations from each chunk in a chunk group.

      merge-chunks <file.doc.json> --max-tokens <n> [--encoding <name>] [--chunk-group <name>] [--new-group <name>] [--overlap <n>] [--output <file>] [--inline]
          Merge small chunks into larger ones up to max_tokens.

      concatenate <output.doc.json> <input1.doc.json> [input2.doc.json ...]
          Combine multiple documents into a single master document.

      wrap [--output <file>]
          Read raw content from stdin and wrap it into a document.

Examples:
  charm run "Hello"
  charm run --attach cat.png "Here's my cat!"
  charm --model gpt-4o run --system-file system.md --force-response-format json_object "Time?"
  charm transcribe mydoc.pdf --description "A PDF doc" --poll-interval 5
  charm transcribe mydoc.pdf --continue-on-failure --description "Medical document"
  charm transcribe mydoc.pdf --output-format md --input-document-type medical
  charm transcribe batch-files.txt --batch --continue-on-failure --output-format md
  charm extract-markdown sample.pdf
  charm convert-server-config /path/to/charmonator/server/config.json
  charm chat --system-file system.md
  charm chunk --input mydoc.doc.json --strategy merge_and_split --chunk-size 1000
  charm summarize --input mydoc.doc.json --method map ...
  charm summarize --input patient-records.doc.json --guide health-records
  charm summarize --list-guides
  charm list
  charm merge-transcriptions --output final.doc.json scan1.doc.json scan2.doc.json
  charm convert document.doc.json output.md
  charm convert document.doc.json --to md
  charm convert document.docx --to md
  charm append doc1.doc.json doc2.doc.json doc3.doc.json --output combined.doc.json
  charm append doc1.doc.json doc2.doc.json
  charm transmogrify --to md paper.docx
  charm transmogrify note.md --to json --output-schema-file schema.json --guidance "Extract key data"
  charm transmogrify data.csv --to json --dry-run
  charm json-doc extract-markdown document.doc.json
  charm json-doc extract-summary document.doc.json --field summary
  charm json-doc merge-chunks document.doc.json --max-tokens 2048 --chunk-group pages
  charm json-doc concatenate combined.doc.json doc1.doc.json doc2.doc.json
  echo "Hello world" | charm json-doc wrap --output wrapped.doc.json
`);
}
