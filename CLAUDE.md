# CLAUDE.md - charm-cli

## Build Commands
- Install dependencies: `npm install`
- No specific test/lint commands defined in package.json
- Run the CLI: `node bin/charm` or add to PATH with `ln -s bin/charm ~/bin/charm`
- Copy code to clipboard: `make copyall`

## Code Style Guidelines

### Structure
- CLI commands go in `bin/commands/*.mjs`
- Utility functions in `bin/utils.mjs`
- Main entry point is `bin/charm`

### Imports/Exports
- ES modules with `.mjs` extension
- Import specific functions, not whole modules
- Export functions as named exports

### Error Handling
- Use try/catch blocks for potential errors
- Log errors with `console.error('[ERROR] <message>')`
- For warnings use `console.warn('[WARN] <message>')`
- Exit process with code 1 on fatal errors

### Naming Conventions
- Functions: camelCase (e.g., `commandChat`, `questionAsync`)
- Command functions prefixed with `command` (e.g., `commandRun`)
- Constants: camelCase (e.g., `defaultConfig`)

### Async Patterns
- Use async/await for asynchronous operations
- Handle promises with try/catch

## API Endpoints

### Charmonator Endpoints
- `/transcript/extension` - Extends an existing conversation transcript
- `/conversion/image` - Transcribes or describes an image to Markdown
- `/conversion/file` - Converts files to Markdown 
- `/embedding` - Creates an embedding vector for text

### Charmonizer Endpoints
- `/conversions/documents` - Converts/transcribes PDF to JSON Document Object
- `/summaries` - Summarizes a Document Object
- `/embeddings` - Computes embeddings for Document Object chunks
- `/chunkings` - Splits or merges chunks in a Document Object