# Context Chest Launch Posts

## Links
- **PWA**: https://pwa-one-gold.vercel.app
- **API**: https://api-production-e2cd6.up.railway.app
- **GitHub**: https://github.com/fuckupic/context-chest

---

## Hacker News — Show HN

**Title:** `Show HN: Context Chest – Encrypted persistent memory for AI coding agents`

**Text:**

I got tired of re-explaining my project setup to Claude every session. So I built an MCP server that gives AI agents persistent, encrypted memory.

The problem: you share sensitive context with AI daily — API keys, revenue numbers, architecture decisions. That context disappears after each session, and it's stored in plaintext on AI providers' servers.

Context Chest encrypts everything client-side (AES-256-GCM) before it leaves your machine. The server only stores ciphertext. Self-hostable.

30-second setup — add this to your Claude Code or Cursor config:

```
{ "mcpServers": { "context-chest": { "command": "npx", "args": ["@context-chest/mcp-server"] } } }
```

8 tools: remember, recall, read, forget, browse, session tracking.

Live demo: https://pwa-one-gold.vercel.app
GitHub: https://github.com/fuckupic/context-chest

Built with: Fastify, Prisma, PostgreSQL, React. Open source, MIT.

---

## Reddit r/ClaudeAI

**Title:** `I built an encrypted memory vault for Claude Code — your AI remembers across sessions, encrypted so only you can read it`

Every new Claude Code session I was re-explaining: "This project uses Fastify, Prisma, deploys to Fly.io, tests in Jest..."

So I built Context Chest — an MCP server that gives Claude persistent memory. But unlike built-in memory, everything is AES-256-GCM encrypted on your machine before being stored. The server never sees plaintext.

Why encrypt? Your AI sees your data temporarily during a session. But a permanent, searchable database of everything you've ever shared? That's a different risk. Encrypt the memory, not the conversation.

Setup takes 30 seconds — just add the MCP config and you get 8 tools: remember, recall, read, forget, browse, and session tracking.

Open source, self-hostable, MIT licensed.

GitHub: https://github.com/fuckupic/context-chest
Demo: https://pwa-one-gold.vercel.app

---

## Reddit r/cursor

**Title:** `I built an encrypted memory vault for Cursor — your AI remembers across sessions, encrypted so only you can read it`

(Same body as r/ClaudeAI, replace "Claude Code" with "Cursor")

---

## Twitter/X Thread

**Post 1:**
I built an encrypted memory vault for AI coding agents.

Your AI forgets everything between sessions. Mine doesn't.

Context Chest = persistent, AES-256 encrypted memory for Claude Code & Cursor.

30-second setup. Open source.

**Post 2:**
The problem:

You paste API keys, revenue numbers, hiring plans, and architecture decisions into AI every day.

That context disappears after each session.
And it's stored in plaintext on someone's server.

**Post 3:**
Context Chest encrypts everything client-side before it leaves your machine.

The server only stores ciphertext. Not even we can read it.

Self-host it for full control.

**Post 4:**
Setup in 30 seconds:

{ "mcpServers": { "context-chest": { "command": "npx", "args": ["@context-chest/mcp-server"] } } }

8 tools: remember, recall, read, forget, browse, sessions.

github.com/fuckupic/context-chest

---

## Posting Schedule

| Day | Channel | Action |
|-----|---------|--------|
| Day 1 | Hacker News | Post Show HN |
| Day 1 | r/ClaudeAI | Post |
| Day 2 | r/cursor | Post |
| Day 2 | Twitter/X | Thread |
| Day 3 | All | Respond to every comment |
| Day 4+ | Discord/MCP communities | Share in channels |
