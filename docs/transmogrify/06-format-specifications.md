# Format Specifications

Transmogrify supports flexible format specification to accurately describe input and output formats beyond simple file extensions.

## Overview

Formats can be specified in four ways:

1. **File extension** - Simple and automatic: `.md`, `.pdf`, `.json`
2. **MIME type** - More precise: `text/markdown`, `application/pdf`
3. **MIME with variant** - Format-specific: `text/markdown; variant=GFM`
4. **Multi-line description** - Maximum detail via files

## Format Descriptor Structure

Internally, all formats are normalized to this structure:

```javascript
{
  ext: 'md',                    // File extension
  mime: 'text/markdown',        // MIME type
  variant: 'GFM',               // Optional variant
  description: '...',           // Additional description
  raw: 'text/markdown; variant=GFM'  // Original specification
}
```

## Specification Methods

### 1. Automatic Detection (File Extension)

**How it works:**
- Transmogrify reads the input file extension
- Looks up corresponding MIME type
- Creates format descriptor automatically

**Examples:**

```bash
# Input: report.pdf
# Auto-detected format:
{
  ext: 'pdf',
  mime: 'application/pdf',
  variant: null,
  description: '',
  raw: 'pdf'
}
```

```bash
# Input: data.json
# Auto-detected format:
{
  ext: 'json',
  mime: 'application/json',
  variant: null,
  description: '',
  raw: 'json'
}
```

**Advantages:**
- ✅ Zero configuration
- ✅ Works for common formats
- ✅ Fast and simple

**Limitations:**
- ❌ Cannot specify variants
- ❌ Relies on correct file extension
- ❌ No additional context

---

### 2. Explicit Extension

**Syntax:**
```bash
--from <ext>
--to <ext>
```

**Examples:**

```bash
# Override file extension
charm transmogrify --from pdf --to md document.dat

# When file has no extension
charm transmogrify --from csv --to json data
```

**Use cases:**
- File has wrong extension
- File has no extension
- Explicit format specification desired

---

### 3. MIME Type

**Syntax:**
```bash
--from <mime-type>
--to <mime-type>
```

**Examples:**

```bash
# Using MIME types
charm transmogrify \
  --from application/pdf \
  --to text/markdown \
  document.pdf

# More precise than extensions
charm transmogrify \
  --from text/csv \
  --to application/json \
  data.csv
```

**Common MIME types:**

| Extension | MIME Type |
|-----------|-----------|
| `.md` | `text/markdown` |
| `.pdf` | `application/pdf` |
| `.json` | `application/json` |
| `.csv` | `text/csv` |
| `.xml` | `application/xml` |
| `.html` | `text/html` |
| `.txt` | `text/plain` |
| `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `.pptx` | `application/vnd.openxmlformats-officedocument.presentationml.presentation` |
| `.xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |

**Advantages:**
- ✅ More precise than extensions
- ✅ Standard format identification
- ✅ Better for guide scoring

**Limitations:**
- ❌ Longer to type
- ❌ Still cannot specify variants

---

### 4. MIME Type with Variant

**Syntax:**
```bash
--from "mime-type; variant=VariantName"
--to "mime-type; variant=VariantName"
```

**Note:** Use quotes to preserve semicolon and spaces.

**Examples:**

```bash
# Markdown variants
charm transmogrify \
  --from "text/markdown; variant=GFM" \
  --to "text/markdown; variant=Obsidian" \
  notes.md

# JSON-LD
charm transmogrify \
  --from "application/json" \
  --to "application/ld+json; variant=schema.org" \
  data.json
```

**Common variants:**

#### Markdown Variants

| Variant | Description |
|---------|-------------|
| `GFM` | GitHub-Flavored Markdown |
| `CommonMark` | CommonMark specification |
| `Obsidian` | Obsidian-flavored (wiki links, etc.) |
| `MultiMarkdown` | MultiMarkdown extensions |
| `Pandoc` | Pandoc markdown |

#### JSON Variants

| Variant | Description |
|---------|-------------|
| `schema.org` | Schema.org structured data |
| `FHIR` | FHIR healthcare format |
| `GeoJSON` | Geospatial JSON |

**Advantages:**
- ✅ Maximum precision
- ✅ Highest guide scoring (+5 points)
- ✅ Enables variant-specific guides

**Use cases:**
- Converting between markdown flavors
- Specialized JSON formats
- Domain-specific variants

