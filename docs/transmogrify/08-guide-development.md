# Guide Development

Complete guide to creating custom guides for charm transmogrify.

## Overview

Creating a guide allows you to extend transmogrify with specialized conversion capabilities tailored to your domain, format requirements, or workflow needs.

**What you'll learn:**
- When to create a guide
- Choosing interpreter vs compiler mode
- Creating all required files
- Testing and debugging
- Best practices

---

## When to Create a Guide

### Good Use Cases

✅ **Create a guide when:**

1. **Repeated conversions** - You perform the same conversion frequently
2. **Domain-specific** - Conversion requires specialized knowledge
3. **Complex transformations** - Multi-step logic or specialized libraries needed
4. **Format variants** - Need to handle specific format flavors (GFM, Obsidian, etc.)
5. **Quality improvements** - Generic guide produces poor results
6. **Organizational standards** - Company-specific format requirements

### Poor Use Cases

❌ **Don't create a guide when:**

1. **One-time conversion** - Use generic guide or manual process
2. **Already covered** - `charm convert` or existing guide handles it
3. **Simple transformation** - Generic guide works well enough
4. **Rapidly changing** - Requirements change frequently

---

## Guide Type Selection

### Decision Tree

```
Start here: What is the conversion?
│
├─ Does it require external libraries?
│  (python-pptx, pandas, specialized parsers)
│  │
│  ├─ YES → Use COMPILER guide
│  │
│  └─ NO → Continue...
│
├─ Does it generate binary output?
│  (PowerPoint, PDF, images)
│  │
│  ├─ YES → Use COMPILER guide
│  │
│  └─ NO → Continue...
│
├─ Does it need complex logic?
│  (conditionals, loops, multi-step processing)
│  │
│  ├─ YES → Use COMPILER guide
│  │
│  └─ NO → Continue...
│
└─ Is it pure text transformation?
   │
   ├─ YES → Use INTERPRETER guide
   │
   └─ UNSURE → Start with INTERPRETER, upgrade to COMPILER if needed
```

### Interpreter vs Compiler Comparison

| Aspect | Interpreter | Compiler |
|--------|-------------|----------|
| **Execution** | Direct AI output | AI generates Python code |
| **Speed** | Faster (1 API call) | Slower (generate + execute) |
| **Capabilities** | Text only | Text + binary + libraries |
| **Safety** | Safer (no code execution) | Requires confirmation |
| **Debugging** | Harder | Easier (inspect code) |
| **Best for** | Text transformations | Complex logic |

---

## Creating Your First Guide

Let's create a complete guide step-by-step.

### Example: Markdown to HTML Guide

**Goal:** Convert markdown to clean HTML with custom CSS classes.

---

### Step 1: Create Directory Structure

```bash
# Navigate to guides directory
cd /path/to/charm-cli/guides

# Create guide directory
mkdir markdown-to-html
cd markdown-to-html
```

---

### Step 2: Determine Guide Type

**Question checklist:**
- External libraries needed? **No** (can use AI's built-in markdown knowledge)
- Binary output? **No** (HTML is text)
- Complex logic? **No** (straightforward transformation)
- Pure text transformation? **Yes**

**Decision:** Use **INTERPRETER** guide

---

### Step 3: Create `type.json`

```bash
echo '"interpreter"' > type.json
```

**Important:** Must be a quoted JSON string!

**Verification:**
```bash
cat type.json
# Output: "interpreter"
```

---

### Step 4: Create `inputs.json`

Define what input formats this guide accepts.

```bash
cat > inputs.json <<'EOF'
["md", "markdown", "text/markdown"]
EOF
```

**Explanation:**
- `"md"` - File extension (score: +3)
- `"markdown"` - Alternative extension (score: +3)
- `"text/markdown"` - MIME type (score: +4)

Multiple format specs increase chances of matching.

---

### Step 5: Create `outputs.json`

Define what output formats this guide produces.

```bash
cat > outputs.json <<'EOF'
["html", "text/html"]
EOF
```

**Explanation:**
- `"html"` - File extension (score: +3)
- `"text/html"` - MIME type (score: +4)

---

### Step 6: Create `SYSTEM.hbs`

Create the Handlebars template for the system prompt.

```bash
cat > SYSTEM.hbs <<'EOF'
You are a markdown to HTML conversion assistant.

**Task:** Convert markdown to clean, semantic HTML.

**Input format:** {{input_format}}
**Output format:** {{output_format}}

{{#if guidance}}
**Additional guidance:**
{{guidance}}
{{/if}}

**Requirements:**
- Use semantic HTML5 elements (header, article, section, etc.)
- Add CSS classes: .markdown-content, .heading, .paragraph, .code-block, .blockquote
- Preserve code block language hints as data-language attributes
- Convert markdown links to proper <a> tags
- Handle nested lists correctly
- Output only the HTML content (no ```html wrapper)

