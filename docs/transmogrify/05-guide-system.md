# Guide System

Guides are the heart of transmogrify's extensibility. They define how to convert between specific format pairs using either direct AI transformation or AI-generated code.

## What is a Guide?

A guide is a recipe that tells transmogrify:

- **What formats** it can convert between (inputs/outputs)
- **How to convert** (interpreter vs compiler)
- **What to tell the AI** (system prompt template)
- **What helpers are available** (optional Python utilities)

Think of guides as plugins that extend transmogrify's capabilities without modifying core code.

## Guide Directory Structure

Each guide lives in its own directory under `guides/`:

```
guides/
├── oncology-pptx/              # Specialized guide
│   ├── type.json               # "interpreter" or "compiler"
│   ├── inputs.json             # Accepted input formats
│   ├── outputs.json            # Produced output formats
│   ├── SYSTEM.hbs              # Handlebars system prompt template
│   ├── description.md          # Guide description (for scoring)
│   └── helpers.py              # Optional: Helper code (compiler only)
│
└── generic-compiler/           # Fallback guide
    ├── type.json
    ├── inputs.json
    ├── outputs.json
    ├── SYSTEM.hbs
    ├── description.md
    └── helpers.py
```

### Required Files

Every guide must have these files:

| File | Purpose | Format |
|------|---------|--------|
| `type.json` | Guide execution mode | JSON string: `"interpreter"` or `"compiler"` |
| `inputs.json` | Accepted input formats | JSON array of format strings |
| `outputs.json` | Produced output formats | JSON array of format strings |
| `SYSTEM.hbs` | System prompt template | Handlebars template |
| `description.md` | Guide description | Markdown text |

### Optional Files

| File | Purpose | Used By |
|------|---------|---------|
| `helpers.py` | Python helper functions | Compiler guides only |

---

## Guide Types

There are two types of guides, each with different execution models:

### Interpreter Guides

**How it works:**
1. Render system prompt from template
2. Send prompt + input to AI model
3. AI directly produces output
4. Write output to file

