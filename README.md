# Context Chest

**Encrypted memory for AI agents.** Give your coding agents persistent, searchable memory that only you can read.

Context Chest is an open-source MCP server that lets AI agents remember things across sessions -- project conventions, decisions, debugging notes, anything worth keeping. All content is encrypted client-side with AES-256-GCM before it ever leaves your machine. The server never sees plaintext.

## Quick Start

Install the MCP server and add it to your agent's config:

```bash
npm install -g context-chest-mcp
context-chest login
```

Then add to your MCP config (`claude_desktop_config.json`, `.cursor/mcp.json`, etc.):

```json
{
  "mcpServers": {
    "context-chest": {
      "command": "context-chest-mcp",
      "args": []
    }
  }
}
```

That's it. Your agent now has 8 tools for persistent, encrypted memory.

## Tools

| Tool | Description |
|------|-------------|
| `remember` | Store a memory with a path and tags |
| `recall` | Search memories by keyword or semantic query |
| `read` | Decrypt and return the full content of a memory |
| `forget` | Delete a memory |
| `browse` | List memories in a directory-like structure |
| `session-start` | Begin tracking the current conversation |
| `session-append` | Add a message to the active session |
| `session-save` | Extract memories from the session and close it |

## Features

- **End-to-end encrypted** -- AES-256-GCM with per-item keys derived via HKDF. The server stores ciphertext only.
- **Works everywhere** -- Claude Code, Cursor, Windsurf, or any MCP-compatible client.
- **PWA dashboard** -- Browse memories, view connected agents, and manage sessions from a web UI.
- **Session capture** -- Record full conversations and extract structured memories from them.
- **Vector search** -- Optional semantic recall via OpenViking. Works without it too (falls back to text search).
- **Self-hosted** -- Run on your own infrastructure. Docker Compose for local dev, deploy anywhere.

## Use Cases

**Developers** — Your AI remembers your stack, conventions, and past decisions across sessions. No more re-explaining your architecture every time. Encrypted, so proprietary code context stays private.

**Founders & PMs** — You paste revenue numbers, hiring plans, and investor decks into AI daily. Context Chest encrypts it all client-side. The server never sees your burn rate.

**Freelancers** — Juggle 5 client projects without cross-contamination. Your AI switches context instantly, and client A's secrets never leak into client B's session.

**Regulated industries** — Healthcare, finance, legal. Your compliance team would lose it if they knew what you paste into AI. AES-256-GCM, keys on your machine, server sees only ciphertext.

**Teams** — Multiple developers connect to the same vault. Architecture decisions, review guidelines, runbooks — stored once, available to every agent.

### Example

```
You:  "Remember that we chose Stripe over Paddle because of marketplace support"
      → Stored at decisions/payments, encrypted

You:  "Recall everything about payments"
      → Returns the decision, instantly, in any future session
```

## How It Works

Context Chest uses a three-layer encryption model:

```
Master Key (random 256-bit)
  |
  |-- wrapped with HKDF(exportKey, userId) --> stored on server
  |
  +-- HKDF(masterKey, memoryURI) --> per-item key
        |
        +-- AES-256-GCM encrypt --> ciphertext stored on server
```

1. On registration, a random master key is generated client-side
2. The master key is wrapped using a key derived from your credentials and stored server-side
3. Each memory gets its own encryption key derived from the master key + the memory's URI
4. Only the MCP server (running on your machine) can decrypt -- the API server never sees plaintext

## Development

### Prerequisites

- Node.js 20+
- Docker and Docker Compose

### Setup

```bash
git clone https://github.com/fuckupic/context-chest.git
cd context-chest

# Start Postgres, MinIO, and supporting services
docker-compose up -d

# Install dependencies
npm install

# Configure environment
cp .env.example .env

# Run database migrations
npx prisma migrate dev

# Start the API server
npm run dev
```

The API server runs on `http://localhost:3002`. The PWA dev server runs on `http://localhost:5173`.

### Project Structure

```
context-chest/
  packages/
    mcp-server/     # MCP server (installed by agents)
  src/              # API server (Fastify + Prisma)
  prisma/           # Database schema and migrations
  docker-compose.yml
```

### Running Tests

```bash
npm test
```

## License

MIT
