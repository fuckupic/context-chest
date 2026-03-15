# Context Chest Launch Posts

## Links
- **Site**: https://contextchest.com
- **API**: https://api-production-e2cd6.up.railway.app
- **GitHub**: https://github.com/fuckupic/context-chest
- **npm**: https://www.npmjs.com/package/context-chest-mcp

---

## Posting Schedule (Updated)

HN restricts new accounts from Show HN. Build karma first, post Show HN in ~1 week.

| Day | Channel | Action |
|-----|---------|--------|
| Day 1 | r/ClaudeAI | Post |
| Day 1 | r/cursor | Post |
| Day 2 | Twitter/X | Thread |
| Day 2 | r/LocalLLaMA | Post (privacy angle) |
| Day 3 | All | Respond to every comment |
| Day 4 | Claude Code Discord | Share in #showcase or #community |
| Day 4 | MCP community channels | Share |
| Day 5+ | HN | Comment on AI/privacy threads to build karma |
| Week 2 | Hacker News | Show HN (once you have some karma) |
| Week 2 | Product Hunt | Only if you have 50+ users to upvote |

---

## Reddit r/ClaudeAI

**Title:** `I built an encrypted memory vault for Claude Code — your AI remembers across sessions, encrypted so only you can read it`

Every new Claude Code session I was re-explaining: "This project uses Fastify, Prisma, deploys to Fly.io, tests in Jest..."

So I built Context Chest — an MCP server that gives Claude persistent memory. But unlike built-in memory, everything is AES-256-GCM encrypted on your machine before being stored. The server never sees plaintext.

Why encrypt? Your AI sees your data temporarily during a session. But a permanent, searchable database of everything you've ever shared? That's a different risk. Encrypt the memory, not the conversation.

Setup:

```
npm install -g context-chest-mcp
context-chest login
```

Then add to your MCP config:

```json
{ "mcpServers": { "context-chest": { "command": "npx", "args": ["context-chest-mcp"] } } }
```

8 tools: remember, recall, read, forget, browse, and session tracking. Works with Claude Code, Cursor, and OpenClaw.

Open source, self-hostable, MIT licensed.

- GitHub: https://github.com/fuckupic/context-chest
- Site: https://contextchest.com

---

## Reddit r/cursor

**Title:** `I built an encrypted memory vault for Cursor — your AI remembers across sessions, encrypted so only you can read it`

(Same body as r/ClaudeAI, replace "Claude Code" with "Cursor" throughout)

---

## Reddit r/LocalLLaMA

**Title:** `Open source encrypted memory for AI agents — works with local models via OpenClaw, data never leaves your machine`

If you run local models through OpenClaw, your data never touches a cloud AI provider. But where does the memory go?

Context Chest gives any AI agent persistent, encrypted memory. AES-256-GCM client-side encryption. Self-hostable. When paired with local LLMs, your data literally never leaves your machine at any point.

- Works with OpenClaw (plugin), Claude Code (MCP), Cursor (MCP), or any REST API client
- One encrypted vault shared across all your AI tools
- MIT licensed, full Docker Compose for self-hosting

For the privacy-conscious: this is the only AI memory system where the server operator can't read your data, even if subpoenaed.

GitHub: https://github.com/fuckupic/context-chest

---

## Twitter/X Thread

**Post 1:**
I built an encrypted memory vault for AI agents.

Your AI forgets everything between sessions. Mine doesn't.

Context Chest = persistent, AES-256 encrypted memory for Claude Code, Cursor & OpenClaw.

Open source. Self-hostable.

contextchest.com

**Post 2:**
The problem:

You paste revenue numbers, hiring plans, API keys, and architecture decisions into AI every day.

That context disappears after each session.
And it's stored in plaintext on someone's server.

**Post 3:**
Context Chest encrypts everything client-side before it leaves your machine.

The server only stores ciphertext. Not even we can read it.

One vault. Every agent. Claude Code stores a memory → Cursor recalls it → OpenClaw uses it.

**Post 4:**
Setup:

npm install -g context-chest-mcp
context-chest login

Then add to MCP config:
{ "mcpServers": { "context-chest": { "command": "npx", "args": ["context-chest-mcp"] } } }

github.com/fuckupic/context-chest

**Post 5 (optional — for engagement):**
What sensitive stuff do you paste into AI that you wish was encrypted?

For us it was:
- Client NDA terms
- Production DB passwords
- Revenue numbers
- Hiring plans

That's why we built this. What's yours?

---

## Hacker News — Show HN (Week 2)

**Title:** `Show HN: Context Chest – Encrypted cross-agent memory for AI coding tools`

**Text:**

We built an encrypted memory layer that works across AI agents — Claude Code, Cursor, OpenClaw, or any MCP/REST client.

The problem: you share sensitive context with AI daily. That context disappears after each session. Memory systems exist, but they store everything in plaintext.

Context Chest encrypts client-side (AES-256-GCM + HKDF key derivation) before anything leaves your machine. The server stores only ciphertext. Self-hostable for full control.

The cross-agent part: a memory stored by Claude Code can be recalled by Cursor or OpenClaw. One encrypted vault, every agent, same keys.

Setup: npm install -g context-chest-mcp && context-chest login

Tech: Fastify, Prisma, PostgreSQL, React PWA. MIT licensed.

Site: https://contextchest.com
GitHub: https://github.com/fuckupic/context-chest

---

## DM Template (for influencers/devs)

Hey! We built Context Chest — an encrypted memory vault for AI agents (Claude Code, Cursor, OpenClaw).

Your AI remembers across sessions, but everything is AES-256 encrypted on your machine before being stored. The server never sees plaintext.

Would love your feedback if you have 2 minutes to try it: contextchest.com

No pressure, just looking for early feedback from people who actually use AI coding tools.

---

## Communities to Join & Post In

- r/ClaudeAI (120k+ members)
- r/cursor (growing fast)
- r/LocalLLaMA (privacy-conscious AI users)
- r/selfhosted (self-hosting angle)
- Claude Code Discord (#showcase)
- OpenClaw Discord
- MCP community channels
- Dev.to (write a tutorial post)
- Indie Hackers (launch story)
