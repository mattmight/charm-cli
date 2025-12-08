# Examples

Real-world usage examples demonstrating charm transmogrify's capabilities.

## Running the Examples

All examples are located in `examples/transmogrify/` with working input files and executable scripts.

### Quick Start

```bash
# Run any example
cd examples/transmogrify/<example-name>
./run.sh

# Preview routing (dry-run)
./run.sh --dry-run

# Skip confirmation
./run.sh --yes
```

---

## Example 1: Oncology PowerPoint

**Location:** `examples/transmogrify/oncology-pptx/`

### Overview

Convert a comprehensive markdown cancer case into a professional PowerPoint presentation suitable for tumor board discussions.

**Input:** 292-line markdown file with:
- Patient demographics and history
- Diagnostic information
- Genomic/molecular data
- Treatment history
- Imaging findings

**Output:** 14-slide PowerPoint presentation with:
- Title slide
- Clinical history
- Genomic data tables
- Treatment options
- De-identified patient information

### Files

```
oncology-pptx/
├── run.sh                       # Executable script
├── README.md                    # Detailed documentation
├── EXPECTED-OUTPUT.md           # Output structure description
└── synthetic-cancer-case.md     # Sample cancer case (292 lines)
```

### Usage

**Basic:**
```bash
cd examples/transmogrify/oncology-pptx
./run.sh
```

**With custom guidance:**
```bash
node ../../../bin/charm.mjs transmogrify \
  --to pptx \
  --guidance "Focus on genomic data and immunotherapy options" \
  synthetic-cancer-case.md
```

**Custom output location:**
```bash
./run.sh --output ~/Desktop/presentation.pptx
```

### What It Demonstrates

- ✅ **Compiler guide execution** - Generates Python code using python-pptx
- ✅ **Structured data extraction** - Parses clinical data from markdown
- ✅ **Binary format generation** - Creates .pptx file
- ✅ **De-identification** - Removes PHI automatically
- ✅ **Professional formatting** - Slide layouts, tables, bullets

### Technical Details

**Guide used:** `oncology-pptx` (compiler)

**Process:**
1. AI generates Python script
2. Script parses markdown
3. Extracts clinical sections
4. Creates PowerPoint slides using python-pptx
5. Formats genomic data in tables
6. De-identifies patient info
7. Saves .pptx file

**Requirements:**
```bash
pip install python-pptx
```

**Typical runtime:** 20-40 seconds

---

## Example 2: PDF to Markdown

**Location:** `examples/transmogrify/pdf-to-markdown/`

### Overview

Convert PDF medical records (with text and images) into searchable markdown format using OCR and vision models.

**Input:** 2-page PDF medical record with:
- Scanned text pages
- Medical forms
- Clinical notes

**Output:** Markdown file with:
- OCR-extracted text
- Vision model descriptions of images/forms
- Metadata (filename, SHA256, page numbers)
- Page boundaries marked
- Extraction confidence scores

### Files

```
pdf-to-markdown/
├── run.sh                              # Executable script
├── README.md                           # Detailed documentation
└── right-knee-sports-medicine.pdf      # 2-page medical record (261KB)
```

### Usage

**Basic:**
```bash
cd examples/transmogrify/pdf-to-markdown
./run.sh
```

**With guidance:**
```bash
node ../../../bin/charm.mjs transmogrify \
  --to md \
  --guidance "Medical record with clinical assessment" \
  right-knee-sports-medicine.pdf
```

**Custom output:**
```bash
./run.sh --output medical-record.md
```

### What It Demonstrates

- ✅ **Native endpoint usage** - Uses Charmonizer image PDF endpoint
- ✅ **OCR processing** - Extracts text from scanned pages
- ✅ **Vision models** - Describes images and forms
- ✅ **Progress tracking** - Shows X/Y pages during conversion
- ✅ **Metadata preservation** - Includes SHA256, page numbers
- ✅ **Medical optimization** - Auto-adds clinical guidance

### Technical Details

**Route used:** PDF conversion (Charmonizer endpoint)

**Process:**
1. Submit PDF to `/api/charmonizer/v1/conversions/documents`
2. Poll for completion (shows progress)
3. Fetch result (doc.json format)
4. Convert doc.json to markdown
5. Add metadata as HTML comments
6. Mark page boundaries

**Medical document optimization:**

