# Overview

## What is Charm Transmogrify?

`charm transmogrify` is an intelligent file format conversion system that combines multiple conversion strategies to handle complex transformations between file formats. Unlike simple converters, transmogrify can:

- Generate custom conversion code using AI
- Apply domain-specific knowledge through guides
- Validate outputs against schemas
- Handle complex multi-step transformations
- Process PDFs with OCR and vision models

## Why Transmogrify?

### The Problem

Converting between file formats is often more complex than it appears:

- **Simple converters** are limited to predefined format pairs
- **Manual conversion** is time-consuming and error-prone
- **Domain knowledge** is needed for specialized formats (e.g., medical records → presentations)
- **Validation** is often neglected, leading to malformed outputs
- **Complex transformations** (PDF with images → structured data) require multiple tools

### The Solution

Transmogrify solves these problems by:

1. **Intelligent Routing**: Automatically selecting the best conversion method
2. **AI-Powered**: Generating custom conversion code when needed
3. **Extensible Guides**: Supporting domain-specific transformations
4. **Validation**: Ensuring outputs match expected schemas
5. **Safety**: Sandboxing generated code with user confirmation

## Core Concepts

### Conversion Pathways

Transmogrify supports three main conversion pathways, checked in priority order:

#### 1. Built-in Conversions (charm convert)

Fast, reliable conversions for common format pairs:
- `.doc.json` → `.md`
- `.docx` → `.md`
- `.pptx` → `.md`

These use existing `charm convert` functionality.

#### 2. Native Endpoints

Specialized endpoints for complex conversions:
- `.pdf` → `.md` (uses Charmonizer image PDF endpoint with OCR + vision models)

These leverage optimized server-side processing.

#### 3. Guide-Based Conversions

Flexible, AI-powered conversions using guides:
- **Interpreter guides**: AI model directly produces output
- **Compiler guides**: AI generates Python code that performs conversion

Examples:
- Markdown oncology case → PowerPoint presentation (compiler)
- CSV → validated JSON with summary statistics (compiler)
- GitHub markdown → Obsidian markdown (compiler)

### Guides

Guides are recipes for conversions that tell transmogrify:
- What input/output formats they support
- How to convert between them (interpreter vs compiler)
- What system prompts to use
- What helper code is available

**Two types of guides:**

1. **Interpreter Guides**: Direct AI transformation
   - Model reads input, produces output
   - Faster, simpler
   - Good for text transformations

2. **Compiler Guides**: AI generates code
   - Model generates Python script
   - Script reads stdin, writes output file
   - More powerful, handles complex logic
   - Executed in sandbox with confirmation

### Format Specifications

Transmogrify supports flexible format specification:

```bash
# File extension
--from pdf --to md

# MIME type
--from application/pdf --to text/markdown

# MIME with variant
--from "text/markdown; variant=GFM" --to "text/markdown; variant=Obsidian"

# Multi-line description
--from-file format-description.txt
```

### Routing Logic

When you run `charm transmogrify input.ext --to output-ext`:

```
1. Parse input/output formats
   ↓
2. Route 1: Check if covered by charm convert
   → YES: Use convert, DONE
   → NO: Continue
   ↓
3. Route 2: Check if native endpoint exists (pdf→md)
   → YES: Use endpoint, DONE
   → NO: Continue
   ↓
4. Route 3: Find matching guide
   → Match found: Use guide (interpreter or compiler)
   → No match: Use generic-compiler fallback
   ↓
5. Execute conversion
   ↓
6. Validate & write output
```

## Key Features

### 1. Intelligent Format Matching

Transmogrify scores guides based on format compatibility:

- **Exact variant match**: +5 points (e.g., `variant=GFM`)
- **Exact MIME match**: +4 points (e.g., `text/markdown`)
- **Extension match**: +3 points (e.g., `.md`)
- **Description substring**: +1 point
- **Wildcard**: 0 points (matches anything)

The highest-scoring guide is selected automatically.

### 2. Safety Features

**For Compiler-Based Conversions:**

- **Confirmation prompt**: "About to execute model-generated Python code. Execute? [y/N]"
- **Sandboxed execution**: Runs in temporary directory with minimal environment
- **Timeout limits**: Default 120 seconds (configurable)
- **No network access**: Code is instructed not to make network calls
- **Cleanup**: Temporary files removed after execution (unless `--keep-sandbox`)

**Overrides:**
- `--yes` flag: Skip confirmation
- `CHARM_TRANSMOGRIFY_TRUST_COMPILED=1`: Skip confirmation via environment

### 3. Validation

**JSON Output Validation:**
- Always validates JSON syntax
- Optional schema validation with `--output-schema-file`
- Warnings for schema violations (non-fatal by default)

**Metadata Preservation:**
- PDF conversions preserve filename, SHA256, file size
- Page markers for multi-page documents
- Extraction confidence scores

### 4. Guidance System

Provide natural language instructions to customize conversions:

```bash
--guidance "Extract only clinical data, de-identify PHI"
--guidance-file instructions.txt
```

The guidance is:
- Passed to the AI model
- Used to customize conversion behavior
- Can trigger special handling (e.g., medical document optimization)

### 5. Dry-Run Mode

Preview routing decisions without executing:

```bash
charm transmogrify --dry-run --to pptx input.md
```

Shows:
- Resolved input/output formats
- Selected route (convert, endpoint, or guide)
- Guide type (interpreter or compiler)

