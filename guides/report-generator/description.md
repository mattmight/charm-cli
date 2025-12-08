# Report Generator Guide

Generic interpreter guide for converting JSON data to beautiful, easy-to-read HTML reports. Uses direct AI transformation for fast, reliable HTML generation.

## Features

- Creates professional, visually appealing HTML reports
- Self-contained HTML with embedded CSS (no external dependencies)
- Responsive design that works on desktop and mobile
- Intelligent data organization and presentation
- Color-coded sections for easy navigation
- Support for complex nested JSON structures
- Schema-aware conversion for better data understanding

## Best For

- Converting FHIR JSON to patient-friendly reports
- Generating summary views of structured data
- Creating printable documentation from JSON
- Visualizing API responses
- Healthcare records visualization
- Data validation and review reports

## How It Works

1. **Analyzes JSON** - Understands the structure and content
2. **Identifies key entities** - Finds people, dates, events, procedures
3. **Organizes logically** - Groups related information together
4. **Generates HTML** - Creates beautiful, semantic HTML with embedded CSS
5. **Optimizes presentation** - Uses tables, lists, and sections appropriately

## Schema Support

When provided with an input JSON Schema via `--input-schema-file`:
- Uses schema to understand data semantics
- Presents information according to schema structure
- Uses schema descriptions and titles for better labeling
- Identifies required vs optional fields
- Recognizes special data types (dates, emails, etc.)

For FHIR schemas:
- Recognizes FHIR resource types
- Uses appropriate medical terminology
- Groups resources logically (Patient, Encounter, Procedure, etc.)
- Highlights clinical significance

## Example Usage

### Basic JSON to HTML

```bash
charm transmogrify --to html \
  --guidance "Create a summary report" \
  data.json
```

### With Schema Context

```bash
charm transmogrify --to html \
  --input-schema-file schema.json \
  --guidance "Highlight key patient information" \
  patient-data.json
```

### FHIR Bundle to HTML Report

```bash
charm transmogrify --to html \
  --input-schema-file fhir-bundle-schema.json \
  --guidance "Create patient-friendly medical report" \
  medical-record.json
```

## Output Format

Generates a complete, self-contained HTML document with:
- Semantic HTML5 structure
- Embedded CSS (no external dependencies)
- Professional styling with clean typography
- Color-coded sections for visual hierarchy
- Tables, lists, and sections for organized data
- Responsive layout
- Print-friendly design

Example structure:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Data Report</title>
  <style>
    /* Embedded professional CSS */
  </style>
</head>
<body>
  <header>
    <h1>Report Title</h1>
  </header>
  <main>
    <section class="summary">
      <!-- Overview -->
    </section>
    <section class="details">
      <!-- Detailed information -->
    </section>
  </main>
</body>
</html>
```

## Keywords

json, html, report, visualization, fhir, medical reports, data presentation, healthcare, ehr, patient reports, summary generation, data analysis, interactive reports