When guidance contains keywords (`medical`, `patient`, `clinical`):
- Adds clinical intent for diagnosis/treatment focus
- Adds graphic instructions for medical images

**Typical runtime:** 30-60 seconds for 2 pages

---

## Example 3: CSV to JSON with Schema

**Location:** `examples/transmogrify/csv-to-json/`

### Overview

Convert patient data from CSV to validated JSON with type conversion and summary statistics.

**Input:** CSV file with 8 patient records:
```csv
patient_id,name,age,diagnosis,treatment,response
PT001,Patient A,45,NSCLC,Pembrolizumab,PR
PT002,Patient B,52,NSCLC,Nivolumab,SD
...
```

**Output:** JSON file with:
- Typed data (age as integer, not string)
- Structured patient objects
- Summary statistics (response rates)
- Schema validation

### Files

```
csv-to-json/
├── run.sh              # Executable script
├── README.md           # Detailed documentation
├── sample-data.csv     # 8 patient records
└── schema.json         # JSON Schema for validation
```

### Usage

**Basic:**
```bash
cd examples/transmogrify/csv-to-json
./run.sh
```

**Custom guidance:**
```bash
node ../../../bin/charm.mjs transmogrify \
  --to json \
  --output-schema-file schema.json \
  --guidance "Include median age and treatment response rates" \
  sample-data.csv
```

### What It Demonstrates

- ✅ **Schema validation** - Validates output against JSON Schema
- ✅ **Type conversion** - String "45" → integer 45
- ✅ **Data processing** - Computes summary statistics
- ✅ **Compiler guide** - Generates Python for complex logic
- ✅ **Error handling** - Validates required fields

### Technical Details

**Guide used:** `generic-compiler` (fallback)

**Process:**
1. AI generates Python script
2. Script parses CSV
3. Converts data types
4. Computes summary statistics
5. Validates against schema
6. Writes JSON

**Schema validation:**
```json
{
  "type": "object",
  "required": ["patients", "summary"],
  "properties": {
    "patients": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["patient_id", "name", "age"],
        "properties": {
          "age": { "type": "integer" }
        }
      }
    }
  }
}
```

**Typical runtime:** 10-20 seconds

---

## Example 4: Markdown Variants

**Location:** `examples/transmogrify/markdown-variants/`

### Overview

Convert GitHub-Flavored Markdown (GFM) to Obsidian-flavored markdown with wiki links, frontmatter, and callouts.

**Input:** GFM research notes with:
- Standard markdown links: `[text](url)`
- Task lists: `- [ ] Task`
- Tables

**Output:** Obsidian markdown with:
- Wiki links: `[[Note Name]]`
- YAML frontmatter
- Obsidian callouts: `> [!info]`
- Preserved tables

### Files

```
markdown-variants/
├── run.sh                  # Executable script
├── README.md               # Detailed documentation
└── github-flavored.md      # Sample GFM research notes
```

### Usage

**Basic:**
```bash
cd examples/transmogrify/markdown-variants
./run.sh
```

**Explicit formats:**
```bash
node ../../../bin/charm.mjs transmogrify \
  --from "text/markdown; variant=GFM" \
  --to "text/markdown; variant=Obsidian" \
  --guidance "Convert links to wiki-links, add tags in frontmatter" \
  github-flavored.md
```

### What It Demonstrates

- ✅ **Format variants** - Converting between markdown flavors
- ✅ **Text transformation** - Link syntax conversion
- ✅ **Structure addition** - Adding YAML frontmatter
- ✅ **Interpreter guide** - Direct text transformation (when available)
- ✅ **Preserving content** - Keeping tables, code blocks

### Technical Details

**Guide used:** `generic-compiler` (if no variant-specific guide exists)

**Transformations:**
```
[Research](https://example.com)  →  [[Research]]
- [ ] Task                        →  - [ ] Task (preserved)
> Note                           →  > [!info] Note
(add frontmatter)                →  ---
                                     tags: [research, notes]
                                     ---
```

**Typical runtime:** 5-15 seconds

---

## Common Workflows

### Workflow 1: Medical Record Processing Pipeline

**Scenario:** Process PDF medical records into multiple formats

**Steps:**

