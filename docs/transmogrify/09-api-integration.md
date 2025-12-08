# API Integration

How charm transmogrify integrates with the Charmonator API for AI-powered conversions.

## Overview

Transmogrify uses the Charmonator API for:
1. **Interpreter guides** - Direct AI transformation
2. **Compiler guides** - AI code generation
3. **PDF conversion** - Native PDF processing endpoint

## API Endpoints Used

### 1. Transcript Extension (Interpreter & Compiler)

**Endpoint:** `/api/charmonator/transcript/extension`

**Method:** POST

**Content-Type:** `application/json`

**Use cases:**
- Interpreter guides (direct output)
- Compiler guides (code generation)

---

### 2. Document Conversion (PDF Processing)

**Endpoint:** `/api/charmonator/v1/conversions/documents`

**Method:** POST (multipart/form-data)

**Use cases:**
- PDF → Markdown conversion
- OCR + vision model processing

---

## Endpoint Details

### Transcript Extension Endpoint

#### Request Format

**Interpreter Guide Request:**

```javascript
{
  "model": "claude-3-5-sonnet-20241022",
  "messages": [
    {
      "role": "system",
      "content": "<rendered system prompt from SYSTEM.hbs>"
    },
    {
      "role": "user",
      "content": "<input file content>"
    }
  ]
}
```

**Compiler Guide Request:**

```javascript
{
  "model": "claude-3-5-sonnet-20241022",
  "messages": [
    {
      "role": "system",
      "content": "<rendered system prompt with code generation instructions>"
    },
    {
      "role": "user",
      "content": "Generate Python code to convert this input:\n\n<input file content>"
    }
  ]
}
```

---

#### Response Format

```javascript
{
  "messages": [
    {
      "role": "assistant",
      "content": "<AI response>"
    }
  ]
  // Additional fields may be present
}
```

**Important:** The response contains `messages` directly, not `transcript.messages`.

---

#### Code Example (Interpreter)

```javascript
import fetch from 'node-fetch';

async function callInterpreterGuide(baseUrl, model, systemPrompt, userInput) {
  const endpoint = `${baseUrl}/api/charmonator/transcript/extension`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const result = await response.json();
  const messages = result.messages || [];

  if (messages.length === 0) {
    throw new Error('No messages in response');
  }

  // Extract assistant's response
  const assistantMessage = messages.find(m => m.role === 'assistant');
  return assistantMessage.content;
}
```

---

#### Code Example (Compiler)

```javascript
async function callCompilerGuide(baseUrl, model, systemPrompt, userInput) {
  const endpoint = `${baseUrl}/api/charmonator/transcript/extension`;

  // Request code generation
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Generate Python code to perform this conversion:\n\n${userInput}`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const result = await response.json();
  const messages = result.messages || [];

  if (messages.length === 0) {
    throw new Error('No messages in response');
  }

  const assistantMessage = messages.find(m => m.role === 'assistant');
  const pythonCode = extractCodeBlock(assistantMessage.content);

  return pythonCode;
}

function extractCodeBlock(content) {
  // Extract code from ```python ... ``` blocks
  const match = content.match(/```(?:python)?\n([\s\S]*?)\n```/);
  if (match) {
    return match[1];
  }
  // If no code block, assume entire content is code
  return content;
}
```

---

### Document Conversion Endpoint

#### Request Format

**Method:** POST

**Content-Type:** `multipart/form-data`

**Form fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | PDF binary data |
| `model` | String | Yes | Model name (e.g., "claude-3-5-sonnet-20241022") |
| `description` | String | No | User guidance for conversion |
| `intent` | String | No | Intended use of conversion |
| `graphic_instructions` | String | No | Instructions for handling graphics |

**Medical Document Optimization:**

When guidance contains medical keywords (`medical`, `patient`, `clinical`), transmogrify automatically adds:

```javascript
formData.append('intent',
  'To come up with a diagnosis, a prognosis or a treatment option based on the content of the records.');

formData.append('graphic_instructions',
  'Clearly describe the contents of graphics, images and figures as it could relate to the diagnosis, prognosis or potential treatment of this patient.');
