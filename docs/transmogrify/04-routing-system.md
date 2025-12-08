# Routing System

The routing system is the intelligence behind transmogrify's format conversion. It automatically selects the best conversion pathway based on input/output formats and available resources.

## Overview

When you run `charm transmogrify input.ext --to output-ext`, the routing system:

1. **Parses** input and output format specifications
2. **Checks** three conversion routes in priority order
3. **Selects** the best available route
4. **Executes** the conversion
5. **Validates** and writes the output

## The Three Routes

Transmogrify checks conversion routes in this **priority order**:

### Route 1: Built-in Conversions (charm convert)

**Priority:** Highest (checked first)

**Conversions supported:**
- `.docx` → `.md`
- `.pptx` → `.md`
- `.doc.json` → `.md`

**When used:**
- Input and output formats exactly match one of the above
- `charm convert` command is available

**Advantages:**
- ✅ Fastest (no AI model calls)
- ✅ Most reliable (deterministic)
- ✅ No API calls needed
- ✅ Works offline

**Implementation:**
```javascript
// Check if formats match built-in conversions
if (isCoveredByConvert(fromFmt, toFmt, inputPath)) {
  // Delegate to charm convert
  return await routeToConvert(globalFlags, inputPath, opts, toFmt);
}
```

**Example:**
```bash
$ charm transmogrify --dry-run --to md report.docx
[DRY RUN MODE]
Input format: docx (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
Output format: md (text/markdown)
Route: charm convert (built-in)
```

---

### Route 2: Native Endpoints

**Priority:** Second (checked after charm convert)

**Conversions supported:**
- `.pdf` → `.md` (uses Charmonizer image PDF endpoint)

**When used:**
- Input format is PDF (by extension)
- Output format is Markdown (by extension)
- Charmonator server is available

**Advantages:**
- ✅ Optimized for PDF processing
- ✅ OCR + vision models
- ✅ Progress tracking
- ✅ Metadata preservation
- ✅ Proven endpoint (same as `charm transcribe`)

**Implementation:**
```javascript
// Check if PDF to Markdown conversion
if (shouldUsePdfConversion(fromFmt, toFmt, inputPath)) {
  // Use Charmonizer image PDF endpoint
  return await convertPdfToMarkdown(globalFlags, inputPath, opts, toFmt);
}
```

**Process:**
1. Submit PDF to `/api/charmonizer/v1/conversions/documents`
2. Poll for completion with progress updates
3. Fetch result (doc.json format)
4. Convert doc.json to markdown
5. Write output file

**Example:**
```bash
$ charm transmogrify --dry-run --to md medical-record.pdf
[DRY RUN MODE]
Input format: pdf (application/pdf)
Output format: md (text/markdown)
Route: PDF conversion (Charmonizer image PDF endpoint)
```

**Medical document optimization:**

When `--guidance` contains medical keywords (`medical`, `patient`, `clinical`), transmogrify automatically enhances the conversion:

```javascript
if (/medical|patient|clinical/i.test(guidance)) {
  // Add clinical intent
  formData.append('intent',
    'To come up with a diagnosis, a prognosis or a treatment option based on the content of the records.');

  // Add graphic instructions
  formData.append('graphic_instructions',
    'Clearly describe the contents of graphics, images and figures as it could relate to the diagnosis, prognosis or potential treatment of this patient.');
}
```

---

### Route 3: Guide-Based Conversions

**Priority:** Third (fallback for all other conversions)

**Conversions supported:**
- Any format → Any format (limited only by available guides)

**When used:**
- Conversion not covered by Routes 1 or 2
- Matching guide exists (or generic-compiler fallback)

**Process:**
1. **Load guides** from guides directory
2. **Score guides** based on format compatibility
3. **Select best guide** (highest score)
4. **Execute conversion** (interpreter or compiler mode)

**Two execution modes:**

#### Interpreter Mode
- AI model directly produces output
- Faster (single API call)
- Good for text transformations
- No code execution

