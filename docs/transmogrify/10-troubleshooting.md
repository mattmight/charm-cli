# Troubleshooting

Common issues and solutions for charm transmogrify.

## Quick Diagnostics

### Run These First

```bash
# 1. Verify charm is installed
charm help

# 2. Check server connection
charm list

# 3. Test transmogrify with dry-run
charm transmogrify --dry-run --to md test.pdf

# 4. Check Python version (for compiler guides)
python3 --version  # Should be 3.8+

# 5. Check required packages
python3 -c "import pptx; print('python-pptx: OK')" 2>&1
```

---

## Common Issues

### Issue 1: Command Not Found

**Symptoms:**
```bash
$ charm transmogrify --to md input.pdf
bash: charm: command not found
```

**Solutions:**

**1. Verify installation:**
```bash
# Check if charm binary exists
ls -la /path/to/charm-cli/bin/charm

# Make executable
chmod +x /path/to/charm-cli/bin/charm
```

**2. Add to PATH:**
```bash
# Temporary (current session)
export PATH="/path/to/charm-cli/bin:$PATH"

# Permanent (add to ~/.bashrc or ~/.zshrc)
echo 'export PATH="/path/to/charm-cli/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

**3. Use full path:**
```bash
/path/to/charm-cli/bin/charm transmogrify --to md input.pdf
```

---

### Issue 2: Server Connection Failed

**Symptoms:**
```
[ERROR] Charmonator API call failed: connect ECONNREFUSED
[ERROR] Failed to connect to localhost:5002
```

**Solutions:**

**1. Check if server is running:**
```bash
# Test connection
curl http://localhost:5002/api/charmonator/transcript/extension

# Or use charm list
charm list
```

**2. Start Charmonator server:**
```bash
# (Command depends on your setup)
cd /path/to/charmonator
./start-server.sh

# Or use docker
docker start charmonator
```

**3. Check hostname/port:**
```bash
# Use custom server
charm --hostname api.example.com --port 8080 transmogrify --to md input.pdf

# Or set environment variables
export CHARM_HOSTNAME=api.example.com
export CHARM_PORT=8080
charm transmogrify --to md input.pdf
```

**4. Check firewall:**
```bash
# Test if port is accessible
nc -zv localhost 5002

# Or
telnet localhost 5002
```

---

### Issue 3: No Suitable Guide Found

**Symptoms:**
```
[ERROR] No suitable guide found for conversion: xyz → json
[ERROR] Even generic-compiler is not available
```

**Solutions:**

**1. Check guides directory:**
```bash
# List guides
ls -la guides/

# Should show at least: generic-compiler/
```

**2. Verify generic-compiler exists:**
```bash
ls -la guides/generic-compiler/
# Should show: type.json, inputs.json, outputs.json, SYSTEM.hbs, description.md
```

**3. Use custom guides directory:**
```bash
charm transmogrify --guides-dir /path/to/guides --to json input.xyz
```

**4. Force generic-compiler:**
```bash
charm transmogrify --guide generic-compiler --to json input.xyz
```

---

### Issue 4: Guide Not Loading

**Symptoms:**
```
[WARN] Failed to load guide my-guide: SyntaxError: Unexpected token c in JSON
```

**Solutions:**

**1. Check JSON syntax:**
```bash
# Validate JSON files
python3 -m json.tool guides/my-guide/type.json
python3 -m json.tool guides/my-guide/inputs.json
python3 -m json.tool guides/my-guide/outputs.json
```

**2. Common mistakes in type.json:**
```bash
# Wrong (unquoted):
compiler