```

---

#### Response Format (Job Submission)

```javascript
{
  "job_id": "abc-123-def-456"
}
```

---

#### Polling Endpoint

**Endpoint:** `/api/charmonizer/v1/conversions/documents/{job_id}`

**Method:** GET

**Response:**

```javascript
{
  "status": "processing" | "complete" | "failed",
  "progress": {
    "current": 2,
    "total": 5
  }
  // Additional fields...
}
```

---

#### Result Endpoint

**Endpoint:** `/api/charmonator/v1/conversions/documents/{job_id}/result`

**Method:** GET

**Response:** doc.json format

```javascript
{
  "metadata": {
    "filename": "document.pdf",
    "sha256": "a1b2c3...",
    "size_bytes": 524288,
    "page_count": 5
  },
  "pages": [
    {
      "page_number": 1,
      "extraction_method": "ocr",
      "confidence": 0.88,
      "model": "openai:gpt-5",
      "content": "Page 1 text content..."
    },
    {
      "page_number": 2,
      "extraction_method": "vision",
      "confidence": 0.95,
      "model": "openai:gpt-5",
      "content": "Page 2 description..."
    }
    // ...more pages
  ]
}
```

---

#### Code Example (PDF Conversion)

```javascript
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';

async function convertPdfToMarkdown(baseUrl, model, pdfPath, guidance) {
  // Step 1: Submit job
  const formData = new FormData();
  formData.append('file', fs.createReadStream(pdfPath));
  formData.append('model', model);

  if (guidance) {
    formData.append('description', guidance);

    // Medical optimization
    if (/medical|patient|clinical/i.test(guidance)) {
      formData.append('intent',
        'To come up with a diagnosis, a prognosis or a treatment option...');
      formData.append('graphic_instructions',
        'Clearly describe the contents of graphics, images and figures...');
    }
  }

  const submitResponse = await fetch(
    `${baseUrl}/api/charmonator/v1/conversions/documents`,
    {
      method: 'POST',
      body: formData
    }
  );

  if (!submitResponse.ok) {
    throw new Error(`Job submission failed: ${submitResponse.statusText}`);
  }

  const { job_id } = await submitResponse.json();
  console.log(`[INFO] Job submitted: ${job_id}`);

  // Step 2: Poll for completion
  let status = 'processing';
  while (status === 'processing') {
    await sleep(2000); // Wait 2 seconds

    const statusResponse = await fetch(
      `${baseUrl}/api/charmonator/v1/conversions/documents/${job_id}`
    );

    const statusData = await statusResponse.json();
    status = statusData.status;

    if (statusData.progress) {
      console.log(`[INFO] Progress: ${statusData.progress.current}/${statusData.progress.total} pages`);
    }
  }

  if (status === 'failed') {
    throw new Error('PDF conversion failed');
  }

  console.log('[INFO] Conversion complete!');

  // Step 3: Fetch result
  const resultResponse = await fetch(
    `${baseUrl}/api/charmonator/v1/conversions/documents/${job_id}/result`
  );

  if (!resultResponse.ok) {
    throw new Error(`Failed to fetch result: ${resultResponse.statusText}`);
  }

  const docJson = await resultResponse.json();

  // Step 4: Convert doc.json to markdown
  const markdown = convertDocToMarkdown(docJson);

  return markdown;
}

function convertDocToMarkdown(docObject) {
  let markdown = '';

  // Add metadata
  if (docObject.metadata) {
    markdown += '<!--\n';
    markdown += `filename: ${docObject.metadata.filename}\n`;
    markdown += `sha256: ${docObject.metadata.sha256}\n`;
    markdown += `size: ${docObject.metadata.size_bytes} bytes\n`;
    markdown += '-->\n\n';
  }

  // Add pages
  for (const page of docObject.pages) {
    // Page marker
    markdown += `<!-- METADATA page_number: ${page.page_number} -->\n`;
    markdown += `<!-- METADATA text_extraction_method: ${page.extraction_method} -->\n`;
    markdown += `<!-- METADATA extraction_confidence: ${page.confidence} -->\n`;
    markdown += `<!-- METADATA model_name: ${page.model} -->\n\n`;

    // Page content
    markdown += page.content;
    markdown += '\n\n';

    // Page boundary (except last page)
    if (page.page_number < docObject.pages.length) {
      markdown += '<!-- page boundary -->\n\n';
    }
  }

  return markdown;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## Configuration

### Base URL Construction

```javascript
function buildBaseUrl(globalFlags) {
  const hostname = globalFlags.hostname || 'localhost';
  const port = globalFlags.port || 5002;
  const prefix = globalFlags.baseUrlPrefix || '';

  return `http://${hostname}:${port}${prefix}`;
}

