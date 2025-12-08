"""
Generic helper utilities for file format conversions.
Can be imported by generated compile.py scripts.
"""

import sys
import json


def read_stdin_text():
    """Read all text from stdin."""
    return sys.stdin.read()


def read_stdin_binary():
    """Read all binary data from stdin."""
    return sys.stdin.buffer.read()


def write_output(filepath, content, mode='w'):
    """
    Write content to the output file.

    Args:
        filepath: Path to write to
        content: Content to write (str or bytes)
        mode: File mode ('w' for text, 'wb' for binary)
    """
    with open(filepath, mode) as f:
        f.write(content)


def safe_json_dumps(obj, **kwargs):
    """Safely dump object to JSON with default formatting."""
    return json.dumps(obj, indent=2, ensure_ascii=False, **kwargs)
