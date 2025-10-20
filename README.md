# Auggie Context MCP Server

[![npm version](https://badge.fury.io/js/auggie-context-mcp.svg)](https://www.npmjs.com/package/auggie-context-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that exposes Auggie CLI for codebase context retrieval. This allows AI agents like Claude, Cursor, and others to query codebases using Augment's powerful context engine.

## Quick Start

```bash
# 1. Install Auggie CLI (if not already installed)
# See: https://docs.augmentcode.com/cli/overview

# 2. Get your access token
auggie token print

# 3. Run the MCP server
npx -y auggie-context-mcp@latest
```

**⚠️ IMPORTANT**: You must set the `AUGMENT_SESSION_AUTH` environment variable with your token (see [Authentication](#authentication) section).

## Features

- 🔍 **Codebase Query**: Intelligent Q&A over repositories using Augment's context engine
- 🚀 **Simple Setup**: Pure TypeScript/Node.js implementation (no Python required)
- 🔒 **Read-Only**: Safe context retrieval without file modification capabilities
- ⚡ **Fast**: Direct integration with Auggie CLI
- 📦 **Easy Distribution**: Single npm package, works with `npx`

## Requirements

- **Node.js 18+**
- **Auggie CLI** installed and available on PATH
  - Install: See [Auggie CLI installation guide](https://docs.augmentcode.com/cli/overview)
  - Verify: `auggie --version`
- **Augment Access Token** (REQUIRED - see Authentication section below)

## Authentication

⚠️ **REQUIRED**: You must provide an Augment access token to use this server.

### Get Your Token

```bash
# 1. Ensure Auggie CLI is installed
auggie --version

# 2. Sign in to Augment (opens browser)
auggie login

# 3. Print your access token
auggie token print
```

This will output something like:
```
TOKEN={"accessToken":"your-token-here","tenantURL":"https://...","scopes":["read","write"]}
```

### Set the Token

The server **requires** the `AUGMENT_SESSION_AUTH` environment variable to be set.

**Option 1: In MCP client config (recommended)**

Add the token to your MCP client configuration:

```json
{
  "mcpServers": {
    "auggie-context": {
      "command": "npx",
      "args": ["-y", "auggie-context-mcp@latest"],
      "env": {
        "AUGMENT_SESSION_AUTH": "{\"accessToken\":\"your-token-here\",\"tenantURL\":\"https://...\",\"scopes\":[\"read\",\"write\"]}"
      }
    }
  }
}
```

**Option 2: Shell environment**

```bash
# Get your token
TOKEN=$(auggie token print | grep '^TOKEN=' | cut -d= -f2-)

# One-time for current session
export AUGMENT_SESSION_AUTH="$TOKEN"

# Or persist in ~/.zshrc or ~/.bashrc
echo "export AUGMENT_SESSION_AUTH='$TOKEN'" >> ~/.zshrc
source ~/.zshrc
```

⚠️ **Security**: Never commit tokens to source control. Use environment variables or secure config stores.

## Installation & Usage

### Quick Test (Terminal)

```bash
# Set your token first
export AUGMENT_SESSION_AUTH=$(auggie token print | grep '^TOKEN=' | cut -d= -f2-)

# Run directly with npx (will auto-install)
npx -y auggie-context-mcp@latest
```

### Cursor Configuration

Add to your Cursor MCP config (`.cursor/mcp.json` - global or per-project):

**⚠️ IMPORTANT**: Replace the `AUGMENT_SESSION_AUTH` value with your actual token from `auggie token print`

```json
{
  "mcpServers": {
    "auggie-context": {
      "command": "npx",
      "args": ["-y", "auggie-context-mcp@latest"],
      "env": {
        "AUGMENT_SESSION_AUTH": "{\"accessToken\":\"your-token-here\",\"tenantURL\":\"https://...\",\"scopes\":[\"read\",\"write\"]}"
      }
    }
  }
}
```

### Claude Desktop (macOS)

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

**⚠️ IMPORTANT**: Replace the `AUGMENT_SESSION_AUTH` value with your actual token from `auggie token print`

```json
{
  "mcpServers": {
    "auggie-context": {
      "command": "npx",
      "args": ["-y", "auggie-context-mcp@latest"],
      "env": {
        "AUGMENT_SESSION_AUTH": "{\"accessToken\":\"your-token-here\",\"tenantURL\":\"https://...\",\"scopes\":[\"read\",\"write\"]}"
      }
    }
  }
}
```

### Claude Desktop (Windows)

Edit `%APPDATA%\Claude\claude_desktop_config.json`:

**⚠️ IMPORTANT**: Replace the `AUGMENT_SESSION_AUTH` value with your actual token from `auggie token print`

```json
{
  "mcpServers": {
    "auggie-context": {
      "command": "npx",
      "args": ["-y", "auggie-context-mcp@latest"],
      "env": {
        "AUGMENT_SESSION_AUTH": "{\"accessToken\":\"your-token-here\",\"tenantURL\":\"https://...\",\"scopes\":[\"read\",\"write\"]}"
      }
    }
  }
}
```

## Available Tools

### `query_codebase`

Query a codebase using Augment's context engine.

**Parameters:**

- `query` (required): The question or query about the codebase
- `workspace_root` (optional): Absolute path to the workspace/repository root. Defaults to current directory.
- `model` (optional): Model ID to use. Example: `claude-3-5-sonnet-20241022`
- `rules_path` (optional): Path to additional rules file
- `timeout_sec` (optional): Query timeout in seconds. Default: 240
- `output_format` (optional): Output format (`text` or `json`). Default: `text`

**Example Usage in Claude/Cursor:**

```
What is the architecture of this codebase?

How does the authentication system work?

Where is the user registration logic implemented?

Show me how the payment processing is handled.
```

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/aj47/auggie-mcp.git
cd auggie-mcp

# Install dependencies
npm install

# Build
npm run build
```

### Development Mode

```bash
# Watch mode (auto-rebuild on changes)
npm run watch

# Run in development
npm run dev
```

### Testing Locally

```bash
# Build the project
npm run build

# Test with MCP Inspector (if installed)
npx @modelcontextprotocol/inspector node dist/index.js

# Or test directly
node dist/index.js
```

## Architecture

```
┌─────────────────────┐
│   AI Agent          │
│ (Claude, Cursor)    │
└──────────┬──────────┘
           │ MCP Protocol (stdio)
           ▼
┌─────────────────────┐
│ auggie-context-mcp  │
│  (TypeScript/Node)  │
│                     │
│  Tool:              │
│  - query_codebase   │
└──────────┬──────────┘
           │ subprocess
           ▼
┌─────────────────────┐
│   Auggie CLI        │
│  --print --quiet    │
│                     │
│  Augment Context    │
│  Engine             │
└─────────────────────┘
```

## Troubleshooting

### "Auggie CLI not found"

Ensure Auggie is installed and on your PATH:

```bash
auggie --version
```

If not found, install from: https://docs.augmentcode.com/cli/overview

### "AUGMENT_SESSION_AUTH environment variable is required"

Set your token as described in the Authentication section.

### "Query timed out"

Increase the timeout:

```json
{
  "query": "your question",
  "timeout_sec": 600
}
```

### Server not showing up in Claude/Cursor

1. Check the config file syntax (valid JSON)
2. Ensure `AUGMENT_SESSION_AUTH` is set in the `env` section
3. Restart the client application completely
4. Check logs:
   - **Claude Desktop (macOS)**: `~/Library/Logs/Claude/mcp*.log`
   - **Cursor**: Check the MCP logs in settings

## Security

- **Read-only**: This server only queries codebases; it cannot modify files
- **Token safety**: Never commit `AUGMENT_SESSION_AUTH` to version control
- **Workspace isolation**: Queries are scoped to the specified workspace

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Links

- [Augment Code](https://www.augmentcode.com/)
- [Auggie CLI Documentation](https://docs.augmentcode.com/cli/overview)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP Specification](https://spec.modelcontextprotocol.io/)