```bash
# Step 1: PDF → Markdown
charm transmogrify --to md \
  --guidance "Medical record with clinical notes" \
  patient-chart.pdf
# Output: patient-chart.md

# Step 2: Markdown → Structured JSON
charm transmogrify --to json \
  --output-schema-file patient-schema.json \
  --guidance "Extract demographics, diagnoses, medications, vitals" \
  patient-chart.md
# Output: patient-chart.json

# Step 3: Markdown → Presentation
charm transmogrify --to pptx \
  --guidance "Tumor board presentation format" \
  patient-chart.md
# Output: patient-chart.pptx
```

**Use cases:**
- Creating tumor board presentations
- Extracting structured data for databases
- Generating searchable text from scans

---

### Workflow 2: Documentation Migration

**Scenario:** Migrate GitHub wiki to Obsidian vault

**Steps:**

```bash
# Batch convert all markdown files
for file in github-wiki/*.md; do
  charm transmogrify \
    --from "text/markdown; variant=GFM" \
    --to "text/markdown; variant=Obsidian" \
    --guidance "Convert to wiki-links, add tags" \
    --output "obsidian-vault/$(basename "$file")" \
    "$file"
done
```

**Transformations:**
- `[Page](./page.md)` → `[[Page]]`
- Add YAML frontmatter
- Convert GitHub alerts to Obsidian callouts
- Preserve code blocks and tables

---

### Workflow 3: Data Migration Pipeline

**Scenario:** Migrate legacy CSV data to validated JSON for new system

**Steps:**

```bash
# Create schema
cat > schema.json <<'EOF'
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["records", "metadata"],
  "properties": {
    "records": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "timestamp", "value"],
        "properties": {
          "id": { "type": "integer" },
          "timestamp": { "type": "string", "format": "date-time" },
          "value": { "type": "number" }
        }
      }
    },
    "metadata": {
      "type": "object",
      "properties": {
        "total_records": { "type": "integer" },
        "valid_records": { "type": "integer" }
      }
    }
  }
}
EOF

# Batch convert with validation
for file in legacy-data/*.csv; do
  charm transmogrify \
    --to json \
    --output-schema-file schema.json \
    --guidance "Parse dates as ISO-8601, compute statistics" \
    --yes \
    "$file"
done
```

**Benefits:**
- Type conversion (strings → integers/floats)
- Date normalization
- Validation against schema
- Summary statistics
- Error handling

---

### Workflow 4: Research Paper Processing

**Scenario:** Extract structured data from research PDFs

**Steps:**

```bash
# Step 1: PDF → Markdown
charm transmogrify --to md \
  --guidance "Scientific research paper" \
  paper.pdf

# Step 2: Markdown → Structured JSON
charm transmogrify --to json \
  --guidance "Extract: title, authors, abstract, methods, results, conclusions" \
  --output-schema-file paper-schema.json \
  paper.md

# Step 3: JSON → Database
# (use external tools to import JSON)
```

---

## Advanced Examples

### Example 5: Custom Format with Description File

**Scenario:** Convert proprietary format to JSON

**Setup:**

**custom-format.txt:**
```
application/octet-stream

Custom telemetry format with:
- Binary header (16 bytes)
- Timestamp (8 bytes, Unix epoch)
- Sensor readings (variable length)
- CRC-32 checksum (4 bytes)
```

**Usage:**
```bash
charm transmogrify \
  --from-file custom-format.txt \
  --to json \
  --guidance "Parse binary format: header, timestamp, readings, checksum" \
  telemetry.dat
```

**Result:**
AI generates Python code to:
- Read binary data
- Parse header structure
- Extract timestamp
- Parse sensor readings
- Validate checksum
- Output JSON

---

### Example 6: Multi-Step Transformation

**Scenario:** Complex transformation through intermediate format

**Steps:**

```bash
# DOCX → Markdown (using charm convert)
charm transmogrify --to md report.docx
# Output: report.md

# Markdown → Simplified Markdown (cleanup)
charm transmogrify \
  --to md \
  --guidance "Remove formatting, keep structure, simplify language" \
  report.md \
  --output report-simple.md

# Simplified Markdown → Presentation
charm transmogrify --to pptx report-simple.md
# Output: report-simple.pptx
```

**Benefits:**
- Leverage intermediate formats
- Clean up formatting
- Apply multiple transformations

---

### Example 7: Batch Processing with Error Handling

**Scenario:** Convert many files with error handling