---

### 5. Multi-Line Description (File-Based)

**Syntax:**
```bash
--from-file <path>
--to-file <path>
```

**File format:**
```
<mime-type or extension>; [optional-variant]

Additional human-readable description
that can span multiple lines and provide
context for guide selection.
```

**Examples:**

**input-format.txt:**
```
text/markdown; variant=Obsidian

Obsidian-flavored markdown with:
- Wiki-style links: [[note-name]]
- YAML frontmatter with tags
- Dataview query blocks
- Callout syntax: > [!type]
```

**Usage:**
```bash
charm transmogrify \
  --from-file input-format.txt \
  --to "text/markdown; variant=CommonMark" \
  vault-note.md
```

**Parsed format:**
```javascript
{
  ext: 'md',
  mime: 'text/markdown',
  variant: 'Obsidian',
  description: 'Obsidian-flavored markdown with:\n- Wiki-style links...',
  raw: 'text/markdown; variant=Obsidian\n\nObsidian-flavored...'
}
```

**Advantages:**
- ✅ Maximum context
- ✅ Substring matching for guide scoring
- ✅ Reusable format definitions
- ✅ Self-documenting

**Use cases:**
- Complex format specifications
- Custom or unusual formats
- Providing guidance to AI model
- Organizational format standards

---

## Format Parsing Rules

### Parsing Priority

When multiple sources provide format information:

1. **`--from` or `--from-file`** (explicit wins)
2. **File extension** (fallback)

For output formats:
1. **`--to` or `--to-file`** (required)

### Parsing Algorithm

**Step 1: Identify format string**
```javascript
let formatString;
if (opts.from) {
  formatString = opts.from;
} else if (opts.fromFile) {
  formatString = fs.readFileSync(opts.fromFile, 'utf-8');
} else {
  formatString = path.extname(inputPath).slice(1); // 'pdf'
}
```

**Step 2: Parse format string**
```javascript
// Split on semicolon for MIME + variant
const parts = formatString.split(';');
const primary = parts[0].trim();

// Check if extension or MIME
let ext, mimeType;
if (primary.includes('/')) {
  // MIME type
  mimeType = primary;
  ext = mime.extension(mimeType);
} else {
  // Extension
  ext = primary;
  mimeType = mime.lookup(ext);
}

// Parse variant
let variant = null;
if (parts[1]) {
  const variantMatch = parts[1].match(/variant=(\S+)/);
  if (variantMatch) variant = variantMatch[1];
}

// Multi-line description (from file only)
const lines = formatString.split('\n');
const description = lines.slice(1).join('\n').trim();
```

**Step 3: Create format descriptor**
```javascript
return {
  ext,
  mime: mimeType,
  variant,
  description,
  raw: formatString
};
```

---

## Guide Format Matching

Guides specify accepted formats in `inputs.json` and `outputs.json`. Transmogrify scores each guide based on how well the formats match.

### Matching Algorithm

For each format specification in guide's `inputs.json` or `outputs.json`:

```javascript
function scoreFormatMatch(targetFmt, guideFmt) {
  let score = 0;

  // Parse guide format
  const gFmt = parseFormat(guideFmt);

  // Exact variant match: +5
  if (targetFmt.variant && gFmt.variant &&
      targetFmt.variant === gFmt.variant) {
    score += 5;
  }

  // Exact MIME match: +4
  if (targetFmt.mime && gFmt.mime &&
      targetFmt.mime === gFmt.mime) {
    score += 4;
  }

  // Extension match: +3
  if (targetFmt.ext && gFmt.ext &&
      targetFmt.ext === gFmt.ext) {
    score += 3;
  }

  // Description substring: +1
  if (targetFmt.description && gFmt.description &&
      targetFmt.description.toLowerCase().includes(
        gFmt.description.toLowerCase())) {
    score += 1;
  }

  // Wildcard: 0 (always matches)
  if (guideFmt === '*/*') {
    score = 0; // Matches, but lowest priority
  }

  return score;
}
```

### Scoring Examples

#### Example 1: Extension Only

**Target:** `pdf` (from file extension)
```javascript
{ ext: 'pdf', mime: 'application/pdf', variant: null, description: '' }
```

**Guide formats and scores:**