// Examples:
// Default: http://localhost:5002
// Custom: http://api.example.com:8080/api/v2
```

---

### Model Selection

**Default:** Server's default model (typically latest Claude)

**Override with --model:**
```bash
charm --model gpt-4o transmogrify --to md input.pdf
charm --model claude-3-opus-20240229 transmogrify --to json data.csv
```

**Model is used for:**
- Interpreter guide calls
- Compiler guide code generation
- PDF conversion (OCR + vision)

---

## Error Handling

### API Errors

**Network errors:**
```javascript
try {
  const response = await fetch(endpoint, options);
} catch (error) {
  console.error(`[ERROR] Network error: ${error.message}`);
  process.exit(EXIT_CODES.MODEL_FAILURE);
}
```

**HTTP errors:**
```javascript
if (!response.ok) {
  const errorText = await response.text();
  console.error(`[ERROR] API error: ${response.status} ${response.statusText}`);
  console.error(`[ERROR] Details: ${errorText}`);
  process.exit(EXIT_CODES.MODEL_FAILURE);
}
```

---

### Response Validation

**Check for messages:**
```javascript
const result = await response.json();
const messages = result.messages || [];

if (messages.length === 0) {
  console.error('[ERROR] No messages in response from Charmonator');
  process.exit(EXIT_CODES.MODEL_FAILURE);
}
```

**Extract assistant message:**
```javascript
const assistantMessage = messages.find(m => m.role === 'assistant');

if (!assistantMessage) {
  console.error('[ERROR] No assistant message in response');
  process.exit(EXIT_CODES.MODEL_FAILURE);
}
```

---

### Timeout Handling

**For long-running operations:**

```javascript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 120000); // 2 minutes

try {
  const response = await fetch(endpoint, {
    ...options,
    signal: controller.signal
  });
  clearTimeout(timeout);
} catch (error) {
  if (error.name === 'AbortError') {
    console.error('[ERROR] Request timed out');
    process.exit(EXIT_CODES.MODEL_FAILURE);
  }
  throw error;
}
```

---

## Rate Limiting

**Polling strategy:**

```javascript
async function pollWithBackoff(checkFn, maxAttempts = 60) {
  let attempt = 0;
  let delay = 1000; // Start with 1 second

  while (attempt < maxAttempts) {
    const result = await checkFn();

    if (result.done) {
      return result.data;
    }

    // Exponential backoff (up to 5 seconds)
    await sleep(Math.min(delay, 5000));
    delay *= 1.2; // Increase delay by 20%
    attempt++;
  }

  throw new Error('Polling timeout');
}

// Usage
const docJson = await pollWithBackoff(async () => {
  const response = await fetch(`${baseUrl}/conversions/documents/${jobId}`);
  const data = await response.json();

  if (data.status === 'complete') {
    return { done: true, data: data };
  } else if (data.status === 'failed') {
    throw new Error('Job failed');
  }

  return { done: false };
});
```

---

## Security Considerations

### API Key Authentication

If Charmonator requires authentication:

```javascript
const headers = {
  'Content-Type': 'application/json'
};

// Add auth header if API key is configured
if (globalFlags.apiKey) {
  headers['Authorization'] = `Bearer ${globalFlags.apiKey}`;
}

const response = await fetch(endpoint, {
  method: 'POST',
  headers: headers,
  body: JSON.stringify(payload)
});
```

---

### Data Privacy

**Considerations:**

1. **Data transmission** - Documents sent to API over network
2. **Server storage** - API may temporarily store documents
3. **Model training** - Check provider's data usage policy
4. **Sensitive data** - Use local/private endpoints for sensitive content

**Best practices:**

```bash
# Use local server for sensitive data
charm --hostname localhost --port 5002 transmogrify --to md sensitive.pdf

