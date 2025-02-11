# charm-cli

A command-line interface, `charm`, that wraps around endpoints in the charmonator and charmonizer APIs.

It also provides tools for analysing and manipulating the data objects returned by the API.


To use this tool, you must have a charm server running.

## Installation

To install dependencies with `npm`, run the following command:

```bash
npm install
```

Then, place `bin/charm` in your path.

I recommend creating a symlink to `bin/charm` in `~/bin`.

Or, you could add `bin/charm` to your path by adding the following line to your `.bashrc` or `.bash_profile`:

```
export PATH=$PATH:/path/to/charm-cli/bin
```