| Guide Format | Score | Reason |
|--------------|-------|--------|
| `"pdf"` | 3 | Extension match |
| `"application/pdf"` | 4 | MIME match |
| `"application/pdf; variant=PDF/A"` | 4 | MIME match (variant doesn't match) |
| `"*/*"` | 0 | Wildcard |

**Winner:** `"application/pdf"` (score 4)

---

#### Example 2: MIME with Variant

**Target:** `text/markdown; variant=GFM`
```javascript
{ ext: 'md', mime: 'text/markdown', variant: 'GFM', description: '' }
```

**Guide formats and scores:**

| Guide Format | Score | Reason |
|--------------|-------|--------|
| `"text/markdown; variant=GFM"` | 5 | Exact variant match |
| `"text/markdown"` | 4 | MIME match |
| `"md"` | 3 | Extension match |
| `"*/*"` | 0 | Wildcard |

**Winner:** `"text/markdown; variant=GFM"` (score 5)

---

#### Example 3: Multi-Line Description

**Target:** (from file)
```
text/markdown; variant=Obsidian

Obsidian markdown with wiki links and callouts
```

**Parsed:**
```javascript
{
  ext: 'md',
  mime: 'text/markdown',
  variant: 'Obsidian',
  description: 'Obsidian markdown with wiki links and callouts'
}
```

**Guide formats and scores:**

| Guide Format | Guide Description | Score | Reason |
|--------------|-------------------|-------|--------|
| `"text/markdown; variant=Obsidian"` | (any) | 5 | Exact variant |
| `"text/markdown"` | "Obsidian-flavored" | 4 + 1 = 5 | MIME + substring |
| `"md"` | "wiki links" | 3 + 1 = 4 | Extension + substring |
| `"*/*"` | (any) | 0 | Wildcard |

**Winner:** Tie between first two (both score 5). Tie-breaker applies (prefer interpreter, then lexicographic).

---

## Format Specification Best Practices

### For Users

**Use extensions for simple conversions:**
```bash
✅ charm transmogrify --to md report.pdf
❌ charm transmogrify --to text/markdown --from application/pdf report.pdf
```

**Use MIME types for precision:**
```bash
✅ charm transmogrify --to application/json data.csv
🤷 charm transmogrify --to json data.csv  (also fine)
```

**Use variants for format flavors:**
```bash
✅ charm transmogrify \
     --from "text/markdown; variant=GFM" \
     --to "text/markdown; variant=Obsidian" \
     notes.md
```

**Use files for complex specifications:**
```bash
✅ charm transmogrify \
     --from-file custom-format.txt \
     --to json \
     data.xyz
```

---

### For Guide Developers

**Include multiple format specifications:**
```json
✅ ["md", "markdown", "text/markdown"]
❌ ["md"]
```

**Be specific when possible:**
```json
✅ ["text/markdown; variant=GFM"]  (for GFM-specific guide)
❌ ["text/markdown"]  (too generic)
```

**Use wildcards sparingly:**
```json
✅ ["*/*"]  (for generic-compiler only)
❌ ["*/*"]  (for specialized guides)
```

**Document variants in description.md:**
```markdown
✅ Supports GitHub-Flavored Markdown (GFM) with:
   - Task lists
   - Tables
   - Strikethrough

❌ Converts markdown
```

---

## Common Format Specifications

### Documents

```bash
# Microsoft Office
--to docx
--to application/vnd.openxmlformats-officedocument.wordprocessingml.document

# PDF
--to pdf
--to application/pdf

# Markdown
--to md
--to text/markdown
--to "text/markdown; variant=GFM"
```

### Presentations

```bash
# PowerPoint
--to pptx
--to application/vnd.openxmlformats-officedocument.presentationml.presentation

# PDF
--to pdf
--to application/pdf
```

### Data Formats

```bash
# JSON
--to json
--to application/json
--to "application/json; variant=JSON-LD"

# CSV
--to csv
--to text/csv

# XML
--to xml
--to application/xml

# YAML
--to yaml
--to application/x-yaml
```

### Web Formats

```bash
# HTML
--to html
--to text/html
--to "text/html; variant=HTML5"

# XML
--to xml
--to application/xml
```

---

## Format File Examples

### Example 1: Obsidian Vault Format

**obsidian-format.txt:**
```
text/markdown; variant=Obsidian

Obsidian vault markdown files with:
- Wiki-style links using [[note-name]] syntax
- YAML frontmatter with tags, aliases, and custom fields
- Dataview query blocks for dynamic content
- Callout syntax: > [!info], > [!warning], etc.
- Embedded files with ![[filename]]
- Block references with ^blockid
```

**Usage:**
```bash
charm transmogrify \
  --from-file obsidian-format.txt \
  --to "text/markdown; variant=CommonMark" \
  vault-note.md
```

---

### Example 2: FHIR JSON Format

**fhir-format.txt:**
```
application/json; variant=FHIR

FHIR (Fast Healthcare Interoperability Resources) R4 JSON format.
Contains healthcare data structures including:
- Patient resources
- Observation resources
- Practitioner resources
Conforms to HL7 FHIR R4 specification.
```

**Usage:**
```bash
charm transmogrify \
  --from-file fhir-format.txt \
  --to application/json \
  patient-record.json
```

---

### Example 3: Custom CSV Format

**custom-csv-format.txt:**
```
text/csv

Custom CSV format with:
- Pipe-delimited fields (not comma)
- No header row
- Date format: YYYY-MM-DD
- Numeric fields: no thousand separators
- Encoding: UTF-8
```

**Usage:**
```bash
charm transmogrify \
  --from-file custom-csv-format.txt \
  --to json \
  data.csv
```

---

## Troubleshooting Format Specifications

### Issue: Guide Not Matching

**Symptoms:**
```
[INFO] Using guide: generic-compiler (compiler)
```
(Expected specialized guide)

**Debug:**
```bash
charm transmogrify --dry-run --to pptx case.md
```

**Common causes:**

1. **Format mismatch:**
```bash
# Guide expects: "text/markdown; variant=GFM"
# You provided: "md"
# Solution: Specify variant
charm transmogrify \
  --from "text/markdown; variant=GFM" \
  --to pptx case.md
```

2. **Extension vs MIME:**
```bash
# Guide has: ["application/json"]
# File extension: .json (resolves to application/json) ✅
# Explicit: --to json (resolves to application/json) ✅
```

---

### Issue: Format Not Recognized

**Symptoms:**
```
[ERROR] Unknown format: xyz
```

**Solutions:**

1. **Explicitly specify MIME type:**
```bash
charm transmogrify --from text/plain --to json data.xyz
```

2. **Use format file:**
```bash
echo "text/plain" > format.txt
charm transmogrify --from-file format.txt --to json data.xyz
```

3. **Rename file:**
```bash
mv data.xyz data.txt
charm transmogrify --to json data.txt
```

---

### Issue: Variant Ignored

**Symptoms:**
Wrong guide selected despite specifying variant.

**Debug:**
Check if guide actually supports the variant:

```bash
# Check guide's inputs.json
cat guides/my-guide/inputs.json
```

**Solutions:**

1. **Ensure guide specifies variant:**
```json
["text/markdown; variant=GFM"]
```

2. **Use description matching:**
```markdown
# description.md
Supports GitHub-Flavored Markdown
```

3. **Create variant-specific guide:**
See [Guide Development](./08-guide-development.md)

---

## Advanced Format Techniques

### Conditional Format Selection

Use format descriptions to trigger specific guides:

**Scenario:** Want different handling for medical vs general PDFs

**Solution 1: Use guidance**
```bash
charm transmogrify --to md --guidance "medical record" medical.pdf
```

**Solution 2: Use format description**
```bash
echo -e "application/pdf\n\nMedical record with clinical notes" > format.txt
charm transmogrify --from-file format.txt --to md medical.pdf
```

**Guide's description.md:**
```markdown
Optimized for medical records and clinical documentation
```

Result: +1 point for "medical" substring match

---

### Format Aliases

Create reusable format files:

```bash
# Setup
mkdir ~/.charm-formats
echo '"text/markdown; variant=GFM"' > ~/.charm-formats/gfm.txt
echo '"text/markdown; variant=Obsidian"' > ~/.charm-formats/obsidian.txt

# Usage
charm transmogrify \
  --from-file ~/.charm-formats/gfm.txt \
  --to-file ~/.charm-formats/obsidian.txt \
  notes.md
```

---

## Next Steps

- **See routing:** [Routing System](./04-routing-system.md)
- **Understand guides:** [Guide System](./05-guide-system.md)
- **View examples:** [Examples](./07-examples.md)
- **Create guides:** [Guide Development](./08-guide-development.md)