# Use VPN or private network
charm --hostname internal-api.company.com transmogrify --to json data.csv
```

---

## Performance Optimization

### Minimize API Calls

**For interpreter guides:**
- Single API call per conversion
- No additional optimization needed

**For compiler guides:**
- Single API call to generate code
- Code execution is local (no additional calls)

**For PDF conversion:**
- One submission call
- Multiple polling calls (optimized with exponential backoff)
- One result fetch call

---

### Caching (Future)

Potential optimization for repeated conversions:

```javascript
// Cache generated code for compiler guides
const cacheKey = `${guideName}:${inputHash}`;
const cachedCode = await codeCache.get(cacheKey);

if (cachedCode) {
  console.log('[INFO] Using cached compiler code');
  return await executeCode(cachedCode, inputPath, outputPath);
}

// Generate and cache
const generatedCode = await generateCode(...);
await codeCache.set(cacheKey, generatedCode);
```

---

## Debugging API Calls

### Enable Verbose Logging

**Add debug output:**

```javascript
if (process.env.DEBUG_API) {
  console.log('[DEBUG] API Request:');
  console.log(`  Endpoint: ${endpoint}`);
  console.log(`  Method: POST`);
  console.log(`  Body: ${JSON.stringify(payload, null, 2)}`);
}

const response = await fetch(endpoint, options);

if (process.env.DEBUG_API) {
  console.log('[DEBUG] API Response:');
  console.log(`  Status: ${response.status}`);
  console.log(`  Headers: ${JSON.stringify(Object.fromEntries(response.headers))}`);
  const body = await response.text();
  console.log(`  Body: ${body}`);
}
```

**Usage:**
```bash
DEBUG_API=1 charm transmogrify --to md input.pdf
```

---

### Test API Connectivity

**Simple test script:**

```bash
#!/bin/bash

# Test Charmonator connectivity
BASE_URL="http://localhost:5002"

echo "Testing Charmonator API..."

# Test transcript endpoint
curl -X POST "${BASE_URL}/api/charmonator/transcript/extension" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "messages": [
      {"role": "user", "content": "Hello"}
    ]
  }' | jq .

echo ""
echo "If you see a response above, the API is working."
```

---

## API Versioning

### Current Version

**Transcript endpoint:** No version prefix (stable)
- `/api/charmonator/transcript/extension`

**Document conversion:** v1
- `/api/charmonator/v1/conversions/documents`

### Future Compatibility

**Handle version changes:**

```javascript
function getDocumentConversionEndpoint(baseUrl, version = 'v1') {
  return `${baseUrl}/api/charmonator/${version}/conversions/documents`;
}

// Allow version override
const apiVersion = process.env.CHARMONATOR_API_VERSION || 'v1';
const endpoint = getDocumentConversionEndpoint(baseUrl, apiVersion);
```

---

## Advanced Integration

### Custom Endpoints

**Add support for new endpoints:**

```javascript
// Example: Image description endpoint
async function describeImage(baseUrl, model, imagePath) {
  const formData = new FormData();
  formData.append('image', fs.createReadStream(imagePath));
  formData.append('model', model);

  const response = await fetch(
    `${baseUrl}/api/charmonator/conversion/image`,
    {
      method: 'POST',
      body: formData
    }
  );

  const result = await response.json();
  return result.description;
}
```

---

### Batch Processing

**Process multiple files efficiently:**

```javascript
async function batchConvert(files, options) {
  const results = [];

  // Process in parallel (limit concurrency)
  const concurrency = 3;
  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchPromises = batch.map(file =>
      convertFile(file, options).catch(error => ({
        file,
        error: error.message
      }))
    );
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  return results;
}
```

---

## Next Steps

- **Troubleshooting:** [Troubleshooting](./10-troubleshooting.md)
- **Create guides:** [Guide Development](./08-guide-development.md)
- **See examples:** [Examples](./07-examples.md)
- **Command reference:** [Command Reference](./03-command-reference.md)
