# charm-cli

A command-line interface, `charm`, that wraps around endpoints in the charmonator and charmonizer APIs.

It also provides tools for analysing and manipulating the data objects returned by the API.


To use this tool, you must have a charm server running.

## Installation

To install dependencies with `npm`, run the following command:

```bash
npm install
```

At this point, you could run `node bin/charm` to run it.


But, I recommend place `bin/charm` in your path.

The simplest thing to do would be to symlink to `bin/charm` in `~/bin`:

```bash
ln -s bin/charm ~/bin/charm
```

Or, you could add `bin/charm` to your `PATH` environment variable by adding the following line to your `.bashrc` or `.bash_profile`:

```
export PATH=$PATH:/path/to/charm-cli/bin
```


## Configuration

`charm` looks for a configuration file at `~/.config/charm/config.json`, with the following format:

```json
{
  "port": 5002,
  "hostname": "localhost",
  "baseUrlPrefix": "/charm",
  "model": "gpt-4o"
}
```


This file is different from the `config.json` file used by the charmonator and charmonizer, but you can generate this file by running the following command:

```bash
charm convert-server-config <path-to-charm-server-conf/config.json>
```

which will generate a `config.json` file in `~/.config/charm/`.

If that file already exists, it will prompt if you want to overwrite it.