#### Compiler Mode
- AI generates Python code
- Code reads stdin, writes output file
- More powerful (can use libraries, complex logic)
- Requires confirmation (safety)

**Example:**
```bash
$ charm transmogrify --dry-run --to pptx case.md
[DRY RUN MODE]
Input format: md (text/markdown)
Output format: pptx (application/vnd.openxmlformats-officedocument.presentationml.presentation)
Route: oncology-pptx (compiler)
```

---

## Format Parsing

Before routing, transmogrify parses format specifications into a normalized structure.

### Format Descriptor Structure

```javascript
{
  ext: 'md',                    // File extension
  mime: 'text/markdown',        // MIME type
  variant: 'GFM',               // Optional variant
  description: '...',           // Additional description
  raw: 'text/markdown; variant=GFM'  // Original specification
}
```

### Parsing Rules

#### 1. From File Extension

```bash
# Input: report.pdf
{
  ext: 'pdf',
  mime: 'application/pdf',
  variant: null,
  description: '',
  raw: 'pdf'
}
```

#### 2. From Explicit Format

```bash
# --from "text/markdown; variant=GFM"
{
  ext: 'md',
  mime: 'text/markdown',
  variant: 'GFM',
  description: '',
  raw: 'text/markdown; variant=GFM'
}
```

#### 3. From Format File

```bash
# --from-file format.txt
# Contents:
#   text/markdown; variant=Obsidian
#
#   Obsidian-flavored markdown with wiki-style links
{
  ext: 'md',
  mime: 'text/markdown',
  variant: 'Obsidian',
  description: 'Obsidian-flavored markdown with wiki-style links',
  raw: 'text/markdown; variant=Obsidian\n\nObsidian-flavored...'
}
```

### MIME Type Resolution

Uses `mime-types` library to resolve extensions ↔ MIME types:

```javascript
import mime from 'mime-types';

// Extension → MIME
mime.lookup('md')  // 'text/markdown'
mime.lookup('pdf') // 'application/pdf'
mime.lookup('pptx') // 'application/vnd.openxmlformats-officedocument.presentationml.presentation'

// MIME → Extension
mime.extension('text/markdown') // 'md'
mime.extension('application/pdf') // 'pdf'
```

---

## Guide Scoring System

When multiple guides could handle a conversion, transmogrify scores each guide and selects the highest-scoring one.

### Scoring Algorithm

For each guide, compute scores for input format and output format separately, then sum them.

**Score components:**

| Match Type | Points | Example |
|------------|--------|---------|
| Exact variant match | +5 | `variant=GFM` matches `variant=GFM` |
| Exact MIME match | +4 | `text/markdown` matches `text/markdown` |
| Extension match | +3 | `md` matches `md` |
| Description substring | +1 | `"Obsidian"` found in description |
| Wildcard | 0 | `*/*` matches anything |

**Total score** = input score + output score

### Scoring Examples

#### Example 1: Exact Matches

**Conversion:** `.md` → `.json`

**Guide A:**
- inputs.json: `["md", "text/markdown"]`
- outputs.json: `["json", "application/json"]`
- **Score:** 3 (md) + 3 (json) = **6**

**Guide B:**
- inputs.json: `["*/*"]`
- outputs.json: `["*/*"]`
- **Score:** 0 + 0 = **0**

**Winner:** Guide A (6 > 0)

---

#### Example 2: Variant Matching

**Conversion:** `text/markdown; variant=GFM` → `text/markdown; variant=Obsidian`

**Guide A:**
- inputs.json: `["text/markdown; variant=GFM"]`
- outputs.json: `["text/markdown; variant=Obsidian"]`
- **Score:** 5 (exact variant) + 5 (exact variant) = **10**

**Guide B:**
- inputs.json: `["text/markdown"]`
- outputs.json: `["text/markdown"]`
- **Score:** 4 (MIME) + 4 (MIME) = **8**

**Winner:** Guide A (10 > 8)

---

#### Example 3: Description Matching