**Characteristics:**
- ✅ Faster (single API call)
- ✅ Simpler (no code execution)
- ✅ Safer (no generated code)
- ❌ Limited (text-only transformations)
- ❌ No libraries (can't use python-pptx, etc.)

**Best for:**
- Text → Text conversions
- Format transformations (markdown variants)
- Simple restructuring

**Example use cases:**
- GitHub markdown → Obsidian markdown
- JSON → XML
- CSV → formatted markdown table

---

### Compiler Guides

**How it works:**
1. Render system prompt from template
2. AI generates Python code
3. User confirms execution (unless `--yes`)
4. Code runs in sandbox, reads stdin, writes output file
5. Return output to user

**Characteristics:**
- ✅ Powerful (can use any Python library)
- ✅ Complex logic (conditionals, loops, data processing)
- ✅ File I/O (can generate binary files like .pptx)
- ❌ Slower (generate + execute)
- ❌ Requires confirmation (safety)

**Best for:**
- Generating binary formats (PowerPoint, PDFs)
- Complex data transformations
- Using specialized libraries (python-pptx, pandas)

**Example use cases:**
- Markdown → PowerPoint
- CSV → validated JSON with statistics
- PDF → structured database entries

---

## File-by-File Reference

### `type.json`

Specifies the guide execution mode.

**Format:** JSON string (must be quoted!)

**Valid values:**
- `"interpreter"` - Direct AI output
- `"compiler"` - AI generates code

**Examples:**

**Interpreter guide:**
```json
"interpreter"
```

**Compiler guide:**
```json
"compiler"
```

**Common mistakes:**
```json
compiler           ❌ Missing quotes
"Compiler"         ❌ Wrong capitalization
"interpreter_mode" ❌ Invalid value
```

---

### `inputs.json`

List of input formats this guide accepts.

**Format:** JSON array of format strings

**Format string types:**
- File extension: `"md"`, `"pdf"`, `"json"`
- MIME type: `"text/markdown"`, `"application/pdf"`
- MIME with variant: `"text/markdown; variant=GFM"`
- Wildcard: `"*/*"` (matches any format)

**Examples:**

**Specific extensions:**
```json
["md", "markdown"]
```

**MIME types:**
```json
["text/markdown", "application/json"]
```

**With variants:**
```json
["text/markdown; variant=GFM", "text/markdown; variant=CommonMark"]
```

**Wildcard (generic guide):**
```json
["*/*"]
```

**Scoring impact:**
- Exact variant match: +5 points
- Exact MIME match: +4 points
- Extension match: +3 points
- Wildcard: 0 points

---

### `outputs.json`

List of output formats this guide produces.

**Format:** JSON array of format strings (same as inputs.json)

**Examples:**

**PowerPoint output:**
```json
[
  "pptx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]
```

**JSON output:**
```json
["json", "application/json"]
```

**Markdown variants:**
```json
["text/markdown; variant=Obsidian"]
```

**Wildcard:**
```json
["*/*"]
```

---

### `SYSTEM.hbs`

Handlebars template for the system prompt sent to the AI model.

**Template Variables:**

| Variable | Type | Description |
|----------|------|-------------|
| `{{input_format}}` | string | Input format descriptor |
| `{{output_format}}` | string | Output format descriptor |
| `{{guidance}}` | string | User-provided guidance (optional) |
| `{{output_schema}}` | string | JSON schema for validation (optional) |

**Conditional blocks:**

```handlebars
{{#if guidance}}
  User guidance: {{guidance}}
{{/if}}

{{#if output_schema}}
  Validate against this schema:
  {{output_schema}}
{{/if}}
```

**Interpreter Template Example:**

```handlebars
You are a format conversion assistant.

**Input format:** {{input_format}}
**Output format:** {{output_format}}

{{#if guidance}}
**Additional guidance:**
{{guidance}}
{{/if}}

Convert the following input to the target format:
```

**Compiler Template Example:**

```handlebars
You are a Python code generator for format conversion.

**Input format:** {{input_format}}
**Output format:** {{output_format}}

{{#if guidance}}
**Additional guidance:**
{{guidance}}
{{/if}}

Generate a Python script with these requirements:
- Read input from STDIN
- Accept output filename as sys.argv[1]
- Write result to the output file
- Handle errors gracefully

{{#if output_schema}}
The output must conform to this JSON schema:
```json
{{output_schema}}
```
{{/if}}

Generate complete, runnable Python code.
```

**Best practices:**
- Be explicit about input/output requirements
- Include error handling instructions
- Specify desired output structure
- Use guidance to customize behavior
- For compiler: Specify I/O conventions clearly

---

### `description.md`

Human-readable description of what the guide does.

**Purpose:**
- Documentation for users
- Substring matching for guide scoring (+1 point per match)
- Context for understanding guide behavior

**Format:** Markdown text

**Example (oncology-pptx/description.md):**

```markdown
# Oncology PowerPoint Guide

Converts markdown transcriptions of cancer patient cases into professional PowerPoint presentations suitable for tumor board discussions.

## Features

- Extracts structured clinical data (demographics, history, genomics)
- Creates professional slide layouts (title, sections, bullets)
- De-identifies patient information (PHI removal)
- Formats genomic data in tables
- Highlights key treatment options

## Best For

- Oncology case presentations
- Tumor board discussions
- Clinical case studies
- Medical education

## Input Format

Markdown files containing:
- Patient demographics and history
- Diagnostic information
- Genomic/molecular data
- Treatment history
- Imaging findings

## Output Format

PowerPoint (.pptx) with:
- Title slide with patient ID
- Clinical history slides
- Genomics/molecular data slides
- Treatment slides
- Imaging/pathology slides
```

**Best practices:**
- Clearly describe the use case
- List key features
- Specify expected input structure
- Describe output structure
- Include keywords for scoring (e.g., "oncology", "tumor board")

---

### `helpers.py` (Compiler Only)

Python helper functions available to generated code.

**Purpose:**
- Reusable utility functions
- Reduce repetition in generated code
- Provide tested, reliable functions

**How it's used:**
1. Copied into sandbox directory
2. Imported by generated code: `from helpers import ...`
3. Called from generated script

**Example (generic-compiler/helpers.py):**

```python
import json
import sys

def read_stdin():
    """Read all input from stdin."""
    return sys.stdin.read()

def write_output(filepath, content):
    """Write content to output file."""
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

def write_json(filepath, data):
    """Write data as formatted JSON."""
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def parse_json(text):
    """Parse JSON with error handling."""
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}", file=sys.stderr)
        sys.exit(1)
```

**Example (oncology-pptx/helpers.py):**

```python
from pptx import Presentation
from pptx.util import Inches, Pt

def create_presentation():
    """Create a new PowerPoint presentation."""
    return Presentation()

def add_title_slide(prs, title, subtitle=""):
    """Add a title slide."""
    slide = prs.slides.add_slide(prs.slide_layouts[0])
    slide.shapes.title.text = title
    if subtitle:
        slide.placeholders[1].text = subtitle
    return slide

def add_bullet_slide(prs, title, bullets):
    """Add a slide with bullet points."""
    slide = prs.slides.add_slide(prs.slide_layouts[1])
    slide.shapes.title.text = title
    text_frame = slide.placeholders[1].text_frame

    for bullet in bullets:
        p = text_frame.add_paragraph()
        p.text = bullet
        p.level = 0

    return slide

def save_presentation(prs, filepath):
    """Save presentation to file."""
    prs.save(filepath)
```

**Best practices:**
- Keep functions focused and reusable
- Include docstrings
- Handle errors gracefully
- Don't include main logic (let AI generate that)
- Test helpers independently

**Notes:**
- Only used by compiler guides
- Not available to interpreter guides
- Mentioned in SYSTEM.hbs to inform AI
- Must be valid, importable Python

---

## Guide Execution Flow

### Interpreter Guide Execution

```
1. Load guide files
   ├── Read type.json → "interpreter"
   ├── Parse inputs.json, outputs.json
   └── Load SYSTEM.hbs template

2. Prepare prompt
   ├── Render SYSTEM.hbs with variables:
   │   ├── input_format
   │   ├── output_format
   │   ├── guidance (if provided)
   │   └── output_schema (if provided)
   └── Read input file content

3. Call AI model
   ├── System prompt: rendered template
   ├── User message: input content
   └── Wait for response

4. Process response
   ├── Extract text from AI response
   ├── Validate (if JSON + schema)
   └── Write to output file

5. Done
```

**Example API call:**

```javascript
const response = await fetch(`${baseUrl}/api/charmonator/transcript/extension`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: globalFlags.model,
    messages: [
      { role: 'system', content: renderedSystemPrompt },
      { role: 'user', content: inputFileContent }
    ]
  })
});
```

---

### Compiler Guide Execution

```
1. Load guide files
   ├── Read type.json → "compiler"
   ├── Parse inputs.json, outputs.json
   ├── Load SYSTEM.hbs template
   └── Load helpers.py (if exists)

2. Prepare prompt
   ├── Render SYSTEM.hbs with variables
   ├── Mention helpers.py availability
   └── Specify I/O requirements

3. Call AI model to generate code
   ├── System prompt: rendered template
   ├── User message: "Generate Python code..."
   └── Receive Python code in response

4. Sandbox setup
   ├── Create temp directory: /tmp/charm-transmog-XXXXX
   ├── Write generated code: compile.py
   ├── Copy helpers.py (if exists)
   └── Copy input file

5. User confirmation
   ├── Show: "About to execute model-generated code..."
   ├── Show: Sandbox location
   ├── Prompt: "Execute? [y/N]"
   └── If --yes: skip prompt

6. Execute code
   ├── Run: python3 compile.py output.ext < input.txt
   ├── Timeout: 120 seconds (configurable)
   ├── Capture: stdout, stderr
   └── Wait for completion

7. Process output
   ├── Check exit code (0 = success)
   ├── Read generated output file
   ├── Validate (if JSON + schema)
   └── Copy to final destination

8. Cleanup
   ├── If --keep-sandbox: leave files
   └── Else: delete temp directory

9. Done
```

**Example generated code:**

```python
#!/usr/bin/env python3
import sys
import json
from helpers import read_stdin, write_json

# Read input
input_text = read_stdin()
input_data = json.loads(input_text)

# Process
output_data = {
    "processed": True,
    "items": [item.upper() for item in input_data.get("items", [])]
}

# Write output
output_path = sys.argv[1]
write_json(output_path, output_data)
```

---

## Creating a New Guide

### Step 1: Create Directory

```bash
mkdir -p guides/my-new-guide
cd guides/my-new-guide
```

---

### Step 2: Choose Guide Type

**Decision tree:**

```
Can this conversion be done with pure text transformation?
├─ YES → Use interpreter guide
│   ├─ Faster
│   ├─ Simpler
│   └─ Safer
│
└─ NO → Use compiler guide
    ├─ Need libraries (pptx, pandas)?
    ├─ Complex logic?
    ├─ Binary output?
    └─ Multi-step processing?
```

---

### Step 3: Create `type.json`

**For interpreter:**
```bash
echo '"interpreter"' > type.json
```

**For compiler:**
```bash
echo '"compiler"' > type.json
```

---

### Step 4: Define Input Formats (`inputs.json`)

```bash
cat > inputs.json <<'EOF'
["md", "text/markdown"]
EOF
```

**Tips:**
- Include both extension and MIME type for better scoring
- Add variants if needed: `"text/markdown; variant=GFM"`
- Use `["*/*"]` for generic guides

---

### Step 5: Define Output Formats (`outputs.json`)

```bash
cat > outputs.json <<'EOF'
["html", "text/html"]
EOF
```

---

### Step 6: Write System Prompt (`SYSTEM.hbs`)

**For interpreter guide:**

```bash
cat > SYSTEM.hbs <<'EOF'
You are a format conversion assistant specializing in {{input_format}} to {{output_format}} conversion.

{{#if guidance}}
**User guidance:**
{{guidance}}
{{/if}}

Convert the following input directly to the target format. Output only the converted content, no explanations.
EOF
```

**For compiler guide:**

```bash
cat > SYSTEM.hbs <<'EOF'
You are a Python code generator for format conversion.

**Task:** Convert {{input_format}} to {{output_format}}

{{#if guidance}}
**User guidance:**
{{guidance}}
{{/if}}

Generate a complete Python script that:
1. Reads input from STDIN
2. Accepts output filename as sys.argv[1]
3. Processes the input appropriately
4. Writes result to output file

You may use standard libraries. Output only the Python code, no explanations.
EOF
```

---

### Step 7: Write Description (`description.md`)

```bash
cat > description.md <<'EOF'
# My New Guide

Converts markdown to HTML with custom styling.

## Features
- Clean HTML output
- Preserves markdown structure
- Adds custom CSS classes

## Use Cases
- Blog posts
- Documentation
- Static sites
EOF
```

---

### Step 8: Add Helpers (Compiler Only)

```bash
cat > helpers.py <<'EOF'
import sys

def read_stdin():
    """Read all input from stdin."""
    return sys.stdin.read()

def write_output(filepath, content):
    """Write content to output file."""
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
EOF
```

---

### Step 9: Test Guide

**Dry-run test:**
```bash
charm transmogrify --dry-run --guide my-new-guide --to html input.md
```

**Full test:**
```bash
charm transmogrify --guide my-new-guide --to html input.md
```

**Check output:**
```bash
cat input.html
```

---

## Built-in Guides

### oncology-pptx

**Purpose:** Convert markdown oncology cases to PowerPoint

**Type:** Compiler

**Input formats:** `["md", "text/markdown"]`

**Output formats:** `["pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"]`

**Features:**
- Extracts structured clinical data
- Creates professional slide layouts
- De-identifies PHI
- Formats genomics in tables

**Best for:** Tumor board presentations

**Example:**
```bash
charm transmogrify --to pptx cancer-case.md
```

---

### generic-compiler

**Purpose:** Fallback for any format conversion

**Type:** Compiler

**Input formats:** `["*/*"]`

**Output formats:** `["*/*"]`

**Features:**
- Matches any input/output combination
- AI figures out conversion logic
- Uses helpers for common operations

**Best for:** Unusual format combinations without specialized guide

**Example:**
```bash
charm transmogrify --to json data.xyz
# Falls back to generic-compiler
```

---

## Guide Best Practices

### System Prompt Design

**Be specific about I/O:**
```handlebars
✅ "Read input from STDIN. Write output to sys.argv[1]."
❌ "Read the input and write the output."
```

**Include error handling:**
```handlebars
✅ "Handle malformed input gracefully. Exit with code 1 on errors."
❌ "Convert the input."
```

**Use guidance effectively:**
```handlebars
✅ {{#if guidance}}
   Consider this guidance: {{guidance}}
   {{/if}}
❌ (ignoring guidance variable)
```

**Specify output structure:**
```handlebars
✅ "Output valid JSON with 'name' and 'value' fields."
❌ "Output JSON."
```

---

### Format Specifications

**Be inclusive:**
```json
✅ ["md", "markdown", "text/markdown"]
❌ ["md"]
```

**Use variants when relevant:**
```json
✅ ["text/markdown; variant=GFM"]
❌ ["text/markdown"]  (when GFM-specific)
```

**Avoid overly broad matches:**
```json
✅ ["application/json", "application/ld+json"]
❌ ["*/*"]  (unless truly generic)
```

---

### Helper Functions

**Keep them pure:**
```python
✅ def parse_json(text): ...
❌ def main(): ...  (don't include main logic)
```

**Make them reusable:**
```python
✅ def add_slide(prs, title, content): ...
❌ def add_patient_demographics_slide(prs, patient): ...  (too specific)
```

**Document them:**
```python
✅ def read_stdin():
     """Read all input from stdin."""
     ...
❌ def read_stdin(): ...
```

---

## Advanced Guide Patterns

### Variant-Specific Guides

Create guides for specific markdown variants:

**guides/gfm-to-obsidian/inputs.json:**
```json
["text/markdown; variant=GFM"]
```

**guides/gfm-to-obsidian/outputs.json:**
```json
["text/markdown; variant=Obsidian"]
```

**Advantage:** Scores higher than generic markdown guide (+5 vs +4 or +3)

---

### Domain-Specific Guides

Create guides for specific domains (medical, legal, scientific):

**guides/medical-json/description.md:**
```markdown
# Medical Record to JSON

Extracts clinical data from medical records including:
- Demographics
- Diagnoses (ICD-10 codes)
- Medications
- Lab results
- Vital signs
```

**Advantage:** Description keywords boost scoring when guidance matches

---

### Chained Conversions

Use intermediate formats:

```bash
# PDF → Markdown → JSON
charm transmogrify --to md record.pdf
charm transmogrify --to json record.md
```

**Advantage:** Leverage specialized guides for each step

---

## Troubleshooting Guides

### Guide Not Loading

**Symptoms:**
```
[WARN] Failed to load guide my-guide: <error>
```

**Common causes:**

1. **Invalid JSON:**
```json
❌ type.json contains: compiler (unquoted)
✅ type.json contains: "compiler"
```

2. **Missing files:**
```
❌ Missing inputs.json
✅ All required files present
```

3. **Invalid type:**
```json
❌ "Compiler"
✅ "compiler"
```

---

### Guide Not Selected

**Symptoms:**
Guide loads but generic-compiler is used instead.

**Debug with dry-run:**
```bash
charm transmogrify --dry-run --to <format> input.ext
```

**Common causes:**

1. **Format mismatch:**
```json
# Guide has: ["md"]
# You specified: --from markdown
# Solution: Add "markdown" to inputs.json
```

2. **Lower score than generic-compiler:**
```json
# Your guide: inputs: ["*/*"], outputs: ["json"] → score 3
# generic-compiler: inputs: ["*/*"], outputs: ["*/*"] → score 0
# But another guide might score higher!
```

---

### Generated Code Fails

**Symptoms (compiler guides):**
```
[ERROR] Compiler script exited with code 1
```

**Debug steps:**

1. **Keep sandbox:**
```bash
charm transmogrify --keep-sandbox --to json input.csv
```

2. **Inspect generated code:**
```bash
cat /tmp/charm-transmog-XXXXX/compile.py
```

3. **Test manually:**
```bash
cd /tmp/charm-transmog-XXXXX
python3 compile.py output.json < input.txt
```

4. **Common issues:**
   - Missing imports
   - Incorrect I/O assumptions
   - Missing error handling
   - Library not installed

---

## Next Steps

- **Create a guide:** [Guide Development](./08-guide-development.md)
- **Format specs:** [Format Specifications](./06-format-specifications.md)
- **See examples:** [Examples](./07-examples.md)
- **Understand routing:** [Routing System](./04-routing-system.md)