```bash
#!/bin/bash

success=0
failed=0

for file in data/*.csv; do
  echo "Processing $file..."

  if charm transmogrify --to json --yes "$file" 2>/dev/null; then
    echo "✓ Success: $file"
    ((success++))
  else
    echo "✗ Failed: $file"
    ((failed++))
  fi
done

echo ""
echo "Results: $success succeeded, $failed failed"
```

---

### Example 8: Schema-Driven Extraction

**Scenario:** Extract specific fields using JSON Schema

**schema.json:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["patient_id", "diagnosis", "medications"],
  "properties": {
    "patient_id": { "type": "string", "pattern": "^PT[0-9]{3}$" },
    "diagnosis": {
      "type": "object",
      "properties": {
        "primary": { "type": "string" },
        "icd10": { "type": "string" }
      }
    },
    "medications": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "dosage": { "type": "string" },
          "frequency": { "type": "string" }
        }
      }
    }
  }
}
```

**Usage:**
```bash
charm transmogrify \
  --to json \
  --output-schema-file schema.json \
  --guidance "Extract only the fields specified in the schema" \
  medical-record.md
```

**Result:**
AI generates code that:
- Reads schema
- Extracts matching fields only
- Validates output
- Ensures required fields present

---

## Performance Benchmarks

Based on typical usage:

| Example | Input Size | Output Size | Runtime | Route |
|---------|-----------|-------------|---------|-------|
| Oncology PPTX | 18 KB (292 lines) | 49 KB (14 slides) | 30-40s | Compiler guide |
| PDF to Markdown | 261 KB (2 pages) | 2.9 KB | 30-60s | PDF endpoint |
| CSV to JSON | 1 KB (8 records) | 2 KB | 10-20s | Compiler guide |
| Markdown Variants | 2 KB | 3 KB | 5-15s | Compiler guide |

**Factors affecting runtime:**
- File size
- Complexity of transformation
- API latency
- Model speed
- PDF page count (for PDF conversions)

---

## Tips for Best Results

### Provide Clear Guidance

**Good:**
```bash
--guidance "Extract patient demographics, clinical history, and current medications. Format as structured JSON. De-identify all PHI."
```

**Bad:**
```bash
--guidance "Convert file"
```

---

### Use Appropriate Formats

**Good:**
```bash
# Specify variant for specialized conversion
charm transmogrify \
  --from "text/markdown; variant=GFM" \
  --to "text/markdown; variant=Obsidian" \
  notes.md
```

**Bad:**
```bash
# Generic, may not select specialized guide
charm transmogrify --to md notes.md
```

---

### Leverage Schemas

**Good:**
```bash
# Schema ensures output structure
charm transmogrify \
  --to json \
  --output-schema-file schema.json \
  data.csv
```

**Bad:**
```bash
# No validation, structure may vary
charm transmogrify --to json data.csv
```

---

### Test with Dry-Run

**Good:**
```bash
# Preview routing first
charm transmogrify --dry-run --to pptx case.md
# Then run
charm transmogrify --to pptx case.md
```

---

### Use --keep-sandbox for Debugging

**Good:**
```bash
# Keep generated code for inspection
charm transmogrify --keep-sandbox --to json data.csv
# Inspect: /tmp/charm-transmog-XXXXX/compile.py
```

---

## Troubleshooting Examples

### Example Not Working

**Check prerequisites:**
```bash
# Verify charm installed
charm help

# Verify server running
charm list

# Verify Python packages (for compiler guides)
python3 -c "import pptx; print('python-pptx OK')"
```

### Generated Code Fails

**Inspect sandbox:**
```bash
# Run with --keep-sandbox
charm transmogrify --keep-sandbox --to json data.csv

# Find sandbox location (shown in output)
cd /tmp/charm-transmog-XXXXX

# Test generated code
python3 compile.py output.json < input.txt
```

### Poor Quality Output

**Improve with guidance:**
```bash
# Add specific instructions
charm transmogrify \
  --to json \
  --guidance "Extract these specific fields: X, Y, Z. Format dates as ISO-8601. Use null for missing values." \
  data.csv
```

---

## Next Steps

- **Create custom guide:** [Guide Development](./08-guide-development.md)
- **Understand routing:** [Routing System](./04-routing-system.md)
- **Learn formats:** [Format Specifications](./06-format-specifications.md)
- **Read command reference:** [Command Reference](./03-command-reference.md)
