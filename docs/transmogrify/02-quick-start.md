# Quick Start

Get started with `charm transmogrify` in 5 minutes.

## Prerequisites

1. **charm-cli installed**: `charm` command available
2. **Charmonator server running**: Required for AI-powered conversions
3. **Python 3.8+**: Required for compiler-based conversions
4. **python-pptx** (optional): Required for PowerPoint generation

```bash
# Verify charm is installed
charm help

# Check server connection
charm list

# Install optional dependencies
pip install python-pptx
```

## Your First Conversion

### Example 1: PDF to Markdown

Convert a PDF document to markdown:

```bash
# Basic conversion
charm transmogrify --to md document.pdf

# Output: document.md
```

This uses the Charmonizer image PDF endpoint with:
- OCR for text extraction
- Vision models for images/graphics
- Automatic page markers
- Metadata preservation

**Try it:**
```bash
cd examples/transmogrify/pdf-to-markdown
./run.sh
```

### Example 2: Markdown to PowerPoint

Convert a markdown oncology case to a PowerPoint presentation:

```bash
# With custom guidance
charm transmogrify --to pptx \
  --guidance "Focus on genomics and treatment options" \
  patient-case.md

# Output: patient-case.pptx
```

This uses a specialized compiler guide that:
- Generates Python code
- Extracts structured data
- Creates formatted slides
- De-identifies patient information

**Try it:**
```bash
cd examples/transmogrify/oncology-pptx
./run.sh
```

### Example 3: CSV to JSON with Validation

Convert CSV data to validated JSON:

```bash
# With schema validation
charm transmogrify --to json \
  --output-schema-file schema.json \
  --guidance "Include summary statistics" \
  data.csv

# Output: data.json
```

This uses the generic compiler guide to:
- Parse CSV data
- Convert types (strings → integers)
- Compute summaries
- Validate against JSON schema

**Try it:**
```bash
cd examples/transmogrify/csv-to-json
./run.sh
```

## Basic Usage Patterns

### Simple Conversion

```bash
# Auto-generate output filename
charm transmogrify --to <format> input-file

# Examples:
charm transmogrify --to md report.pdf
charm transmogrify --to json data.csv
charm transmogrify --to pptx case.md
```

### Specify Output Path

```bash
charm transmogrify --to <format> --output <path> input-file

# Example:
charm transmogrify --to md --output /results/report.md scan.pdf
```

### Add Guidance

```bash
charm transmogrify --to <format> \
  --guidance "Custom instructions" \
  input-file

# Example:
charm transmogrify --to json \
  --guidance "Extract patient demographics and vital signs" \
  medical-record.pdf
```

### Preview Routing (Dry Run)

```bash
charm transmogrify --dry-run --to <format> input-file

# Example:
charm transmogrify --dry-run --to pptx case.md
# Output:
# Route: oncology-pptx (compiler)
```

## Understanding Output

### Success

```
[INFO] Using guide: oncology-pptx (compiler)
[INFO] Generating compiler script...
[INFO] Executing compiler...
[SUCCESS] Output written to output.pptx
```

### With Progress (PDF Conversion)

```
[INFO] Routing to PDF conversion (Charmonizer image PDF endpoint)...
[INFO] Job submitted: abc-123-def
[INFO] Polling for completion...
[INFO] Progress: 1/5 pages (processing)
[INFO] Progress: 2/5 pages (processing)
...
[INFO] Conversion complete!
[SUCCESS] Output written to document.md
```

### With Confirmation (Compiler Mode)

```
[INFO] Using guide: generic-compiler (compiler)
[INFO] Generating compiler script...

[WARN] About to execute model-generated Python code.
Review the code at: /tmp/charm-transmog-abc123/compile.py

Execute? [y/N] y

[INFO] Executing compiler...
[SUCCESS] Output written to output.json
```

## Common Options

### Global Flags (Before Command)

```bash
# Use different model
charm --model gpt-4 transmogrify --to md input.pdf

# Connect to different server
charm --hostname myserver --port 8080 transmogrify --to md input.pdf
```

### Transmogrify-Specific Flags

| Flag | Purpose | Example |
|------|---------|---------|
| `--to <format>` | Target format (required) | `--to md` |
| `--from <format>` | Source format (optional, inferred) | `--from pdf` |
| `--output <path>` | Output file path | `--output result.md` |
| `--guidance <text>` | Custom instructions | `--guidance "Extract tables"` |
| `--guidance-file <file>` | Load guidance from file | `--guidance-file inst.txt` |
| `--output-schema-file <file>` | JSON schema for validation | `--output-schema-file schema.json` |
| `--guide <name>` | Force specific guide | `--guide generic-compiler` |
| `--dry-run` | Preview routing only | `--dry-run` |
| `--yes` | Skip confirmation | `--yes` |
| `--keep-sandbox` | Don't delete temp files | `--keep-sandbox` |