# Correct (quoted):
"compiler"
```

**3. Check file permissions:**
```bash
chmod 644 guides/my-guide/*.json
chmod 644 guides/my-guide/*.hbs
chmod 644 guides/my-guide/*.md
```

**4. Verify required files exist:**
```bash
ls guides/my-guide/
# Must have: type.json, inputs.json, outputs.json, SYSTEM.hbs, description.md
```

---

### Issue 5: python-pptx Not Found

**Symptoms:**
```
[ERROR] Compiler script exited with code 1
ModuleNotFoundError: No module named 'pptx'
```

**Solutions:**

**1. Install python-pptx:**
```bash
pip install python-pptx

# Or with pip3
pip3 install python-pptx

# Verify installation
python3 -c "import pptx; print('OK')"
```

**2. Install in correct Python environment:**
```bash
# Check which python transmogrify uses
which python3

# Install for that Python
/usr/bin/python3 -m pip install python-pptx
```

**3. Use virtual environment:**
```bash
# Create venv
python3 -m venv venv
source venv/bin/activate

# Install packages
pip install python-pptx

# Run transmogrify
charm transmogrify --to pptx input.md
```

---

### Issue 6: Compiler Script Failed

**Symptoms:**
```
[ERROR] Compiler script exited with code 1
[ERROR] See output above for details
```

**Solutions:**

**1. Keep sandbox for inspection:**
```bash
charm transmogrify --keep-sandbox --to json input.csv
```

**2. Inspect generated code:**
```bash
# Sandbox location shown in output
cat /tmp/charm-transmog-XXXXX/compile.py
```

**3. Test code manually:**
```bash
cd /tmp/charm-transmog-XXXXX
python3 compile.py output.json < input.txt
```

**4. Check for common issues:**
- Missing imports
- Incorrect stdin/stdout handling
- Wrong output file path
- Unhandled exceptions

**5. Add error handling to prompt:**

Edit guide's SYSTEM.hbs:
```handlebars
**Error handling:**
- Wrap main logic in try/except
- Print errors to stderr: print(error, file=sys.stderr)
- Exit with code 1 on failure: sys.exit(1)
```

---

### Issue 7: Timeout During PDF Conversion

**Symptoms:**
```
[ERROR] PDF conversion timed out after 120 seconds
```

**Solutions:**

**1. Large PDFs take longer:**
- 1-5 pages: 30-60 seconds
- 5-10 pages: 1-3 minutes
- 10+ pages: 3-10 minutes

**2. Be patient:**
```bash
# Progress is shown
[INFO] Progress: 5/50 pages (processing)
```

**3. Check server load:**
```bash
# Server may be processing other requests
# Wait and try again later
```

**4. Split large PDFs:**
```bash
# Use pdftk or similar to split
pdftk large.pdf cat 1-10 output part1.pdf
pdftk large.pdf cat 11-20 output part2.pdf

# Convert parts separately
charm transmogrify --to md part1.pdf
charm transmogrify --to md part2.pdf
```

---

### Issue 8: Poor Quality Output

**Symptoms:**
- Missing information
- Incorrect format
- Hallucinated content
- Incomplete conversion

**Solutions:**

**1. Add specific guidance:**
```bash
charm transmogrify --to json \
  --guidance "Extract: patient ID, age, diagnosis, medications. Use null for missing fields." \
  input.md
```

**2. Use schema for validation:**
```bash
charm transmogrify --to json \
  --output-schema-file schema.json \
  input.csv
```

**3. Use specialized guide:**
```bash
# Instead of generic-compiler
charm transmogrify --guide oncology-pptx --to pptx case.md
```

**4. Try different model:**
```bash
charm --model gpt-4o transmogrify --to json input.csv
```

**5. Improve system prompt:**

For custom guides, edit SYSTEM.hbs to be more specific:

```handlebars
**Requirements:**
- Extract exactly these fields: X, Y, Z
- Use ISO-8601 for dates
- Use null (not empty string) for missing values
- Validate all required fields before output
- Include error messages for invalid data

**Example:**
Input: ...
Output: ...
```

---

### Issue 9: File Format Not Recognized

**Symptoms:**
```
[ERROR] Unknown format: xyz
[ERROR] Cannot determine MIME type for extension: xyz
```

**Solutions:**

**1. Explicitly specify format:**
```bash
charm transmogrify --from text/plain --to json data.xyz
```

**2. Use format file:**
```bash
echo "text/plain" > format.txt
charm transmogrify --from-file format.txt --to json data.xyz
```

**3. Rename file:**
```bash
mv data.xyz data.txt
charm transmogrify --to json data.txt
```

**4. Add description:**
```bash
cat > format.txt <<'EOF'
text/plain

Custom text format with:
- Tab-delimited fields
- No header row
- UTF-8 encoding
EOF

charm transmogrify --from-file format.txt --to json data.xyz
```

---

### Issue 10: Permission Denied

**Symptoms:**
```
[ERROR] EACCES: permission denied, open 'output.md'
```

**Solutions:**

**1. Check output directory permissions:**
```bash
ls -ld /path/to/output/directory
# Should be writable

chmod 755 /path/to/output/directory
```

**2. Check existing file permissions:**
```bash
ls -l output.md
# If exists and not writable

chmod 644 output.md
```

**3. Use different output location:**
```bash
charm transmogrify --to md --output ~/Desktop/output.md input.pdf
```

**4. Check disk space:**
```bash
df -h .
```

---

### Issue 11: Dry-Run Shows Wrong Route

**Symptoms:**
```
[DRY RUN MODE]
Route: generic-compiler (compiler)
# Expected: specialized guide
```

**Solutions:**

**1. Check guide format specifications:**
```bash
cat guides/my-guide/inputs.json
cat guides/my-guide/outputs.json
# Ensure they match your input/output formats
```

**2. Add more format specs:**
```json
// Before
["md"]

// After (better matching)
["md", "markdown", "text/markdown"]
```

**3. Use explicit format:**
```bash
charm transmogrify --dry-run \
  --from "text/markdown" \
  --to "application/vnd.openxmlformats-officedocument.presentationml.presentation" \
  input.md
```

**4. Force guide for testing:**
```bash
charm transmogrify --guide my-guide --to pptx input.md
```

---

### Issue 12: JSON Validation Failed

**Symptoms:**
```
[WARN] JSON output does not match schema
[WARN] Missing required field: patient_id
```

**Solutions:**

**1. Check schema is correct:**
```bash
cat schema.json | python3 -m json.tool
```

**2. Update guidance to mention schema:**
```bash
charm transmogrify --to json \
  --output-schema-file schema.json \
  --guidance "Ensure all required fields from schema are present: patient_id, name, age" \
  input.csv
```

**3. Validation is non-fatal:**
```bash
# Output is still written despite validation warnings
ls output.json  # File exists

# Inspect output
cat output.json | python3 -m json.tool
```

**4. For compiler guides, use schema in code:**

The schema is passed to the AI model. Ensure SYSTEM.hbs mentions it:

```handlebars
{{#if output_schema}}
**IMPORTANT:** Validate output against this schema before writing:
```json
{{output_schema}}
```
{{/if}}
```

---

## Debugging Strategies

### Strategy 1: Incremental Testing

**Step 1: Test connectivity**
```bash
charm list
```

**Step 2: Test routing**
```bash
charm transmogrify --dry-run --to md input.pdf
```

**Step 3: Test actual conversion (small file)**
```bash
charm transmogrify --to md small-test.pdf
```

**Step 4: Test with target file**
```bash
charm transmogrify --to md actual-file.pdf
```

---

### Strategy 2: Verbose Output

**Enable debug logging:**

```bash
# Set environment variable
export DEBUG=1
charm transmogrify --to md input.pdf
```

**Add logging to guides:**

In SYSTEM.hbs:
```handlebars
**Debugging:**
- Print progress messages to stderr
- Include step-by-step comments in generated code
- Log all major decisions
```

---

### Strategy 3: Simplify and Isolate

**1. Remove guidance:**
```bash
# Without guidance
charm transmogrify --to json input.csv

# With guidance
charm transmogrify --to json --guidance "..." input.csv
```

**2. Use generic guide:**
```bash
# Force generic to see if issue is guide-specific
charm transmogrify --guide generic-compiler --to json input.csv
```

**3. Test with minimal input:**
```bash
# Create minimal test case
echo "test" > minimal.txt
charm transmogrify --to json minimal.txt
```

---

### Strategy 4: Inspect Intermediates

**For compiler guides:**

```bash
# Keep all intermediate files
charm transmogrify --keep-sandbox --to json input.csv

# Inspect sandbox
cd /tmp/charm-transmog-XXXXX
ls -la
# Shows: compile.py, helpers.py, input.txt, output.json

# Test generated code
python3 compile.py test-output.json < input.txt

# Check Python syntax
python3 -m py_compile compile.py
```

---

## Error Code Reference

| Exit Code | Constant | Meaning | Common Causes |
|-----------|----------|---------|---------------|
| 0 | SUCCESS | Conversion succeeded | - |
| 1 | INVALID_FLAGS | Invalid arguments | Missing --to, file not found, invalid flags |
| 3 | MODEL_FAILURE | Conversion failed | API error, timeout, validation failure, code execution error |

**Check exit code:**
```bash
charm transmogrify --to md input.pdf
echo $?  # 0 = success, non-zero = failure
```

**Use in scripts:**
```bash
if charm transmogrify --to json data.csv; then
  echo "Success"
  # Process output.json
else
  echo "Failed with code $?"
  exit 1
fi
```

---

## Platform-Specific Issues

### macOS

**Issue: Python command not found**
```bash
# Use python3 explicitly
which python3

# Or install via Homebrew
brew install python3
```

**Issue: SSL certificate errors**
```bash
# Install certificates
/Applications/Python\ 3.x/Install\ Certificates.command
```

---

### Linux

**Issue: Missing system dependencies**
```bash
# Ubuntu/Debian
sudo apt-get install python3 python3-pip

# Fedora/RHEL
sudo dnf install python3 python3-pip
```

---

### Windows (WSL)

**Issue: Path issues**
```bash
# Use Linux-style paths
charm transmogrify --to md /mnt/c/Users/name/document.pdf
```

**Issue: Line endings**
```bash
# Convert CRLF to LF
dos2unix /path/to/file.txt
```

---

## Getting Help

### Collect Diagnostic Information

Before asking for help, collect:

**1. Version information:**
```bash
charm --version
node --version
python3 --version
```

**2. Dry-run output:**
```bash
charm transmogrify --dry-run --to <format> input.ext > dry-run.txt 2>&1
```

**3. Full error output:**
```bash
charm transmogrify --to <format> input.ext > output.log 2>&1
```

**4. Guide information:**
```bash
ls -la guides/
cat guides/my-guide/type.json
cat guides/my-guide/inputs.json
cat guides/my-guide/outputs.json
```

**5. Generated code (if compiler):**
```bash
charm transmogrify --keep-sandbox --to <format> input.ext
tar -czf sandbox.tar.gz /tmp/charm-transmog-XXXXX/
```

---

### Where to Get Help

1. **Documentation:**
   - [Overview](./01-overview.md)
   - [Quick Start](./02-quick-start.md)
   - [Command Reference](./03-command-reference.md)
   - [Examples](./07-examples.md)

2. **Community:**
   - GitHub Issues: https://github.com/your-repo/charm-cli/issues
   - Discussions: https://github.com/your-repo/charm-cli/discussions

3. **Examples:**
   - Working examples in `examples/transmogrify/`
   - Run examples to verify setup:
     ```bash
     cd examples/transmogrify/oncology-pptx
     ./run.sh
     ```

---

## Prevention Tips

### Before Running Conversions

**1. Test with dry-run:**
```bash
charm transmogrify --dry-run --to <format> input.ext
```

**2. Verify server is running:**
```bash
charm list
```

**3. Check required packages:**
```bash
python3 -c "import pptx; print('python-pptx: OK')"
```

**4. Use --keep-sandbox for first run:**
```bash
charm transmogrify --keep-sandbox --to json input.csv
```

---

### Best Practices

**1. Start small:**
```bash
# Test with small file first
charm transmogrify --to md small-test.pdf

# Then scale up
charm transmogrify --to md large-document.pdf
```

**2. Use guidance:**
```bash
# Be specific about what you want
charm transmogrify --to json \
  --guidance "Extract only: field1, field2, field3" \
  input.csv
```

**3. Validate output:**
```bash
# For JSON, use schema
charm transmogrify --to json \
  --output-schema-file schema.json \
  input.csv

# Manually verify
cat output.json | python3 -m json.tool
```

**4. Keep backups:**
```bash
# Transmogrify doesn't modify input files
# But keep backups of important data anyway
cp input.pdf input.pdf.backup
```

---

## Known Limitations

### Current Limitations

1. **No streaming output** - Must wait for complete conversion
2. **No resume capability** - Failed conversions must restart from beginning
3. **No progress for interpreter guides** - Only PDF conversion shows progress
4. **No parallel batch processing** - Process one file at a time
5. **Python-only compiler guides** - No support for other languages

### Workarounds

**Batch processing:**
```bash
# Use bash loop
for file in *.csv; do
  charm transmogrify --yes --to json "$file"
done
```

**Large file handling:**
```bash
# Split large PDFs
pdftk large.pdf burst

# Convert parts
for page in pg_*.pdf; do
  charm transmogrify --to md "$page"
done

# Combine results
cat pg_*.md > combined.md
```

---

## Advanced Troubleshooting

### Network Debugging

**Use curl to test API:**
```bash
curl -X POST http://localhost:5002/api/charmonator/transcript/extension \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [{"role": "user", "content": "Hello"}]
  }' | jq .
```

**Check network path:**
```bash
traceroute api.example.com
ping api.example.com
```

---

### Memory Issues

**Symptoms:**
```
[ERROR] JavaScript heap out of memory
```

**Solutions:**
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
charm transmogrify --to md large.pdf
```

---

### Disk Space Issues

**Check available space:**
```bash
df -h /tmp  # Sandbox directory
df -h .     # Current directory
```

**Clean up temp files:**
```bash
# Remove old sandbox directories
rm -rf /tmp/charm-transmog-*

# Set to auto-cleanup
# (default behavior without --keep-sandbox)
```

---

## Next Steps

After resolving issues:

- **Learn more:** [Overview](./01-overview.md)
- **Try examples:** [Examples](./07-examples.md)
- **Create guides:** [Guide Development](./08-guide-development.md)
- **Read full docs:** [README](./README.md)

---

If you've tried everything here and still have issues, please file an issue on GitHub with:
- Dry-run output
- Full error logs
- Steps to reproduce
- Environment info (OS, Python version, Node version)
