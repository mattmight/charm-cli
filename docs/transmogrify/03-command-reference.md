# Command Reference

Complete documentation of all flags and options for `charm transmogrify`.

## Command Syntax

```bash
charm [global-flags] transmogrify [transmogrify-flags] <input-file>
```

## Global Flags

These flags appear **before** the `transmogrify` command and affect the entire CLI session.

### `--model <model-name>`

Specify which AI model to use for conversions.

**Default:** Uses Charmonator server's default model

**Examples:**
```bash
charm --model gpt-4o transmogrify --to md input.pdf
charm --model claude-3-opus transmogrify --to json data.csv
```

**Notes:**
- Model must be supported by your Charmonator server
- Affects both interpreter and compiler guide execution
- Some models may be better for certain conversion types

---

### `--hostname <hostname>`

Specify the Charmonator server hostname.

**Default:** `localhost`

**Examples:**
```bash
charm --hostname api.example.com transmogrify --to md input.pdf
charm --hostname 192.168.1.100 transmogrify --to json data.csv
```

---

### `--port <port>`

Specify the Charmonator server port.

**Default:** `5002`

**Examples:**
```bash
charm --port 8080 transmogrify --to md input.pdf
charm --port 443 --hostname api.example.com transmogrify --to md input.pdf
```

---

### `--base-url-prefix <prefix>`

Specify a URL prefix for the Charmonator API.

**Default:** Empty string

**Examples:**
```bash
charm --base-url-prefix /api/v2 transmogrify --to md input.pdf
```

**Notes:**
- Useful for reverse proxies or versioned APIs
- Do not include trailing slash

---

## Transmogrify-Specific Flags

These flags appear **after** the `transmogrify` command.

### `--to <format>` (REQUIRED)

Specify the target output format.

**Format specifications:**
- File extension: `md`, `pdf`, `json`, `pptx`
- MIME type: `text/markdown`, `application/pdf`
- MIME with variant: `text/markdown; variant=GFM`
- Multi-word: Use quotes if contains spaces

**Examples:**
```bash
# By extension
charm transmogrify --to md input.pdf
charm transmogrify --to json data.csv
charm transmogrify --to pptx case.md

# By MIME type
charm transmogrify --to text/markdown input.pdf
charm transmogrify --to application/json data.csv

# With variant
charm transmogrify --to "text/markdown; variant=Obsidian" notes.md
```

**Notes:**
- This is the only required flag
- Determines routing and guide selection
- See [Format Specifications](./06-format-specifications.md) for details

---

### `--from <format>`

Explicitly specify the input format.

**Default:** Inferred from file extension

**Format specifications:** Same as `--to`

**Examples:**
```bash
# When extension doesn't match content
charm transmogrify --from pdf --to md document.dat

# Specify variant
charm transmogrify \
  --from "text/markdown; variant=GFM" \
  --to "text/markdown; variant=Obsidian" \
  notes.md
```

**When to use:**
- File has wrong or no extension
- Need to specify format variant
- Input format is ambiguous

**Notes:**
- Usually not needed (inferred automatically)
- Overrides file extension detection
- Affects guide scoring and selection

---

### `--from-file <path>`

Load input format specification from a file.

**Use case:** Complex multi-line format descriptions

**Example:**
```bash
charm transmogrify --from-file format-desc.txt --to md input.dat
```

**format-desc.txt example:**
```
text/markdown; variant=Obsidian

Obsidian-flavored markdown with:
- Wiki-style links: [[note-name]]
- YAML frontmatter
- Dataview queries
- Callouts with > [!type]
```

**Notes:**
- First line should be primary format (extension or MIME)
- Remaining lines are additional description
- Used for guide scoring (substring matching)
- Mutually exclusive with `--from`

---

### `--to-file <path>`

Load output format specification from a file.

**Use case:** Complex multi-line format descriptions

**Example:**
```bash
charm transmogrify --from md --to-file target-format.txt input.md
```

**target-format.txt example:**
```
application/vnd.openxmlformats-officedocument.presentationml.presentation

PowerPoint presentation with:
- Title slide
- Section dividers
- Bullet points for lists
- Tables for structured data
```

**Notes:**
- Same format as `--from-file`
- Helps guide select appropriate transformation
- Mutually exclusive with `--to`

---

### `--output <path>`

Specify the output file path.

**Default:** Input filename with new extension

**Examples:**
```bash
# Explicit path
charm transmogrify --to md --output /results/report.md scan.pdf

# Relative path
charm transmogrify --to json --output ../data/output.json data.csv

# Different directory
charm transmogrify --to pptx --output ~/Desktop/presentation.pptx case.md
```