## Workflow Examples

### Medical Record Processing

```bash
# Step 1: PDF to Markdown
charm transmogrify --to md \
  --guidance "Medical record with clinical notes" \
  patient-chart.pdf

# Step 2: Markdown to Structured JSON
charm transmogrify --to json \
  --output-schema-file patient-schema.json \
  --guidance "Extract demographics, diagnoses, medications" \
  patient-chart.md

# Step 3: Markdown to Presentation
charm transmogrify --to pptx \
  --guidance "Tumor board presentation" \
  patient-chart.md
```

### Data Migration Pipeline

```bash
# Legacy CSV to validated JSON
for file in legacy-data/*.csv; do
  charm transmogrify --to json \
    --output-schema-file schema.json \
    --guidance "Compute summary statistics" \
    "$file"
done
```

### Documentation Conversion

```bash
# GitHub markdown to Obsidian
charm transmogrify \
  --from "text/markdown; variant=GFM" \
  --to "text/markdown; variant=Obsidian" \
  --guidance "Add frontmatter, convert to wiki links" \
  README.md
```

## Working with Examples

All examples are in `examples/transmogrify/`:

```bash
# List examples
ls examples/transmogrify/

# Run specific example
cd examples/transmogrify/oncology-pptx
./run.sh

# View example documentation
cat examples/transmogrify/oncology-pptx/README.md
```

**Available examples:**

1. **oncology-pptx**: Markdown cancer case → PowerPoint
2. **pdf-to-markdown**: PDF medical record → Markdown
3. **csv-to-json**: CSV data → Validated JSON
4. **markdown-variants**: GFM → Obsidian markdown

## Troubleshooting Quick Fixes

### "No suitable guide found"

```bash
# Use dry-run to see format resolution
charm transmogrify --dry-run --to <format> input-file

# Explicitly specify formats
charm transmogrify --from pdf --to md input-file

# Use generic compiler (works for any format)
charm transmogrify --guide generic-compiler --to <format> input-file
```

### "python-pptx not found"

```bash
# Install required package
pip install python-pptx

# Verify installation
python3 -c "import pptx; print('OK')"
```

### "Charmonator API call failed"

```bash
# Check server is running
charm list

# Verify connection settings
charm --hostname localhost --port 5002 list

# Check server logs for errors
```

### Code execution concerns

```bash
# Review code before execution
charm transmogrify --keep-sandbox --to <format> input-file
# Check: /tmp/charm-transmog-*/compile.py

# Skip confirmation (if trusted)
charm transmogrify --yes --to <format> input-file

# Or use environment variable
export CHARM_TRANSMOGRIFY_TRUST_COMPILED=1
charm transmogrify --to <format> input-file
```

## Next Steps

Now that you've tried basic conversions:

1. **Learn all flags**: [Command Reference](./03-command-reference.md)
2. **Understand routing**: [Routing System](./04-routing-system.md)
3. **Explore guides**: [Guide System](./05-guide-system.md)
4. **See more examples**: [Examples](./07-examples.md)
5. **Create custom guides**: [Guide Development](./08-guide-development.md)

## Quick Reference Card

```bash
# Basic conversion
charm transmogrify --to md input.pdf

# With guidance
charm transmogrify --to json --guidance "Extract key fields" data.csv

# With schema validation
charm transmogrify --to json --output-schema-file schema.json data.csv

# Preview routing
charm transmogrify --dry-run --to pptx case.md

# Custom output
charm transmogrify --to md --output /path/to/output.md input.pdf

# Skip confirmation
charm transmogrify --yes --to json data.csv

# Force specific guide
charm transmogrify --guide oncology-pptx --to pptx case.md

# Different model
charm --model gpt-4o transmogrify --to md input.pdf
```

## Example Session

```bash
# 1. Check what route will be used
$ charm transmogrify --dry-run --to md report.pdf
[DRY RUN MODE]
Route: PDF conversion (Charmonizer image PDF endpoint)

# 2. Run the conversion
$ charm transmogrify --to md report.pdf
[INFO] Routing to PDF conversion...
[INFO] Job submitted: abc-123
[INFO] Progress: 1/3 pages (processing)
[INFO] Progress: 2/3 pages (processing)
[INFO] Progress: 3/3 pages (processing)
[INFO] Conversion complete!
[SUCCESS] Output written to report.md

# 3. Verify output
$ head -20 report.md
<!--
filename: report.pdf
sha256: a1b2c3...
size: 524288 bytes
-->

# Page 1

[Content here...]

# 4. Further transform to JSON
$ charm transmogrify --to json --guidance "Extract sections" report.md
[INFO] Using guide: generic-compiler (compiler)
Execute? [y/N] y
[SUCCESS] Output written to report.json
```

You're now ready to use `charm transmogrify` for your file conversion needs!