**Conversion:** `.md` → `.pptx`

With guidance: `"Oncology case presentation"`

**Guide A: oncology-pptx**
- inputs.json: `["md"]`
- outputs.json: `["pptx"]`
- description.md: `"Converts markdown oncology cases to PowerPoint..."`
- **Score:** 3 (md) + 3 (pptx) = **6**

**Guide B: generic-compiler**
- inputs.json: `["*/*"]`
- outputs.json: `["*/*"]`
- description.md: `"Generic compiler for any format"`
- **Score:** 0 + 0 = **0**

**Winner:** Guide A (6 > 0)

---

### Tie-Breaking Rules

When multiple guides have the same score:

1. **Prefer interpreter over compiler** (faster, safer)
2. **Lexicographic order** by guide name

**Example:**

**Guide A: json-interpreter** (score 6, type: interpreter)
**Guide B: json-compiler** (score 6, type: compiler)

**Winner:** Guide A (interpreter preferred)

---

## Routing Decision Tree

```
┌─────────────────────────────────────┐
│ Parse input/output formats          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Route 1: charm convert?             │
│ (docx→md, pptx→md, doc.json→md)     │
└──────────────┬──────────────────────┘
               │
            YES│                  NO
               ▼                   │
         ┌─────────┐               │
         │ SUCCESS │               │
         └─────────┘               │
                                   ▼
                    ┌─────────────────────────────────────┐
                    │ Route 2: PDF conversion?            │
                    │ (pdf→md via Charmonizer)            │
                    └──────────────┬──────────────────────┘
                                   │
                                YES│                  NO
                                   ▼                   │
                             ┌─────────┐               │
                             │ SUCCESS │               │
                             └─────────┘               │
                                                       ▼
                                        ┌─────────────────────────────────────┐
                                        │ Route 3: Guide-based                │
                                        │                                     │
                                        │ 1. Load all guides                  │
                                        │ 2. Score guides                     │
                                        │ 3. Select best (or generic-compiler)│
                                        │ 4. Execute (interpreter or compiler)│
                                        └──────────────┬──────────────────────┘
                                                       │
                                                       ▼
                                                 ┌─────────┐
                                                 │ SUCCESS │
                                                 └─────────┘
```

---

## Routing Examples

### Example 1: Built-in Conversion

```bash
$ charm transmogrify --to md report.docx

[INFO] Resolving formats...
[INFO] Input: docx (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
[INFO] Output: md (text/markdown)
[INFO] Routing to charm convert (built-in)...
[INFO] Executing: charm convert report.docx --to md
[SUCCESS] Output written to report.md
```

**Routing logic:**
1. Parse formats: `docx` → `md`
2. Check Route 1: ✅ Covered by `charm convert`
3. Execute: Delegate to `charm convert`

---

### Example 2: PDF Conversion

```bash
$ charm transmogrify --to md --guidance "Medical record" scan.pdf

[INFO] Resolving formats...
[INFO] Input: pdf (application/pdf)
[INFO] Output: md (text/markdown)
[INFO] Routing to PDF conversion (Charmonizer image PDF endpoint)...
[INFO] Medical document optimization enabled
[INFO] Job submitted: abc-123-def
[INFO] Polling for completion...
[INFO] Progress: 1/5 pages (processing)
[INFO] Progress: 2/5 pages (processing)
...
[INFO] Conversion complete!
[SUCCESS] Output written to scan.md
```

**Routing logic:**
1. Parse formats: `pdf` → `md`
2. Check Route 1: ❌ Not covered by `charm convert`
3. Check Route 2: ✅ PDF to MD endpoint available
4. Detect medical keywords in guidance
5. Add clinical intent and graphic instructions
6. Execute: Submit to Charmonizer endpoint

---

### Example 3: Guide-Based (Specialized)

