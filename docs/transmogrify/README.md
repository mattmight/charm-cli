# Charm Transmogrify Documentation

Welcome to the comprehensive documentation for `charm transmogrify`, a powerful file format conversion system that intelligently routes conversions through multiple pathways to provide the best results.

## Table of Contents

1. [Overview](./01-overview.md) - Introduction and key concepts
2. [Quick Start](./02-quick-start.md) - Get started in 5 minutes
3. [Command Reference](./03-command-reference.md) - Complete flag and option documentation
4. [Routing System](./04-routing-system.md) - How transmogrify decides which conversion method to use
5. [Guide System](./05-guide-system.md) - Understanding and creating guides
6. [Format Specifications](./06-format-specifications.md) - How to specify input/output formats
7. [Examples](./07-examples.md) - Real-world usage examples
8. [Guide Development](./08-guide-development.md) - Creating custom guides
9. [API Integration](./09-api-integration.md) - How transmogrify integrates with Charmonator
10. [Troubleshooting](./10-troubleshooting.md) - Common issues and solutions

## Quick Links

### For Users

- **New to transmogrify?** Start with [Overview](./01-overview.md)
- **Want to try it now?** See [Quick Start](./02-quick-start.md)
- **Looking for specific usage?** Check [Examples](./07-examples.md)
- **Having issues?** See [Troubleshooting](./10-troubleshooting.md)

### For Developers

- **Want to create a guide?** Read [Guide Development](./08-guide-development.md)
- **Understanding the internals?** See [Guide System](./05-guide-system.md) and [Routing System](./04-routing-system.md)
- **API integration details?** Check [API Integration](./09-api-integration.md)

## What is Transmogrify?

`charm transmogrify` is an intelligent file format conversion system that:

- **Automatically routes** conversions to the best available method
- **Uses AI** to generate conversion code when needed
- **Supports schemas** for validated output
- **Handles complex transformations** like PDF → PowerPoint or CSV → typed JSON
- **Provides safety** through sandboxing and confirmation prompts
- **Extensible** via the guide system

## Key Features

### Intelligent Routing

Transmogrify automatically determines the best conversion pathway:

1. **Built-in conversions** (docx→md, pptx→md) via `charm convert`
2. **Native endpoints** (pdf→md) via Charmonizer image processing
3. **Specialized guides** (md→pptx for oncology) for domain-specific needs
4. **Generic guides** (any→any) as fallback using AI code generation

### Format Flexibility

- Support for **file extensions** (`.md`, `.pdf`, `.json`)
- Support for **MIME types** (`text/markdown`, `application/pdf`)
- Support for **format variants** (`text/markdown; variant=GFM`)
- Support for **custom descriptions** for precise format specification

### Safety & Validation

- **Dry-run mode** to preview routing decisions
- **Confirmation prompts** before executing generated code
- **Sandboxed execution** for compiler-based conversions
- **JSON schema validation** for structured outputs
- **Timeout controls** to prevent runaway processes

### Guidance System

Provide natural language instructions to customize conversions:

```bash
charm transmogrify --guidance "Focus on clinical data and de-identify PHI" input.md --to pptx
```

## Architecture

```
charm transmogrify input.pdf --to md
         │
         ├─► Parse formats (pdf, md)
         │
         ├─► Route Selection:
         │   ├─► Check charm convert (docx→md, pptx→md)
         │   ├─► Check native endpoints (pdf→md)
         │   └─► Check guides (domain-specific or generic)
         │
         ├─► Execute conversion:
         │   ├─► Direct API call (pdf→md)
         │   ├─► Interpreter (model produces output)
         │   └─► Compiler (generate & run Python code)
         │
         └─► Write output with validation
```

## Common Use Cases

1. **Medical Records**: PDF medical records → Markdown for analysis
2. **Presentations**: Markdown cancer cases → PowerPoint for tumor boards
3. **Data Migration**: CSV → validated JSON with type conversion
4. **Format Conversion**: GitHub markdown → Obsidian markdown
5. **Document Processing**: Any complex format transformation

## Philosophy

Transmogrify is designed around these principles:

1. **Intelligence**: Automatically select the best conversion method
2. **Flexibility**: Support any format combination through guides
3. **Safety**: Sandbox generated code, validate outputs
4. **Usability**: Simple CLI with powerful options
5. **Extensibility**: Easy to add new guides for specialized domains

## Getting Started

1. Read the [Overview](./01-overview.md) to understand the system
2. Follow the [Quick Start](./02-quick-start.md) to try your first conversion
3. Explore [Examples](./07-examples.md) for real-world usage patterns
4. Consult [Command Reference](./03-command-reference.md) for detailed flag documentation

## Contributing

To add support for new format conversions:

1. Create a guide in `guides/<guide-name>/`
2. Follow the [Guide Development](./08-guide-development.md) documentation
3. Test with dry-run mode first
4. Add examples to demonstrate usage

## Support

- **Documentation**: This directory
- **Examples**: `examples/transmogrify/`
- **Issues**: GitHub issues
- **Source**: `bin/commands/transmogrify.mjs`

---

*This documentation covers charm-cli transmogrify as implemented in 2025.*
