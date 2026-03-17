# Context Chest

**Your second brain for every AI tool you use.**

You use Claude Code, Cursor, and Windsurf across multiple projects. Each one forgets everything between sessions. Context Chest gives them all a shared, encrypted memory that auto-organizes by topic.

Store in Claude. Recall in Cursor. Browse from Windsurf. One vault, every tool.

**[contextchest.com](https://contextchest.com)** · **[Pricing](https://contextchest.com/pricing)**

---

## Why Context Chest?

Every AI memory tool out there solves "Claude forgets" — for Claude only. If you use multiple tools, you're out of luck.

| | memory-mcp | MemCP | Knowledge Graph | **Context Chest** |
|---|---|---|---|---|
| Works in Claude | Yes | Yes | Yes | **Yes** |
| Works in Cursor | No | No | No | **Yes** |
| Works in Windsurf | No | No | No | **Yes** |
| E2E encrypted | No | No | No | **Yes (AES-256)** |
| Auto-sorted by topic | No | No | No | **Yes** |
| Web dashboard | No | No | No | **Yes** |
| Export / Import | No | No | No | **Yes (.md / .zip)** |

## Quick Start (30 seconds)

### 1. Sign up + generate API key

Go to [contextchest.com](https://contextchest.com), create an account, then go to **Settings → Generate API Key**.

### 2. Add config to your project

Create `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "context-chest": {
      "command": "npx",
      "args": ["-y", "context-chest-mcp@latest"],
      "env": {
        "CONTEXT_CHEST_API_KEY": "cc_your_key_here",
        "CONTEXT_CHEST_EXPORT_KEY": "your_export_key_here"
      }
    }
  }
}
```

### 3. Restart Claude Code / Cursor

Type `/exit` and relaunch. Done. No terminal login, no password prompts.

### 4. (Optional) Add agent instructions

Paste Context Chest instructions into your `CLAUDE.md` to enable passive context extraction — your AI will automatically extract and remember context from conversations without you saying "remember this."

Copy the instructions from [contextchest.com/settings](https://contextchest.com/settings).

---

## How It Works

### Auto-Sort Into Chests

Talk to your AI naturally. Context Chest extracts what matters and sorts it automatically:

- Talk about your tech stack → **Work** chest (blue)
- Mention a dentist appointment → **Health** chest (green)
- Discuss pricing strategy → **Finance** chest (yellow)
- Personal notes → **Personal** chest (purple)
- Tool configs → **Tools** chest (orange)
- Learning goals → **Learning** chest (cyan)

No manual organizing. No "remember this" commands. Just work.

### Cross-Agent Memory

```
Claude Code ──▶ Context Chest ◀── Windsurf
      │              │              │
      │    ┌─────────┴─────────┐   │
      │    │ Encrypted Vault   │   │
      │    │ ████████████████  │   │
      │    └─────────┬─────────┘   │
      │              │              │
Cursor ──────▶ Same keys ◀─── Any MCP
```

Store a decision in Claude Code. Recall it from Cursor. Browse it from Windsurf. One vault, every tool, every project.

### End-to-End Encryption

```
Master Key (256-bit random)
  │
  ├─ HKDF(exportKey, userId) → wrapping key
  │
  └─ HKDF(masterKey, chestName/URI) → per-item AES-256-GCM key
```

Everything is encrypted on your device before it leaves your machine. The server stores ciphertext only. Even we can't read your memories.

## Tools

| Tool | Description |
|------|-------------|
| `remember` | Store a memory — auto-routes to the right chest |
| `recall` | Search memories by keyword |
| `read` | Decrypt and read full content |
| `forget` | Delete a memory |
| `browse` | List memories as a directory tree |
| `session-start` | Begin tracking a conversation |
| `session-append` | Add a message to the active session |
| `session-save` | Extract memories and close session |

## Features

- **Cross-agent** — One memory across Claude Code, Cursor, Windsurf, any MCP client
- **Auto-sorted** — Memories route to chests by topic (work, health, finance, personal, tools, learning)
- **E2E encrypted** — AES-256-GCM with per-chest HKDF key derivation. Server sees only ciphertext.
- **Multi-project** — Different project? Different chest. One API key works everywhere.
- **Web dashboard** — Browse, edit (Tiptap WYSIWYG), search, and manage from [contextchest.com](https://contextchest.com)
- **Export / Import** — Download memories as .md files or full chest as .zip. Import from .md or .zip.
- **Self-hostable** — Run on your own infrastructure. Docker Compose included. MIT licensed.

## Who It's For

**The Multi-Tool Developer** — You bounce between Claude Code, Cursor, and Windsurf. Explain your stack once. Every tool knows it.

**The Freelancer** — 5 clients, 5 projects. Auto-separated into chests. Client A's secrets never leak into Client B's session.

**The Technical Founder** — Revenue numbers, hiring plans, investor notes. Encrypted so a server breach reveals nothing.

**The Privacy-Conscious Engineer** — Regulated industry? Self-host it. Your infra, your keys, your data.

## Pricing

| Community | Pro | Enterprise |
|---|---|---|
| Free forever | $9/month | Custom |
| Self-hosted | Cloud hosted | Dedicated infra |
| 3 chests, 2 agents | Unlimited | Unlimited + teams |
| [GitHub](https://github.com/fuckupic/context-chest) | [Waitlist](https://contextchest.com/pricing) | [Contact us](mailto:tady@uhumdrum.com) |

## Self-Hosting

```bash
git clone https://github.com/fuckupic/context-chest.git
cd context-chest
docker-compose up -d
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

API server: `http://localhost:3002`
PWA dashboard: `http://localhost:5173`

## Project Structure

```
context-chest/
  packages/
    mcp-server/     # MCP server (npm: context-chest-mcp)
    pwa/            # React PWA dashboard
  src/              # API server (Fastify + Prisma)
  prisma/           # Database schema + migrations
  docker-compose.yml
```

## Running Tests

```bash
npm test                    # API server tests
cd packages/mcp-server && npm test  # MCP server tests
```

## License

MIT

---

Built by [Tady](https://github.com/fuckupic) & Luky