```bash
$ charm transmogrify --to pptx case.md

[INFO] Resolving formats...
[INFO] Input: md (text/markdown)
[INFO] Output: pptx (application/vnd.openxmlformats-officedocument.presentationml.presentation)
[INFO] Loading guides from ./guides
[INFO] Loaded guides: oncology-pptx, generic-compiler
[INFO] Scoring guides:
[INFO]   oncology-pptx: 6 (compiler)
[INFO]   generic-compiler: 0 (compiler)
[INFO] Using guide: oncology-pptx (compiler)
[INFO] Generating compiler script...

[WARN] About to execute model-generated Python code.
Review the code at: /tmp/charm-transmog-abc123/compile.py

Execute? [y/N] y

[INFO] Executing compiler...
[SUCCESS] Output written to case.pptx
```

**Routing logic:**
1. Parse formats: `md` → `pptx`
2. Check Route 1: ❌ Not covered by `charm convert`
3. Check Route 2: ❌ Not PDF conversion
4. Check Route 3: Load guides
   - Score `oncology-pptx`: 3 (md) + 3 (pptx) = 6
   - Score `generic-compiler`: 0 + 0 = 0
5. Select: `oncology-pptx` (highest score)
6. Execute: Compiler mode (generate + run Python)

---

### Example 4: Guide-Based (Fallback)

```bash
$ charm transmogrify --to json data.xyz

[INFO] Resolving formats...
[INFO] Input: xyz (application/octet-stream)
[INFO] Output: json (application/json)
[INFO] Loading guides from ./guides
[INFO] Loaded guides: oncology-pptx, generic-compiler
[INFO] Scoring guides:
[INFO]   oncology-pptx: 0 (compiler)
[INFO]   generic-compiler: 3 (compiler)  [matches json output]
[INFO] Using guide: generic-compiler (compiler)
[INFO] Generating compiler script...

Execute? [y/N]
```

**Routing logic:**
1. Parse formats: `xyz` → `json`
2. Check Route 1: ❌ Not covered
3. Check Route 2: ❌ Not PDF
4. Check Route 3: Load guides
   - Score `oncology-pptx`: 0 (no match)
   - Score `generic-compiler`: 0 (xyz wildcard) + 3 (json) = 3
5. Select: `generic-compiler` (highest score, fallback)
6. Execute: Compiler mode

---

## Forcing Routes

### Force Specific Guide

Use `--guide` to override automatic selection:

```bash
# Force generic-compiler even when specialized guide exists
charm transmogrify --guide generic-compiler --to json data.csv
```

**Routing logic:**
- Skips guide scoring
- Directly uses specified guide
- Still checks Routes 1 and 2 first (unless guide explicitly forces otherwise)

---

### Bypass All Routes

Not currently supported, but could be added:

```bash
# Hypothetical: Force interpreter mode
charm transmogrify --force-interpreter --to md input.txt

# Hypothetical: Force compiler mode
charm transmogrify --force-compiler --to json data.csv
```

---

## Route Priority Rationale

### Why Route 1 First? (charm convert)

**Advantages:**
- Fastest (no network calls)
- Most reliable (deterministic parsing)
- Works offline
- Battle-tested code

**Use case:** Common document conversions that don't require AI

---

### Why Route 2 Second? (PDF endpoint)

**Advantages:**
- Optimized for PDF processing (OCR + vision)
- Progress tracking
- Proven endpoint (used by `charm transcribe`)
- Metadata preservation

**Why not Route 3?**
- Guide-based PDF conversion would be slower (multi-step)
- Native endpoint is purpose-built
- Better user experience (progress updates)

---

### Why Route 3 Last? (Guides)

**Advantages:**
- Handles everything else
- Extensible (custom guides)
- Flexible (interpreter + compiler modes)

**Why last?**
- Slower (AI model calls)
- Less deterministic
- Requires API access
- May need confirmation (compiler mode)

---

## Debugging Routing

### Use Dry-Run Mode

See routing decision without executing:

```bash
charm transmogrify --dry-run --to md input.pdf
```

**Output:**
```
[DRY RUN MODE]
Input format: pdf (application/pdf)
Output format: md (text/markdown)
Route: PDF conversion (Charmonizer image PDF endpoint)
```

