# Getting started with charm-cli and charmonator/charmonizer

This tutorial walks you through setting up **charmonator**, **charmonizer** and **charm-cli** from scratch, and then shows you examples of commands with `charm-cli`.



## What are charmonator, charmonizer and charm-cli?

Charmonator provides a low-level interface to generative AI models that abstracts over implementation-level differences between them, allowing systems built on charmonater to switch models and providers easily.

Charmonator provides a unifying layer for *simple* routine AI-related tasks for chat, (structured) document conversion, embeddings and more.

Charmonizer builds on top of charmonator to handle common *complex*, long-running tasks, such as document transcription, summarization and transformation.  These tasks may require orchestration of multiple invocations of charmonator behind the scenes.



Charmonater and charmonizer are implemented through a shared daemon that exports a REST-based API.

`charm-cli` is command-line client for charmonator and charmonizer APIs.

The `charm-cli` tool is meant to be useful by itself, but it is also meant to a reference implementation for how to access these APIs.


In this tutorial, you'll also encounter the [JSON Document Object](https://github.com/CHARM-BDF/charmonator/blob/main/docs/document.md) format (.doc.json) used to represent documents and document collections.

This format holds onto metadata and annotations that frequently arise from document processing operations, such as transcription, summarization and chunking.

`charm-cli` tends to keep intermediate results in this format.

 


## Prerequisites

 - **node.js** (version 18 or later recommended)
 - **git**
 - **an API key** for an LLM provider (e.g., OpenAI, Anthropic or another supported provider) or a local instance of Ollama
 - **GraphicsMagick** (optional, for image processing)


On macOS, you can install GraphicsMagick with:

```bash
brew install graphicsmagick
```


## Part 1: Setting up charmonator/charmonizer daemon


In order to use charmonator or charmonizer, the shared daemon must be running in the background.



### Step 1: Clone the charmonator repository

```bash
git clone https://github.com/CHARM-BDF/charmonator.git
cd charmonator
```


### Step 2: Install dependencies

```bash
npm install
```


### Step 3: Create the configuration

Charmonator requires a configuration file to know which models to use and how to connect to them.

1. Create the configuration directory:

```bash
mkdir -p conf
```

2. Generate an example configuration:

```bash
node scripts/generate-example-config.js > conf/config.json
```

3. Open `conf/config.json` in your editor and customize it for your setup. The key fields are:

 - `port` - The port the server will listen on (default: 5002)
 - `baseUrl` - The URL prefix for API routes (default: "/charm")
 - `models` - Configuration for your LLM models

Unless there is a conflict, keeping these defaults is recommended.



Here are examples of different model configurations you can add to your `conf/config.json`:


#### GPT-5.1 on OpenAI (with thinking and verbosity)

```json
{
  "models": {
    "openai:gpt-5.1-thinking": {

      "api": "OpenAI",
      "model_type": "chat",

      "api_key": "sk-your-openai-api-key-here",

      "model": "gpt-5.1",

      "reasoning": { "effort": "high" },
      "verbosity": "high",

      "context_size": 400000,
      "output_limit": 128000,

      "description": "GPT-5.1 with high reasoning effort and verbose output for complex tasks."
    }
  }
}
```

The `reasoning` parameter controls the model's thinking depth:
- `"effort": "high"` - Maximum reasoning for complex problems
- `"effort": "medium"` - Balanced reasoning
- `"effort": "low"` - Faster responses with less deliberation
- `"effort": "minimal"` - Minimal reasoning overhead

The `verbosity` parameter controls output detail level (`"high"`, `"medium"`, `"low"`).


The `context_size` and `output_limit` parameters are not necessary, but may be picked up by downstream tools (such as summarizers) that are sensitive to these parameters.



#### GPT-5-mini on OpenAI

```json
{
  "models": {
    "openai:gpt-5-mini": {
      "api": "OpenAI",
      "model_type": "chat",

      "api_key": "sk-your-openai-api-key-here",

      "model": "gpt-5-mini",
      "reasoning": { "effort": "high" },
      "verbosity": "high",

      "context_size": 400000,
      "output_limit": 128000,

      "description": "GPT-5-mini is the cost-efficient variant of GPT-5, supporting up to 400K token context."
    }
  }
}
```

GPT-5-mini offers a good balance between performance and cost, with strong reasoning capabilities and large context window support.



#### gpt-oss:20b via Ollama (local)

```json
{
  "models": {
    "ollama:gpt-oss:20b": {

      "api": "ollama",

      "model_type": "chat",
      "model": "gpt-oss:20b",

      "host": "http://localhost:11434",
      "temperature": 0.8,

      "system": "You are a helpful assistant.",
      "description": "Local gpt-oss 20B model running via Ollama."
    }
  }
}
```

