# Generic Compiler Guide

Universal fallback compiler that attempts any-to-any transformation by generating a Python program to perform the conversion. This guide writes programs that do "the right thing" for format conversions.

## Features

- Generates Python programs for arbitrary format conversions
- Handles programming language translation (Python → JavaScript, etc.)
- Converts data formats (CSV → Excel, JSON → XML, etc.)
- Transforms markup languages (Markdown → HTML, etc.)
- Converts configuration files (.ini → .yaml, etc.)
- Performs data restructuring and transpilation
- Works with stdin/stdout for pipeline compatibility

## Best For

- **Programming language translation:** Python to JavaScript, Ruby to Go, etc.
- **Data format conversion:** CSV to Excel, JSON to XML, YAML to TOML
- **Markup transformation:** Markdown to HTML, LaTeX to other formats
- **Configuration conversion:** .ini to .yaml, .env to JSON
- **Code transpilation:** TypeScript to JavaScript, CoffeeScript to JavaScript
- **Data restructuring:** Nested JSON to flat CSV, wide to long format
- **Any format not covered by specialized guides**

## How It Works

1. **Analyzes formats** - Understands both input and output format requirements
2. **Generates Python program** - Creates a `compile.py` script that performs the conversion
3. **Reads from stdin** - Program accepts input data via standard input
4. **Writes to file** - Outputs converted data to specified file path
5. **Handles errors gracefully** - Provides informative error messages for missing dependencies

## Conversion Philosophy

The guide generates programs that do what a "reasonable person" would expect:
- Preserves semantic meaning of the input
- Uses idiomatic patterns for the target format
- Handles edge cases gracefully
- Maintains data integrity and structure
- Uses appropriate libraries when needed (openpyxl, PyYAML, etc.)

## Example Conversions

### Programming Language Translation

```bash
charm transmogrify --to js script.py
# Generates Python program that translates Python to JavaScript
```

### Data Format Conversion

```bash
charm transmogrify --to xlsx data.csv
# Generates program to convert CSV to Excel with proper formatting
```

### Markup Transformation

```bash
charm transmogrify --to html document.md
# Generates program to convert Markdown to HTML
```

### Configuration Conversion

```bash
charm transmogrify --to yaml config.ini
# Generates program to convert .ini file to YAML format
```

## Generated Program Structure

The generated `compile.py` follows this pattern:

```python
#!/usr/bin/env python3
import sys

def main():
    if len(sys.argv) < 2:
        print("Usage: python compile.py <output_file>", file=sys.stderr)
        sys.exit(2)

    output_path = sys.argv[1]

    # Read input from stdin
    input_data = sys.stdin.read()

    # Perform transformation
    # ... conversion logic here ...

    # Write output
    with open(output_path, 'w') as f:
        f.write(output_data)

if __name__ == '__main__':
    main()
```

## Dependencies

Generated programs may use:
- Python 3.8+ standard library
- Widely-available packages (openpyxl, PyYAML, etc.)
- No automatic package installation
- Informative error messages for missing dependencies

## Safety Features

- No network calls
- Only writes to specified output file
- Only reads from stdin
- Sandboxed execution environment
- Graceful error handling

## Keywords

compiler, transpiler, format conversion, language translation, python to javascript, csv to excel, json to xml, yaml, code generation, data transformation, programming languages, data formats, markup, configuration files