**Default behavior:**
```bash
# Input: report.pdf, --to md
# Output: report.md (same directory)

# Input: /data/input.csv, --to json
# Output: /data/input.json
```

**Notes:**
- Parent directory must exist
- Overwrites existing files without warning
- Preserves input file (non-destructive)

---

### `--output-schema-file <path>`

Validate JSON output against a JSON Schema file.

**Use case:** Ensure structured output matches expected format

**Example:**
```bash
charm transmogrify \
  --to json \
  --output-schema-file patient-schema.json \
  data.csv
```

**patient-schema.json example:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["patients"],
  "properties": {
    "patients": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "name", "age"],
        "properties": {
          "id": { "type": "integer" },
          "name": { "type": "string" },
          "age": { "type": "integer", "minimum": 0, "maximum": 150 }
        }
      }
    }
  }
}
```

**Validation behavior:**
- **Always validates:** JSON syntax (even without schema)
- **With schema:** Validates structure, types, required fields
- **On success:** Proceeds normally
- **On failure:** Prints warnings, but still writes output (non-fatal)

**Notes:**
- Only applies to JSON output formats
- Uses Ajv validator (JSON Schema draft-07)
- Compiler guides can use schema to inform code generation
- Pass schema content to guide via `output_schema` variable

---

### `--guidance <text>`

Provide natural language instructions to customize the conversion.

**Use case:** Direct the conversion behavior without creating a custom guide

**Examples:**
```bash
# Extract specific information
charm transmogrify --to json \
  --guidance "Extract patient demographics and vital signs only" \
  medical-record.pdf

# Emphasize certain aspects
charm transmogrify --to pptx \
  --guidance "Focus on genomics and treatment resistance" \
  cancer-case.md

# Format instructions
charm transmogrify --to md \
  --guidance "Use tables for structured data, bullets for lists" \
  report.pdf

# De-identification
charm transmogrify --to json \
  --guidance "Remove all PHI and de-identify patient information" \
  clinical-notes.md
```

**How it's used:**
- Passed to AI model as additional context
- Rendered into system prompt via `{{guidance}}` in guide templates
- Can trigger special behavior (e.g., medical document optimization)
- Affects both interpreter and compiler guides

**Medical document optimization:**

When guidance contains keywords like `medical`, `patient`, or `clinical`, transmogrify automatically adds:
- **Intent:** "To come up with a diagnosis, a prognosis or a treatment option..."
- **Graphic instructions:** "Clearly describe the contents of graphics, images and figures..."

**Notes:**
- Keep guidance concise but specific
- Be explicit about what you want extracted/emphasized
- Works best with targeted instructions
- Mutually exclusive with `--guidance-file`

---

### `--guidance-file <path>`

Load guidance from a file.

**Use case:** Complex, multi-line guidance or reusable instructions

**Example:**
```bash
charm transmogrify --to json \
  --guidance-file extraction-rules.txt \
  medical-record.pdf
```

**extraction-rules.txt example:**
```
Extract the following information from this medical record:

1. Patient demographics (age, sex, relevant history)
2. Chief complaint and history of present illness
3. Vital signs and physical exam findings
4. Diagnostic test results (labs, imaging, pathology)
5. Assessment and diagnosis
6. Treatment plan and medications

Format as structured JSON with clear field names.
De-identify all PHI (names, dates, locations, IDs).
Use null for missing values, not empty strings.
```

**Notes:**
- Entire file content is used as guidance
- Preserves formatting (useful for structured instructions)
- Mutually exclusive with `--guidance`

---

### `--guide <name>`

Force a specific guide instead of automatic selection.

**Default:** Automatically selects best-matching guide

**Use case:** Override automatic routing

**Examples:**
```bash
# Use generic compiler for any conversion
charm transmogrify --guide generic-compiler --to json data.csv

# Force specific guide
charm transmogrify --guide oncology-pptx --to pptx case.md

# Test guide selection
charm transmogrify --dry-run --guide my-custom-guide --to md input.pdf
```

**How guide selection works without `--guide`:**
1. Score all guides based on format compatibility
2. Select highest-scoring guide
3. Tie-breaker: prefer interpreter, then lexicographic name

**When to use `--guide`:**
- Testing a newly created guide
- Forcing generic-compiler for unusual conversions
- Overriding automatic selection
- Debugging routing issues

**Notes:**
- Guide must exist in guides directory
- Guide must be loaded successfully (valid JSON, etc.)
- Format compatibility is not checked when forced
- See [Guide System](./05-guide-system.md) for guide structure

---

### `--guides-dir <path>`

Specify a custom directory for guides.

**Default:** `./guides` (relative to charm-cli installation)

**Use case:** Use custom or organization-specific guides

**Examples:**
```bash
# Use company guides
charm transmogrify --guides-dir /opt/company-guides --to json data.csv

