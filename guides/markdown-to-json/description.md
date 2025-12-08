# Markdown to JSON Guide

Generic interpreter guide for converting markdown documents to structured JSON with optional schema validation. Uses direct AI transformation for fast, reliable conversion.

## Features

- Extracts structured data from markdown text
- Schema-aware conversion (uses JSON Schema if provided)
- FHIR-compatible (supports FHIR R4 Bundle generation)
- Validates output against schema
- Handles complex nested structures
- Parses markdown sections, lists, and key-value pairs

## Best For

- Converting markdown medical records to FHIR JSON
- Extracting structured data from documentation
- Creating validated JSON from markdown notes
- FHIR resource creation (Patient, Encounter, Procedure, etc.)
- Medical record structuring and standardization

## How It Works

1. **Parses markdown** - Extracts sections, lists, and structured content
2. **Maps to schema** - Uses JSON Schema to guide structure creation
3. **Creates resources** - Generates FHIR resources if FHIR schema detected
4. **Validates** - Ensures all required fields are present
5. **Outputs JSON** - Writes formatted, validated JSON

## Schema Support

When provided with a JSON Schema via `--output-schema-file`:
- Identifies required fields and ensures they're present
- Follows exact structure defined in schema
- Uses correct data types
- Creates nested objects and arrays as specified
- For FHIR: Creates proper Bundle with appropriate resources

## FHIR Support

Automatically detects FHIR schemas and generates:
- FHIR Bundle (resourceType: "Bundle")
- Patient resources with demographics
- Encounter resources for visits
- Procedure resources for treatments
- Device, Specimen, BiologicallyDerivedProduct resources
- Proper references between resources
- Valid FHIR resource IDs

## Example Usage

### Basic Markdown to JSON

```bash
charm transmogrify --to json \
  --guidance "Extract patient information and procedures" \
  medical-notes.md
```

### With Schema Validation

```bash
charm transmogrify --to json \
  --output-schema-file patient-schema.json \
  --guidance "Create FHIR Bundle with Patient and Encounter" \
  medical-record.md
```

### FHIR Conversion

```bash
charm transmogrify --to json \
  --output-schema-file fhir-bundle-schema.json \
  --guidance "Extract: patient demographics, encounter details, procedures performed" \
  clinical-note.md
```

## Output Format

### Simple JSON
```json
{
  "patient": {
    "name": "Patient Name",
    "age": 45,
    "diagnosis": "..."
  },
  "procedures": [...]
}
```

### FHIR Bundle
```json
{
  "resourceType": "Bundle",
  "type": "collection",
  "entry": [
    {
      "resource": {
        "resourceType": "Patient",
        "id": "patient-1",
        "name": [{"family": "Doe", "given": ["John"]}],
        ...
      }
    },
    {
      "resource": {
        "resourceType": "Encounter",
        "id": "encounter-1",
        "subject": {"reference": "Patient/patient-1"},
        ...
      }
    },
    ...
  ]
}
```

## Helper Functions Available

The guide provides helper functions for common operations:
- `extract_sections(markdown_text)` - Parse markdown by headings
- `parse_markdown_list(text)` - Extract list items
- `parse_key_value_pairs(text)` - Parse "Key: Value" format
- `generate_fhir_id(prefix)` - Create valid FHIR IDs
- `create_fhir_reference(type, id)` - Create FHIR references
- `create_codeable_concept(text, ...)` - Create CodeableConcept

## Keywords

markdown, json, fhir, medical records, structured data, schema validation, healthcare, ehr, clinical notes, patient records, medical documentation, interoperability