## Architecture Overview

### Command Flow

```
CLI Arguments
    ↓
Parse Flags & Options
    ↓
Resolve Input/Output Formats
    ↓
Route Selection
    ↓
┌─────────────────────────────────────────┐
│         Conversion Execution            │
├─────────────────────────────────────────┤
│                                         │
│  charm convert → Direct delegation      │
│                                         │
│  Native Endpoint → API call with poll   │
│                                         │
│  Interpreter Guide → Render prompt,     │
│                      call API,          │
│                      return output      │
│                                         │
│  Compiler Guide → Render prompt,        │
│                   generate code,        │
│                   sandbox execute,      │
│                   return output         │
│                                         │
└─────────────────────────────────────────┘
    ↓
Validate Output (JSON, schema)
    ↓
Write to File
```

### Directory Structure

```
charm-cli/
├── bin/commands/
│   └── transmogrify.mjs       # Main implementation
├── guides/                     # Guide registry
│   ├── generic-compiler/       # Fallback for any→any
│   │   ├── type.json
│   │   ├── SYSTEM.hbs
│   │   ├── inputs.json
│   │   ├── outputs.json
│   │   ├── helpers.py
│   │   └── description.md
│   └── oncology-pptx/          # Specialized guide
│       ├── type.json
│       ├── SYSTEM.hbs
│       ├── inputs.json
│       ├── outputs.json
│       ├── helpers.py
│       └── description.md
└── examples/transmogrify/      # Working examples
    ├── oncology-pptx/
    ├── pdf-to-md-to-fhir-to-html/
    ├── csv-to-json/
    └── markdown-variants/
```

## Comparison with Alternatives

### vs. charm convert

| Feature | charm convert | charm transmogrify |
|---------|--------------|-------------------|
| Format coverage | 3 conversions | Unlimited (via guides) |
| AI-powered | No | Yes |
| Schema validation | No | Yes |
| Custom guidance | No | Yes |
| Extensible | No | Yes (guides) |
| Use case | Simple, fast | Complex, flexible |

### vs. charm transcribe

| Feature | charm transcribe | charm transmogrify |
|---------|-----------------|-------------------|
| Purpose | PDF→markdown only | Any format→any format |
| Flags | Many specific flags | Simple --to flag |
| Output formats | .md or .doc.json | Any (via guides) |
| Integration | Standalone | Unified workflow |
| Use case | PDF processing | General conversions |

**Note:** Transmogrify internally uses the same PDF endpoint as transcribe for pdf→md.

### vs. pandoc

| Feature | pandoc | charm transmogrify |
|---------|--------|-------------------|
| AI-powered | No | Yes |
| Vision models | No | Yes (PDF) |
| Custom logic | Limited | Unlimited (guides) |
| Schema validation | No | Yes |
| Safety | N/A | Sandboxing |
| Use case | Document formats | Any transformation |

## When to Use Transmogrify

**Good use cases:**

✅ Converting between formats not supported by built-in tools
✅ Transformations requiring domain knowledge (medical, scientific)
✅ PDF documents with complex layouts or images
✅ Data validation with JSON schemas
✅ Custom transformation logic
✅ Batch processing with consistent rules

**Better alternatives:**

❌ Simple docx→md: Use `charm convert` (faster)
❌ Just OCR: Use `charm transcribe` (more options)
❌ Standard document formats: Use pandoc (mature, stable)
❌ Programming language conversion: Use dedicated tools

## Performance Considerations

**Fast conversions (< 5 seconds):**
- Built-in conversions via charm convert
- Simple interpreter guides

**Medium conversions (5-60 seconds):**
- PDF→markdown (depends on page count)
- Compiler guides with simple logic

**Slow conversions (1-5 minutes):**
- Complex PDFs with many images
- Large documents (100+ pages)
- Compiler guides with heavy processing

**Optimization tips:**
- Use `--dry-run` to verify routing before running
- Create specialized guides for repeated conversions
- Use interpreter guides when possible (faster than compiler)
- Cache PDF conversion results for repeated processing

## Security & Privacy

### Generated Code Execution

**Risks:**
- Model-generated Python code is executed locally
- Code could potentially be malicious (though model is instructed otherwise)

**Mitigations:**
- User confirmation required by default
- Sandboxed execution in temporary directory
- Minimal environment (no sensitive variables)
- Timeout limits prevent runaway processes
- Code can be inspected before execution (`--keep-sandbox`)

**Best practices:**
- Review generated code in sensitive environments
- Use `--dry-run` first to understand routing
- Set short timeouts for untrusted inputs
- Don't use `--yes` for untrusted documents

### Data Privacy

**Considerations:**
- Documents are sent to AI model API
- Generated code has access to document content
- Medical/sensitive data requires appropriate safeguards

**Recommendations:**
- Use local/private model endpoints for sensitive data
- De-identify data before conversion when possible
- Review privacy policies of API providers
- Use guides that explicitly handle de-identification (e.g., oncology-pptx)

## Next Steps

- **Try it:** [Quick Start](./02-quick-start.md)
- **Learn flags:** [Command Reference](./03-command-reference.md)
- **Understand routing:** [Routing System](./04-routing-system.md)
- **See examples:** [Examples](./07-examples.md)
- **Create guides:** [Guide Development](./08-guide-development.md)
