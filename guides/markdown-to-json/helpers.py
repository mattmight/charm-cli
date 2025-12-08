#!/usr/bin/env python3
"""
Helper functions for markdown to JSON conversion.
"""

import sys
import json
import re


def read_stdin():
    """Read all input from stdin."""
    return sys.stdin.read()


def write_json(filepath, data):
    """Write data as formatted JSON with proper indentation."""
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error writing JSON: {e}", file=sys.stderr)
        sys.exit(1)


def validate_required_fields(data, required_fields):
    """
    Check if all required fields are present in data.

    Args:
        data: Dictionary to validate
        required_fields: List of required field names

    Returns:
        List of missing field names (empty if all present)
    """
    missing = []
    for field in required_fields:
        if field not in data or data[field] is None:
            missing.append(field)
    return missing


def extract_sections(markdown_text):
    """
    Extract sections from markdown by heading level.

    Returns dict mapping heading text to content.
    """
    sections = {}
    current_heading = None
    current_content = []

    for line in markdown_text.split('\n'):
        # Check for markdown heading
        heading_match = re.match(r'^#+\s+(.+)$', line.strip())
        if heading_match:
            # Save previous section
            if current_heading:
                sections[current_heading] = '\n'.join(current_content).strip()
            # Start new section
            current_heading = heading_match.group(1)
            current_content = []
        else:
            current_content.append(line)

    # Save last section
    if current_heading:
        sections[current_heading] = '\n'.join(current_content).strip()

    return sections


def parse_markdown_list(text):
    """
    Extract list items from markdown text.

    Returns list of strings.
    """
    items = []
    for line in text.split('\n'):
        # Match markdown list items (-, *, +, or numbered)
        match = re.match(r'^[\s]*[-*+•][\s]+(.+)$', line.strip())
        if match:
            items.append(match.group(1).strip())
        else:
            # Try numbered list
            match = re.match(r'^[\s]*\d+\.[\s]+(.+)$', line.strip())
            if match:
                items.append(match.group(1).strip())
    return items


def parse_key_value_pairs(text):
    """
    Extract key-value pairs from text like "Key: Value".

    Returns dict.
    """
    pairs = {}
    for line in text.split('\n'):
        match = re.match(r'^([^:]+):\s*(.+)$', line.strip())
        if match:
            key = match.group(1).strip()
            value = match.group(2).strip()
            pairs[key] = value
    return pairs


def generate_fhir_id(prefix='resource'):
    """
    Generate a valid FHIR resource ID.

    FHIR IDs must be 1-64 characters, alphanumeric with - and .
    """
    import random
    import string
    suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"{prefix}-{suffix}"


def create_fhir_reference(resource_type, resource_id):
    """
    Create a FHIR reference object.

    Args:
        resource_type: Type of resource (e.g., "Patient", "Encounter")
        resource_id: ID of the resource

    Returns:
        Reference object dict
    """
    return {
        "reference": f"{resource_type}/{resource_id}"
    }


def create_codeable_concept(text, system=None, code=None, display=None):
    """
    Create a FHIR CodeableConcept.

    Args:
        text: Human-readable text
        system: Coding system URI (optional)
        code: Code value (optional)
        display: Display text for code (optional)

    Returns:
        CodeableConcept dict
    """
    concept = {"text": text}

    if system and code:
        concept["coding"] = [{
            "system": system,
            "code": code
        }]
        if display:
            concept["coding"][0]["display"] = display

    return concept