For Ollama models:

 - No API key is required (as it runs locally).
 - `host` specifies the Ollama server URL (default: `http://localhost:11434`)
 - You must have Ollama installed and the model pulled (`ollama pull gpt-oss:20b`)




### Step 4 (Optional): Store your API keys separately/securely

For security, you are encouraged to store your API keys in a separate secrets file, along side `config.json`.


```bash
touch conf/config.secret.json
```

Add your API keys in this format:

```json
{
  "models": {
    "gpt-4o": {
      "api_key": "sk-your-openai-api-key-here"
    },
    
    "claude-sonnet": {
      "api_key": "sk-ant-your-anthropic-key-here"
    }
  }
}
```

Replace the placeholder keys with your actual API keys from your LLM provider(s).



### Step 5: Start the server

```bash
node server.mjs
```

You should see output indicating the server has started, typically on port 5002. Keep this terminal window open while using charm-cli.

To verify the server is running, you can test it with:

```bash
curl http://localhost:5002/charm/api/charmonator/v1/models
```

This should return a list of configured models.




## Part 2: Setting Up charm-cli (the command-line client)

charm-cli is a command-line interface that makes it easy to interact with the charmonator server.


### Step 1: Clone the repository

Open a new terminal window and run:

```bash
git clone https://github.com/CHARM-BDF/charm-cli.git
cd charm-cli
```


### Step 2: Install dependencies

```bash
npm install
```


### Step 3: Add charm to Your PATH

You have several options:

**Option A: Symlink to ~/bin** (recommended)

```bash
mkdir -p ~/bin
ln -s "$(pwd)/bin/charm" ~/bin/charm
```

Make sure `~/bin` is in your PATH by adding this to your `~/.bashrc` or `~/.zshrc`:

```bash
export PATH="$HOME/bin:$PATH"
```

**Option B: Add the bin directory to PATH**

Add this line to your `~/.bashrc` or `~/.zshrc`:

```bash
export PATH="$PATH:/path/to/charm-cli/bin"
```

After editing your shell config, reload it:

```bash
source ~/.bashrc  # or source ~/.zshrc
```


### Step 4: Configure `charm-cli`

`charm-cli` needs to know how to connect to your charmonator server.


**Option A: Auto-generate config from charmonator** (easiest)

If you have access to your charmonator's config file:

```bash
charm convert-server-config /path/to/charmonator/conf/config.json
```

This automatically creates `~/.config/charm/config.json` with the correct settings.




**Option B: Create the config manually**

```bash
mkdir -p ~/.config/charm
```

Create `~/.config/charm/config.json` with:

```json
{
  "port": 5002,
  "hostname": "localhost",
  "baseUrlPrefix": "/charm",
  "model": "gpt-4o"
}
```

Adjust these values to match your charmonator server:

 - `port` - Must match charmonator's port
 - `hostname` - Use "localhost" for local server, or the server's hostname/IP
 - `baseUrlPrefix` - Must match charmonator's baseUrl setting
 - `model` - The default model to use (must be configured in charmonator)

You can also use a config file in a different location by specifying the `--conf` flag:

```bash
charm --conf /path/to/custom/config.json run "Hello, world!"
```




### Step 5: Verify installation

Test that charm-cli can connect to your server:

```bash
charm --help
```

This should display the help message with available commands.




## Part 3: Running `charm-cli` commands

Now let's run some commands to verify everything is working.



### Example 1: Simple Chat Prompt

The `run` command sends a prompt to the LLM and returns the response:

```bash
charm run "What is the capital of France?"
```

Expected output:
```
The capital of France is Paris.
```



### Example 2: Using a System Prompt

You can provide a system prompt to set the context for the conversation:

```bash
charm run --system "You are a helpful assistant that speaks like a pirate." "Tell me about the weather"
```



### Example 3: Processing a File

You can include file contents in your prompt:

```bash
charm run --input-file mycode.py "Explain what this code does"
```



### Example 4: Interactive chat mode

For a back-and-forth conversation:

```bash
charm chat
```

Type your messages and press Enter. Type `exit` or press Ctrl+D to quit.




### Example 5: Specifying a Different Model

To use a different model than your default:

```bash
charm run --model gpt-4o-mini "Summarize the theory of relativity in one sentence"
```



### Example 6: Simple conversion of a document

Convert a PDF to markdown:

```bash
charm convert document.pdf --output document.md
```

Note: The `convert` command uses the "fast" charmonator endpoints, which may use fast, efficient traditional OCR rather than a generative model.




### Example 7: Transcribing a PDF to a document object