---

### Inspect Guide Scoring

Add `--verbose` flag (if implemented) to see guide scores:

```bash
charm transmogrify --dry-run --verbose --to pptx case.md
```

**Output:**
```
[DRY RUN MODE]
Input format: md (text/markdown)
Output format: pptx (application/vnd.openxmlformats-officedocument.presentationml.presentation)

Guide scoring:
  oncology-pptx:
    Input score: 3 (extension match: md)
    Output score: 3 (extension match: pptx)
    Total: 6 (compiler)

  generic-compiler:
    Input score: 0 (wildcard: */*)
    Output score: 0 (wildcard: */*)
    Total: 0 (compiler)

Selected: oncology-pptx (6 > 0)
Route: oncology-pptx (compiler)
```

---

### Force Different Routes

Test different routes manually:

```bash
# Test charm convert route
charm convert --to md report.docx

# Test PDF endpoint directly
charm transcribe report.pdf

# Test guide explicitly
charm transmogrify --guide oncology-pptx --to pptx case.md
```

---

## Extending Routing

### Add New Native Endpoint

To add support for a new native endpoint (e.g., `image → md`):

**1. Add detection function:**
```javascript
function shouldUseImageConversion(fromFmt, toFmt, inputPath) {
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp'];
  return imageExts.includes(fromFmt.ext) && toFmt.ext === 'md';
}
```

**2. Add route check:**
```javascript
// Route 2.5: Check if Image to Markdown
if (shouldUseImageConversion(fromFmt, toFmt, inputPath)) {
  return await convertImageToMarkdown(globalFlags, inputPath, opts, toFmt);
}
```

**3. Implement conversion function:**
```javascript
async function convertImageToMarkdown(globalFlags, inputPath, opts, toFmt) {
  // Use Charmonizer /conversion/image endpoint
  // Similar to convertPdfToMarkdown
}
```

---

### Add New Guide

To add support for a new conversion via guide:

**1. Create guide directory:**
```bash
mkdir -p guides/my-new-guide
```

**2. Create required files:**
```
guides/my-new-guide/
├── type.json          # "interpreter" or "compiler"
├── inputs.json        # ["input-format", ...]
├── outputs.json       # ["output-format", ...]
├── SYSTEM.hbs         # Handlebars template
└── description.md     # Guide description
```

**3. Test routing:**
```bash
charm transmogrify --dry-run --to output-format input-file
```

See [Guide Development](./08-guide-development.md) for details.

---

## Performance Considerations

### Route Performance

| Route | Typical Time | Bottleneck |
|-------|-------------|------------|
| charm convert | < 1 second | File I/O |
| PDF endpoint | 10-120 seconds | OCR + vision processing |
| Interpreter guide | 5-30 seconds | AI model inference |
| Compiler guide | 10-60 seconds | Code generation + execution |

### Optimization Strategies

**1. Use fastest route when possible:**
```bash
# Fast: Use charm convert
charm transmogrify --to md report.docx  # Route 1

# Avoid: Force guide for docx→md
charm transmogrify --guide generic-compiler --to md report.docx  # Slower
```

**2. Create specialized guides:**

Specialized guides are faster than generic-compiler:
```bash
# Faster: Specialized guide with targeted prompt
charm transmogrify --to pptx case.md  # oncology-pptx guide

# Slower: Generic guide figures out structure
charm transmogrify --guide generic-compiler --to pptx case.md
```

**3. Use interpreter when possible:**

Interpreter guides are faster than compiler guides:
```
Type: interpreter  ← Faster (1 API call)
Type: compiler     ← Slower (generate code + execute)
```

---

## Next Steps

- **Learn about guides:** [Guide System](./05-guide-system.md)
- **Format specifications:** [Format Specifications](./06-format-specifications.md)
- **Create custom guides:** [Guide Development](./08-guide-development.md)
- **Command flags:** [Command Reference](./03-command-reference.md)