# Test development guides
charm transmogrify --guides-dir ~/my-guides --to md input.pdf
```

**Directory structure:**
```
custom-guides/
├── my-guide-1/
│   ├── type.json
│   ├── inputs.json
│   ├── outputs.json
│   ├── SYSTEM.hbs
│   └── description.md
└── my-guide-2/
    ├── type.json
    ├── ...
```

**Notes:**
- All guides in directory are loaded
- Invalid guides are skipped with warnings
- Built-in guides are not available unless copied
- See [Guide Development](./08-guide-development.md) for guide structure

---

### `--dry-run`

Preview routing decisions without executing the conversion.

**Use case:** Understand which conversion pathway will be used

**Examples:**
```bash
# Preview routing
charm transmogrify --dry-run --to md document.pdf
# Output:
# [DRY RUN MODE]
# Input format: pdf (application/pdf)
# Output format: md (text/markdown)
# Route: PDF conversion (Charmonizer image PDF endpoint)

# Check guide selection
charm transmogrify --dry-run --to pptx case.md
# Output:
# [DRY RUN MODE]
# ...
# Route: oncology-pptx (compiler)

# Test format resolution
charm transmogrify --dry-run \
  --from "text/markdown; variant=GFM" \
  --to "text/markdown; variant=Obsidian" \
  notes.md
```

**Output information:**
- Resolved input format (extension, MIME, description)
- Resolved output format
- Selected route:
  - `charm convert` (docx→md, pptx→md, doc.json→md)
  - `PDF conversion` (pdf→md via Charmonizer)
  - `<guide-name> (interpreter)` (direct AI transformation)
  - `<guide-name> (compiler)` (AI-generated code)

**Notes:**
- No files are read (except for format detection)
- No API calls are made
- No code is generated or executed
- Useful for debugging routing issues
- Fast and safe

---

### `--yes`

Skip confirmation prompts for compiler-based conversions.

**Default:** Interactive confirmation required

**Use case:** Automation, CI/CD, trusted environments

**Examples:**
```bash
# Skip confirmation
charm transmogrify --yes --to json data.csv

# Batch processing
for file in *.csv; do
  charm transmogrify --yes --to json "$file"
done
```

**Normal behavior (without `--yes`):**
```
[INFO] Using guide: generic-compiler (compiler)
[INFO] Generating compiler script...

[WARN] About to execute model-generated Python code.
Review the code at: /tmp/charm-transmog-abc123/compile.py

Execute? [y/N]
```

**With `--yes`:**
```
[INFO] Using guide: generic-compiler (compiler)
[INFO] Generating compiler script...
[INFO] Executing compiler...
[SUCCESS] Output written to output.json
```

**Alternative:** Set environment variable
```bash
export CHARM_TRANSMOGRIFY_TRUST_COMPILED=1
charm transmogrify --to json data.csv
```

**Security considerations:**
- Only use in trusted environments
- Review generated code first with `--keep-sandbox`
- Understand the risks of executing model-generated code
- Consider using interpreter guides when possible

**Notes:**
- Only affects compiler guides
- Interpreter guides never prompt (no code execution)
- Built-in conversions never prompt
- PDF endpoint never prompts

---

### `--keep-sandbox`

Keep temporary sandbox directory after execution.

**Default:** Sandbox is deleted after execution

**Use case:** Inspect generated code, debug failures

**Examples:**
```bash
# Keep sandbox for inspection
charm transmogrify --keep-sandbox --to json data.csv

# Output will show sandbox location:
# [INFO] Sandbox directory: /tmp/charm-transmog-abc123
# [INFO] Generated code: /tmp/charm-transmog-abc123/compile.py
```

**Sandbox contents:**
```
/tmp/charm-transmog-abc123/
├── compile.py          # Generated Python code
├── helpers.py          # Helper functions (if provided by guide)
├── input.txt           # Copy of input file
└── output.json         # Generated output
```

**Use cases:**
- **Debug failures:** Inspect generated code to see why it failed
- **Review code:** Examine code before trusting it with `--yes`
- **Learn:** Understand how guides work
- **Improve guides:** See what code is being generated

**Notes:**
- Only applies to compiler guides
- Sandbox is in system temp directory
- Must manually delete sandbox directory
- Contains sensitive data (input files)

---

### `--compiler-timeout <seconds>`

Set timeout for compiler script execution.

**Default:** `120` seconds (2 minutes)

**Use case:** Long-running conversions or prevent runaway processes

**Examples:**
```bash
# Increase timeout for large files
charm transmogrify --compiler-timeout 300 --to json large-file.csv