Convert the following markdown to HTML:
EOF
```

**Template variables:**
- `{{input_format}}` - Resolved input format string
- `{{output_format}}` - Resolved output format string
- `{{guidance}}` - User-provided guidance (optional)
- `{{#if guidance}}...{{/if}}` - Conditional block

---

### Step 7: Create `description.md`

Describe what the guide does (for documentation and scoring).

```bash
cat > description.md <<'EOF'
# Markdown to HTML Guide

Converts markdown documents to clean, semantic HTML with custom CSS classes.

## Features

- Semantic HTML5 elements (article, section, header)
- Custom CSS classes for styling
- Preserves code block language hints
- Handles nested lists and blockquotes
- Clean output (no wrapper code blocks)

## Best For

- Blog posts
- Documentation
- Static site generation
- Content management systems

## Output Format

Clean HTML with these CSS classes:
- `.markdown-content` - Container
- `.heading` - All headings
- `.paragraph` - Paragraphs
- `.code-block` - Code blocks
- `.blockquote` - Blockquotes
- `.list` - Lists

## Example

Input:
```markdown
# Hello World

This is a **bold** paragraph.
```

Output:
```html
<article class="markdown-content">
  <h1 class="heading">Hello World</h1>
  <p class="paragraph">This is a <strong>bold</strong> paragraph.</p>
</article>
```
EOF
```

---

### Step 8: Verify Structure

```bash
ls -la
# Should show:
# type.json
# inputs.json
# outputs.json
# SYSTEM.hbs
# description.md
```

**Verify JSON syntax:**
```bash
cat type.json | python3 -m json.tool
cat inputs.json | python3 -m json.tool
cat outputs.json | python3 -m json.tool
```

---

### Step 9: Test the Guide

**Create test input:**
```bash
cat > test-input.md <<'EOF'
# Test Document

This is a **test** paragraph with a [link](https://example.com).

## Code Example

```python
print("Hello World")
```
EOF
```

**Test with dry-run:**
```bash
charm transmogrify --dry-run --guide markdown-to-html --to html test-input.md
```

**Expected output:**
```
[DRY RUN MODE]
Input format: md (text/markdown)
Output format: html (text/html)
Route: markdown-to-html (interpreter)
```

**Run actual conversion:**
```bash
charm transmogrify --guide markdown-to-html --to html test-input.md
```

**Verify output:**
```bash
cat test-input.html
```

---

## Creating a Compiler Guide

Now let's create a compiler guide that requires code generation.

### Example: CSV to SQLite Guide

**Goal:** Convert CSV files to SQLite databases with typed columns.

---

### Step 1: Create Directory

```bash
cd /path/to/charm-cli/guides
mkdir csv-to-sqlite
cd csv-to-sqlite
```

---

### Step 2: Determine Guide Type

**Question checklist:**
- External libraries needed? **Yes** (sqlite3)
- Binary output? **Yes** (SQLite database file)
- Complex logic? **Yes** (schema inference, type conversion)

**Decision:** Use **COMPILER** guide

---

### Step 3: Create `type.json`

```bash
echo '"compiler"' > type.json
```

---

### Step 4: Create `inputs.json`

```bash
cat > inputs.json <<'EOF'
["csv", "text/csv"]
EOF
```

---

### Step 5: Create `outputs.json`

```bash
cat > outputs.json <<'EOF'
["db", "sqlite", "application/x-sqlite3"]
EOF
```

---

### Step 6: Create `helpers.py`

Helper functions for generated code to use.

```bash
cat > helpers.py <<'EOF'
import sys
import csv
import sqlite3

def read_csv(file_path=None):
    """Read CSV from stdin or file."""
    if file_path:
        with open(file_path, 'r', encoding='utf-8') as f:
            return list(csv.DictReader(f))
    else:
        return list(csv.DictReader(sys.stdin))

def infer_column_type(values):
    """Infer SQL column type from sample values."""
    # Try integer
    try:
        [int(v) for v in values if v]
        return 'INTEGER'
    except ValueError:
        pass

    # Try real
    try:
        [float(v) for v in values if v]
        return 'REAL'
    except ValueError:
        pass

    # Default to text
    return 'TEXT'

def create_table(conn, table_name, columns):
    """Create table with inferred schema."""
    column_defs = []
    for col_name, col_type in columns.items():
        # Sanitize column name
        safe_name = col_name.replace(' ', '_').replace('-', '_')
        column_defs.append(f'"{safe_name}" {col_type}')

    create_sql = f'CREATE TABLE {table_name} ({", ".join(column_defs)})'
    conn.execute(create_sql)

def insert_rows(conn, table_name, rows, column_types):
    """Insert rows with type conversion."""
    if not rows:
        return

    columns = list(rows[0].keys())
    placeholders = ', '.join(['?' for _ in columns])
    safe_columns = [col.replace(' ', '_').replace('-', '_') for col in columns]
    column_list = ', '.join([f'"{col}"' for col in safe_columns])

    insert_sql = f'INSERT INTO {table_name} ({column_list}) VALUES ({placeholders})'

    for row in rows:
        values = []
        for col in columns:
            safe_col = col.replace(' ', '_').replace('-', '_')
            value = row[col]

            # Convert based on inferred type
            if column_types[safe_col] == 'INTEGER':
                values.append(int(value) if value else None)
            elif column_types[safe_col] == 'REAL':
                values.append(float(value) if value else None)
            else:
                values.append(value if value else None)

        conn.execute(insert_sql, values)
EOF
```

---

### Step 7: Create `SYSTEM.hbs`

```bash
cat > SYSTEM.hbs <<'EOF'
You are a Python code generator for CSV to SQLite conversion.

**Input format:** {{input_format}}
**Output format:** {{output_format}}

{{#if guidance}}
**Additional guidance:**
{{guidance}}
{{/if}}

**Task:** Generate a complete Python script that:
1. Reads CSV from STDIN
2. Infers column types (INTEGER, REAL, or TEXT)
3. Creates SQLite database
4. Creates table with inferred schema
5. Inserts all rows with type conversion
6. Writes database to output file (sys.argv[1])

**Available helper functions:**
You can import and use these from helpers.py:
- `read_csv()` - Read CSV from stdin
- `infer_column_type(values)` - Infer SQL type from sample values
- `create_table(conn, table_name, columns)` - Create table
- `insert_rows(conn, table_name, rows, column_types)` - Insert rows

**Requirements:**
- Read input from STDIN
- Accept output database path as sys.argv[1]
- Use table name "data" (or infer from context)
- Handle empty values as NULL
- Commit transaction before closing
- Handle errors gracefully (exit with code 1 on error)

Generate complete, runnable Python code (no explanations, no markdown):
EOF
```

---

### Step 8: Create `description.md`

```bash
cat > description.md <<'EOF'
# CSV to SQLite Guide

Converts CSV files to SQLite databases with automatic schema inference and type conversion.

## Features

- Automatic column type inference (INTEGER, REAL, TEXT)
- Proper NULL handling for empty values
- Sanitized column names (spaces → underscores)
- Transaction-based insertion for performance
- Error handling

## Best For

- Data migration to SQLite
- Creating queryable databases from CSV
- Type-safe data storage
- Embedded database creation

## Schema Inference

The guide analyzes sample values to infer types:
- All integers → INTEGER
- All floats → REAL
- Mixed or text → TEXT

## Example

Input CSV:
```csv
id,name,age,score
1,Alice,25,95.5
2,Bob,30,87.2
```

Output: SQLite database with:
```sql
CREATE TABLE data (
  "id" INTEGER,
  "name" TEXT,
  "age" INTEGER,
  "score" REAL
)
```
EOF
```

---

### Step 9: Test the Compiler Guide

**Create test CSV:**
```bash
cat > test-data.csv <<'EOF'
id,name,age,score
1,Alice,25,95.5
2,Bob,30,87.2
3,Charlie,28,92.0
EOF
```

**Test with dry-run:**
```bash
charm transmogrify --dry-run --guide csv-to-sqlite --to db test-data.csv
```

**Run with --keep-sandbox:**
```bash
charm transmogrify --guide csv-to-sqlite --to db --keep-sandbox test-data.csv
```

**Inspect generated code:**
```bash
# Sandbox location shown in output
cat /tmp/charm-transmog-XXXXX/compile.py
```

**Verify database:**
```bash
sqlite3 test-data.db "SELECT * FROM data"
```

---

## Advanced Techniques

### Technique 1: Conditional Prompts

Use guidance to customize behavior:

```handlebars
{{#if guidance}}
**User guidance:**
{{guidance}}

Apply this guidance when generating the conversion logic.
{{/if}}

{{#unless guidance}}
**Default behavior:**
Use standard conversion with no special handling.
{{/unless}}
```

---

### Technique 2: Schema-Aware Conversion

Use output schema to guide generation:

```handlebars
{{#if output_schema}}
**Important:** The output MUST conform to this JSON Schema:

```json
{{output_schema}}
```

Ensure all required fields are present and types match exactly.
{{/if}}
```

**Usage:**
```bash
charm transmogrify \
  --to json \
  --output-schema-file schema.json \
  --guide my-guide \
  input.csv
```

---

### Technique 3: Format-Specific Handling

Check format variants in template:

```handlebars
Convert {{input_format}} to {{output_format}}.

{{#if (contains input_format "variant=GFM")}}
**Note:** Input uses GitHub-Flavored Markdown. Handle:
- Task lists: - [ ] and - [x]
- Tables with alignment
- Strikethrough with ~~text~~
{{/if}}
```

**Note:** Requires custom Handlebars helper for `contains`. Currently not implemented, but can be added.

---

### Technique 4: Multi-File Helpers

Organize helpers into multiple functions:

**helpers.py:**
```python
# Import specific modules
from helpers_io import read_input, write_output
from helpers_validation import validate_data, check_schema
from helpers_transform import parse_format, convert_types

# Re-export for convenience
__all__ = [
    'read_input',
    'write_output',
    'validate_data',
    'check_schema',
    'parse_format',
    'convert_types'
]
```

---

## Testing and Debugging

### Test Checklist

- [ ] JSON files are valid (use `python3 -m json.tool`)
- [ ] `type.json` is quoted string
- [ ] Dry-run shows correct routing
- [ ] Guide selected over generic-compiler
- [ ] Output format is correct
- [ ] Output content is accurate
- [ ] Errors handled gracefully
- [ ] (Compiler) Generated code is runnable
- [ ] (Compiler) Helper imports work

---

### Debugging Workflow

**Step 1: Verify guide loads**
```bash
charm transmogrify --dry-run --guide my-guide --to output input.ext
```

**Expected:**
```
[DRY RUN MODE]
...
Route: my-guide (interpreter|compiler)
```

**If not loading:**
- Check JSON syntax in all .json files
- Verify all required files exist
- Check file permissions

---

**Step 2: Test format matching**
```bash
# Without --guide flag (automatic selection)
charm transmogrify --dry-run --to output input.ext
```

**If wrong guide selected:**
- Check inputs.json and outputs.json
- Add more format specifications
- Check description.md for keywords

---

**Step 3: Inspect generated code (compiler only)**
```bash
charm transmogrify --keep-sandbox --guide my-guide --to output input.ext
```

**Inspect:**
```bash
cat /tmp/charm-transmog-XXXXX/compile.py
```

**Test manually:**
```bash
cd /tmp/charm-transmog-XXXXX
python3 compile.py output.ext < input.txt
```

---

**Step 4: Debug execution errors**

**For interpreter guides:**
- Check system prompt clarity
- Add more specific instructions
- Provide examples in SYSTEM.hbs

**For compiler guides:**
- Test generated code manually
- Check helper function imports
- Verify required libraries installed
- Add error handling to helpers
- Increase `--compiler-timeout` if needed

---

### Common Issues

#### Issue 1: Guide Not Loading

**Symptoms:**
```
[WARN] Failed to load guide my-guide: <error>
```

**Solutions:**

1. **Check JSON syntax:**
```bash
python3 -m json.tool type.json
python3 -m json.tool inputs.json
python3 -m json.tool outputs.json
```

2. **Verify type.json is quoted:**
```bash
cat type.json
# Must be: "interpreter" or "compiler"
# Not: interpreter (unquoted)
```

3. **Check file permissions:**
```bash
chmod 644 *.json *.hbs *.md
chmod 644 helpers.py  # if exists
```

---

#### Issue 2: Generic Compiler Used Instead

**Symptoms:**
```
[INFO] Using guide: generic-compiler (compiler)
```

**Solutions:**

1. **Add more format specs:**
```json
// Before
["md"]

// After
["md", "markdown", "text/markdown"]
```

2. **Force guide for testing:**
```bash
charm transmogrify --guide my-guide --to output input.ext
```

3. **Check scoring:**
```bash
# Your guide must score higher than generic-compiler
# Generic-compiler scores 0 (wildcards)
# Your guide should score at least 3 (extension match)
```

---

#### Issue 3: Poor Output Quality

**Solutions:**

1. **Add specific examples to SYSTEM.hbs:**
```handlebars
**Example conversion:**

Input:
```
[example input]
```

Expected output:
```
[example output]
```

Now convert the following:
```

2. **Use guidance:**
```bash
charm transmogrify --guide my-guide --to output \
  --guidance "Focus on X, ignore Y, format Z as A" \
  input.ext
```

3. **Upgrade to compiler mode:**
If interpreter produces inconsistent results, switch to compiler for more control.

---

#### Issue 4: Generated Code Fails

**Symptoms (compiler guides):**
```
[ERROR] Compiler script exited with code 1
```

**Solutions:**

1. **Test helpers independently:**
```python
# test_helpers.py
from helpers import read_stdin, write_output

data = read_stdin()
print(f"Read {len(data)} bytes")
```

2. **Add error handling instructions:**
```handlebars
**Error handling:**
- Wrap main logic in try/except
- Print errors to stderr
- Exit with code 1 on failure
- Use sys.exit(1) for errors
```

3. **Simplify generated code:**
```handlebars
Generate simple, straightforward code. Avoid complex abstractions.
Use standard library functions when possible.
```

---

## Best Practices

### System Prompt Design

**Be explicit about I/O:**
```handlebars
✅ "Read input from STDIN. Write output to file path in sys.argv[1]."
❌ "Process the input and produce output."
```

**Specify output format precisely:**
```handlebars
✅ "Output valid JSON with these exact fields: id (integer), name (string), date (ISO-8601 string)."
❌ "Output JSON."
```

**Include error handling:**
```handlebars
✅ "Handle malformed input gracefully. If parsing fails, print error to stderr and exit with code 1."
❌ [no mention of errors]
```

**Use guidance effectively:**
```handlebars
✅ {{#if guidance}}
   **User guidance:** {{guidance}}
   Apply this guidance to customize the conversion.
   {{/if}}
❌ [ignoring guidance variable]
```

---

### Format Specifications

**Be inclusive:**
```json
✅ ["csv", "text/csv", "text/comma-separated-values"]
❌ ["csv"]
```

**Use variants for specialization:**
```json
✅ ["text/markdown; variant=Obsidian"]  # Specific to Obsidian
❌ ["text/markdown"]  # Too generic
```

**Match MIME types accurately:**
```json
✅ ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"]
❌ ["application/powerpoint", "pptx"]  # Wrong MIME type
```

---

### Helper Functions

**Keep them pure and reusable:**
```python
✅ def parse_date(date_str, format='%Y-%m-%d'):
     """Parse date string to datetime object."""
     ...

❌ def parse_dates_and_process_entire_file():
     # Too much in one function
     ...
```

**Document parameters and return values:**
```python
✅ def convert_units(value, from_unit, to_unit):
     """
     Convert value between units.

     Args:
         value (float): Numeric value to convert
         from_unit (str): Source unit ('m', 'ft', 'km')
         to_unit (str): Target unit ('m', 'ft', 'km')

     Returns:
         float: Converted value

     Raises:
         ValueError: If units are invalid
     """
     ...
```

**Handle errors gracefully:**
```python
✅ def parse_json(text):
     try:
         return json.loads(text)
     except json.JSONDecodeError as e:
         print(f"JSON parse error: {e}", file=sys.stderr)
         sys.exit(1)
```

---

### Description Files

**Include keywords for matching:**
```markdown
✅ # Obsidian Markdown Guide

   Converts standard markdown to Obsidian-flavored markdown with wiki links.

   Keywords: obsidian, vault, wiki-link, knowledge base

❌ # Markdown Guide

   Converts markdown.
```

**Provide examples:**
```markdown
✅ ## Example

   Input:
   ```
   [Link](./file.md)
   ```

   Output:
   ```
   [[file]]
   ```

❌ [no examples]
```

---

## Publishing and Sharing Guides

### Organize Guides

**For personal use:**
```bash
# Keep in local guides directory
/path/to/charm-cli/guides/my-guide/
```

**For team use:**
```bash
# Use custom guides directory
export CHARM_GUIDES_DIR=/opt/company-guides
charm transmogrify --guides-dir /opt/company-guides --to output input.ext
```

**For community:**
- Create repository with guide directories
- Document installation process
- Provide examples and tests

---

### Guide Repository Structure

```
my-guides-repo/
├── README.md                 # Overview and installation
├── guides/
│   ├── guide-1/
│   │   ├── type.json
│   │   ├── inputs.json
│   │   ├── outputs.json
│   │   ├── SYSTEM.hbs
│   │   ├── description.md
│   │   ├── helpers.py
│   │   └── README.md          # Guide-specific docs
│   │
│   └── guide-2/
│       └── ...
│
├── examples/                  # Example conversions
│   ├── guide-1-example/
│   │   ├── input.ext
│   │   ├── expected-output.ext
│   │   └── run.sh
│   │
│   └── guide-2-example/
│       └── ...
│
└── tests/                     # Automated tests
    └── test_guides.sh
```

---

### Installation Instructions

**README.md example:**
```markdown
# My Custom Guides

## Installation

```bash
# Clone repository
git clone https://github.com/user/my-guides.git

# Copy guides to charm-cli
cp -r my-guides/guides/* /path/to/charm-cli/guides/

# Or use custom directory
export CHARM_GUIDES_DIR=/path/to/my-guides/guides
```

## Usage

```bash
# List available guides
ls /path/to/my-guides/guides/

# Use a guide
charm transmogrify --guide my-guide-1 --to output input.ext
```
```

---

## Next Steps

- **Test your guide:** [Examples](./07-examples.md)
- **Understand routing:** [Routing System](./04-routing-system.md)
- **Learn formats:** [Format Specifications](./06-format-specifications.md)
- **See API details:** [API Integration](./09-api-integration.md)