The `transcribe` command performs full AI-powered transcription of PDFs and other documents, including OCR for scanned documents and intelligent interpretation of figures, tables, and graphics.

```bash
charm transcribe document.pdf
```

By default, this outputs a `.doc.json` file (e.g., `document.pdf.doc.json`). The `.doc.json` format is a structured JSON Document Object that contains:

- **`id`**: A unique identifier (typically the SHA-256 hash of the file)
- **`content`**: The full transcribed content as markdown
- **`metadata`**: Information about the source file (filename, size, hash, status)
- **`chunks`**: The document broken into pages, each with its own content and metadata

You can also output directly to markdown:

```bash
charm transcribe document.pdf --output-format md
```

#### Transcription Options

Provide context to improve transcription quality:

```bash
charm transcribe document.pdf \
  --description "A research paper on machine learning" \
  --intent "Extract key findings and methodology" \
  --graphic-instructions "Describe all figures and charts in detail"
```

For medical documents, use the preset which automatically sets appropriate description, intent, and graphic instructions:

```bash
charm transcribe patient-records.pdf --input-document-type medical
```

Batch process multiple files by listing them in a text file:

```bash
charm transcribe file-list.txt --batch
```

#### About the Document Object Format

The `.doc.json` format is designed for downstream processing such as summarization, embedding generation, and semantic search. For full documentation on the Document Object schema, see the [charmonator API documentation](https://github.com/CHARM-BDF/charmonator/blob/main/docs/api-docs.md).




### Example 8: Summarizing a Document

The `summarize` command generates summaries of documents that have been transcribed to the `.doc.json` format. It processes chunks (such as pages) and can produce both per-chunk summaries and an overall document summary.

```bash
charm summarize --input document.pdf.doc.json
```

This outputs a `.summarized.doc.json` file with summary annotations added to each chunk.

#### Summarization Options

Provide custom guidance to control what the summary focuses on:

```bash
charm summarize --input document.pdf.doc.json \
  --guidance "Focus on key findings, methodology, and conclusions"
```

Use a summarization guide for domain-specific summarization:

```bash
charm summarize --input document.pdf.doc.json --guide research-paper
```

List available summarization guides:

```bash
charm summarize --list-guides
```

#### Summarization Methods

The `--method` flag controls how the document is summarized:

- `map` (default): Summarizes each chunk independently, then merges
- `fold`: Builds a running summary by processing chunks sequentially
- `full`: Sends the entire document to the model at once (for smaller documents)

```bash
charm summarize --input document.pdf.doc.json --method fold
```

#### Structured Output with JSON Schema

For structured summaries, provide a JSON schema:

```bash
charm summarize --input document.pdf.doc.json \
  --json-schema-file summary-schema.json
```

## Global Flags

These flags work with any command to override your config settings:

| Flag | Description |
|------|-------------|
| `--conf <path>` | Use a custom config file instead of the default |
| `--port <number>` | Override the server port |
| `--hostname <name>` | Override the server hostname |
| `--base-url-prefix <prefix>` | Override the URL prefix |
| `--model <name>` | Override the default model |

Example:

```bash
charm --port 5003 --model claude-sonnet run "Hello, world!"
```




## Troubleshooting

### "Connection refused" error

- Make sure charmonator is running
- Verify the port and hostname in your config match the server
- Check if a firewall is blocking the connection

### "Model not found" error

- Verify the model name in your charm config matches a model configured in charmonator
- Check your charmonator config for available models

### "Invalid API key" error

- Verify your API keys in charmonator's `conf/config.secret.json`
- Make sure the keys are associated with the correct model names

### Debug mode

Enable debug output to see what charm is sending to the server:

```bash
DEBUG_CHARM=1 charm run "test prompt"
```

## Next Steps

- Explore `charm --help` to see all available commands
- Try `charm <command> --help` for detailed options on each command
- Read the [API documentation](https://github.com/CHARM-BDF/charmonator/blob/main/docs/api-docs.md) for more details on what the server can do
- Check out the [transmogrify documentation](./transmogrify/) for advanced file transformation features




## Quick Reference

| Task | Command |
|------|---------|
| Simple prompt | `charm run "your prompt"` |
| With system prompt | `charm run --system "context" "prompt"` |
| Include a file | `charm run --input-file input.txt "analyze this"` |
| Interactive chat | `charm chat` |
| Convert file | `charm convert input.pdf --output output.md` |
| Transcribe to .doc.json | `charm transcribe document.pdf` |
| Transcribe to markdown | `charm transcribe document.pdf --output-format md` |
| Summarize a document | `charm summarize --input document.pdf.doc.json` |
| Get help | `charm --help` |