# Decrease timeout for safety
charm transmogrify --compiler-timeout 30 --to json untrusted.csv
```

**Behavior:**
- Script is killed if timeout is exceeded
- Exit with error code 3 (MODEL_FAILURE)
- Partial output may be written

**Notes:**
- Only affects compiler guides
- No effect on interpreter guides or native endpoints
- PDF conversions use their own timeout (not affected)

---

## Positional Arguments

### `<input-file>` (REQUIRED)

Path to the input file to convert.

**Examples:**
```bash
charm transmogrify --to md document.pdf
charm transmogrify --to json ../data/input.csv
charm transmogrify --to pptx /path/to/case.md
```

**Notes:**
- Must be a readable file
- File extension used for format detection (unless `--from` specified)
- Supports absolute and relative paths

---

## Exit Codes

Transmogrify uses standard exit codes:

| Code | Constant | Meaning |
|------|----------|---------|
| 0 | SUCCESS | Conversion completed successfully |
| 1 | INVALID_FLAGS | Invalid arguments, missing required flags, file not found |
| 3 | MODEL_FAILURE | API error, conversion failure, timeout, validation error |

**Examples:**
```bash
# Check exit code
charm transmogrify --to md input.pdf
echo $?  # 0 if success

# Use in scripts
if charm transmogrify --to json data.csv; then
  echo "Success"
else
  echo "Failed with code $?"
fi
```

---

## Flag Combinations

### Compatible Flags

These flags work together:

```bash
# Full control over formats and guidance
charm transmogrify \
  --from pdf \
  --to md \
  --output result.md \
  --guidance "Extract clinical data" \
  input.pdf

# Force guide with schema validation
charm transmogrify \
  --guide generic-compiler \
  --to json \
  --output-schema-file schema.json \
  --guidance "Include summary statistics" \
  data.csv

# Automation mode
charm transmogrify \
  --yes \
  --keep-sandbox \
  --compiler-timeout 300 \
  --to json \
  large-file.csv
```

### Mutually Exclusive Flags

These flags cannot be used together:

| Flag 1 | Flag 2 | Behavior |
|--------|--------|----------|
| `--from` | `--from-file` | Error: Cannot specify both |
| `--to` | `--to-file` | Error: Cannot specify both |
| `--guidance` | `--guidance-file` | Error: Cannot specify both |

### Flag Precedence

When multiple sources provide the same information:

1. **Format specification:**
   - `--from` or `--from-file` > file extension
   - `--to` or `--to-file` (required, no fallback)

2. **Guidance:**
   - `--guidance` or `--guidance-file` > (none)

3. **Guide selection:**
   - `--guide` > automatic scoring

---

## Environment Variables

### `CHARM_TRANSMOGRIFY_TRUST_COMPILED`

Skip confirmation prompts for compiler guides.

**Equivalent to:** `--yes` flag

**Usage:**
```bash
export CHARM_TRANSMOGRIFY_TRUST_COMPILED=1
charm transmogrify --to json data.csv
```

**Notes:**
- `--yes` flag takes precedence
- Set to any non-empty value to enable
- Use in automation/CI environments

---

## Common Flag Patterns

### Quick Conversions
```bash
# Minimal flags (automatic everything)
charm transmogrify --to md input.pdf
```

### Guided Conversions
```bash
# Add guidance for better results
charm transmogrify --to json \
  --guidance "Extract patient demographics" \
  medical-record.pdf
```

### Validated Output
```bash
# Ensure output matches schema
charm transmogrify --to json \
  --output-schema-file schema.json \
  data.csv
```

### Format Variants
```bash
# Convert between markdown variants
charm transmogrify \
  --from "text/markdown; variant=GFM" \
  --to "text/markdown; variant=Obsidian" \
  notes.md
```

### Automation
```bash
# Fully automated with timeout
charm transmogrify \
  --yes \
  --compiler-timeout 300 \
  --to json \
  --output /results/output.json \
  input.csv
```

### Debugging
```bash
# Inspect generated code
charm transmogrify \
  --keep-sandbox \
  --dry-run \
  --to json \
  data.csv

# Then run with inspection
charm transmogrify \
  --keep-sandbox \
  --to json \
  data.csv
```

---

## Next Steps

- **Understand routing:** [Routing System](./04-routing-system.md)
- **Learn about guides:** [Guide System](./05-guide-system.md)
- **Format specifications:** [Format Specifications](./06-format-specifications.md)
- **See examples:** [Examples](./07-examples.md)
