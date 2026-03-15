import { Link } from 'react-router-dom';

const SECTIONS = [
  {
    id: 'overview',
    title: 'WHAT IS CONTEXT CHEST',
    content: `Context Chest is an encrypted memory layer for AI agents. It lets Claude Code, Cursor, OpenClaw, and any API client store and retrieve memories across sessions — encrypted client-side with AES-256-GCM so the server never sees plaintext.

Your AI forgets everything between sessions. Context Chest fixes that — without compromising your privacy.`,
  },
  {
    id: 'setup-claude',
    title: 'SETUP: CLAUDE CODE / CURSOR',
    content: `1. Create an account at the Context Chest dashboard
2. Run the login command:`,
    code: 'npx context-chest-mcp login',
    content2: `3. Add to your MCP config (.mcp.json or cursor settings):`,
    code2: `{
  "mcpServers": {
    "context-chest": {
      "command": "npx",
      "args": ["context-chest-mcp"]
    }
  }
}`,
    content3: `4. Restart your AI tool. You now have 8 encrypted memory tools available.`,
  },
  {
    id: 'setup-openclaw',
    title: 'SETUP: OPENCLAW',
    content: `1. Create an account and run npx context-chest-mcp login
2. Open ~/.context-chest/credentials.json and note your apiToken, exportKey, and userId
3. Add to your OpenClaw config (~/.openclaw/config.yaml):`,
    code: `plugins:
  context-chest:
    apiToken: "your-jwt-token"
    exportKey: "your-export-key-hex"
    userId: "your-user-id"`,
    content2: `4. Restart OpenClaw. You now have 5 encrypted memory tools: remember, read, recall, browse, forget.`,
  },
  {
    id: 'setup-api',
    title: 'SETUP: REST API (ANY CLIENT)',
    content: `Any HTTP client can use Context Chest. Authenticate with a JWT token and call the API directly:`,
    code: `# Remember
curl -X POST https://api-production-e2cd6.up.railway.app/v1/memory/remember \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"uri":"project/stack","l0":"project: stack","l1":"...","encryptedL2":"BASE64...","sha256":"..."}'

# Recall
curl -X POST .../v1/memory/recall \\
  -d '{"query":"stack","limit":10,"offset":0}'

# Browse
curl .../v1/memory/browse?path=&depth=2

# Read content
curl .../v1/memory/content/project/stack

# Forget
curl -X DELETE .../v1/memory/forget/project/stack`,
    content2: `Note: For true E2E encryption, implement AES-256-GCM encryption client-side before sending. See the MCP server crypto module for reference.`,
  },
  {
    id: 'tools',
    title: 'AVAILABLE TOOLS',
    content: null,
    table: [
      ['remember', 'Store an encrypted memory at a path', 'content, path'],
      ['recall', 'Search memories by keyword', 'query'],
      ['read', 'Decrypt and return a memory', 'uri'],
      ['forget', 'Delete a memory', 'uri'],
      ['browse', 'List memories as directory tree', 'path (optional)'],
      ['session-start', 'Begin tracking a conversation', '—'],
      ['session-append', 'Add message to active session', 'sessionId, role, content'],
      ['session-save', 'Extract memories and close session', 'sessionId, memories'],
    ],
  },
  {
    id: 'encryption',
    title: 'ENCRYPTION MODEL',
    content: `Context Chest uses a three-layer key derivation model:`,
    code: `Master Key (256-bit random, generated on your machine)
  │
  ├─ HKDF(exportKey, userId) → wrapping key
  │  └─ AES-256-GCM wraps master key for server storage
  │
  └─ HKDF(masterKey, memoryURI) → per-item key
     └─ AES-256-GCM encrypts content

What the server stores:
  ✓ URI path (you choose it)     → "project/stack"
  ✓ Category label (from URI)    → "project: stack"
  ✓ Word count                   → "~24 words"
  ✗ Actual content               → ████████████`,
    content2: `The server never sees your content. Not even the operators can read it. Self-host for full control.`,
  },
  {
    id: 'cross-agent',
    title: 'CROSS-AGENT MEMORY',
    content: `Context Chest is the only encrypted memory vault that works across multiple AI agents. A memory stored by Claude Code can be recalled by OpenClaw or Cursor — all using the same encryption keys.

How it works:
- All clients derive the same per-item encryption keys from your master key
- The master key is wrapped with your credentials and stored (encrypted) on the server
- Each client unwraps the master key locally using your exportKey + userId
- The server only ever sees ciphertext — regardless of which agent is reading or writing

Use cases:
- Claude Code stores your project architecture → Cursor recalls it for code generation
- OpenClaw remembers a meeting decision → Claude Code uses it when implementing
- Any agent stores preferences → all agents share them`,
  },
  {
    id: 'self-host',
    title: 'SELF-HOSTING',
    content: `Run Context Chest on your own infrastructure for full control:`,
    code: `git clone https://github.com/fuckupic/context-chest
cd context-chest

# Start Postgres and supporting services
docker-compose up -d

# Install and configure
npm install
cp .env.example .env    # Edit with your own JWT_SECRET

# Run migrations and start
npx prisma migrate dev
npm run dev`,
    content2: `The API runs on port 3002. Point your MCP config or OpenClaw plugin to your own URL instead of the hosted API.

Environment variables (.env):
- DATABASE_URL — PostgreSQL connection string
- JWT_SECRET — Random secret for signing tokens
- S3_ENDPOINT — (Optional) S3-compatible storage for blobs
- PORT — API server port (default: 3002)`,
  },
  {
    id: 'faq',
    title: 'FAQ',
    content: null,
    faq: [
      ['If my AI already sees my data, why encrypt the memory?', 'Your AI processes data temporarily during a session. But a permanent, searchable database of everything you\'ve ever shared is a much bigger target. One breach = all your secrets, organized and searchable. Encryption means a breach reveals nothing.'],
      ['Can I use this without the hosted service?', 'Yes. Self-host it with Docker Compose. Your server, your database, your keys. The MCP server and OpenClaw plugin work with any Context Chest API URL.'],
      ['What happens if I lose my credentials?', 'Your master key is wrapped with a key derived from your password. If you lose your password, your encrypted memories cannot be recovered. This is by design — even we can\'t help you, because we never had your key.'],
      ['Is there a free tier?', 'The hosted service is free during alpha. Self-hosting is always free (MIT license).'],
      ['Does it work with local LLMs?', 'Yes. If you use Ollama, LMStudio, or any local model through OpenClaw, your data never leaves your machine at any point — not to an AI provider, and not to Context Chest (if self-hosted).'],
      ['How is this different from OpenViking?', 'OpenViking is an open-source context database (filesystem paradigm, vector search, L0/L1/L2 loading). Context Chest adds client-side encryption, user accounts, a hosted service, a dashboard, and cross-agent support. OpenViking stores plaintext — Context Chest encrypts.'],
    ],
  },
];

export function Docs() {
  return (
    <div className="min-h-screen bg-cc-black relative">
      <div className="fixed inset-0 dither-bg pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between max-w-5xl mx-auto px-6 py-5">
        <Link to="/" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="w-6 h-6" style={{ imageRendering: 'auto' }} />
          <span className="font-pixel text-base text-cc-white tracking-wide">Context Chest</span>
        </Link>
        <div className="flex gap-4">
          <Link to="/" className="font-pixel text-xs text-cc-muted hover:text-cc-pink tracking-wider transition-colors">HOME</Link>
          <a href="https://github.com/fuckupic/context-chest" target="_blank" rel="noopener noreferrer" className="font-pixel text-xs text-cc-muted hover:text-cc-pink tracking-wider transition-colors">GITHUB</a>
        </div>
      </nav>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-8">
        <h1 className="font-pixel text-4xl text-cc-white tracking-wide mb-4">DOCS</h1>
        <p className="text-cc-sub text-sm mb-10">Everything you need to get started with Context Chest.</p>

        {/* TOC */}
        <div className="border-2 border-cc-border bg-cc-dark p-4 mb-12">
          <p className="font-pixel text-[10px] text-cc-muted tracking-wider mb-3">TABLE OF CONTENTS</p>
          <div className="space-y-1">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="block text-sm text-cc-sub hover:text-cc-pink transition-colors">
                {s.title}
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-16">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id}>
              <h2 className="font-pixel text-xl text-cc-white tracking-wider mb-4 pb-2 border-b-2 border-cc-border">
                {s.title}
              </h2>

              {s.content && (
                <p className="text-sm text-cc-sub leading-relaxed whitespace-pre-line mb-4">{s.content}</p>
              )}

              {s.code && (
                <pre className="bg-cc-dark border-2 border-cc-border p-4 text-[12px] font-mono text-cc-pink overflow-x-auto leading-relaxed mb-4">{s.code}</pre>
              )}

              {s.content2 && (
                <p className="text-sm text-cc-sub leading-relaxed whitespace-pre-line mb-4">{s.content2}</p>
              )}

              {s.code2 && (
                <pre className="bg-cc-dark border-2 border-cc-border p-4 text-[12px] font-mono text-cc-pink overflow-x-auto leading-relaxed mb-4">{s.code2}</pre>
              )}

              {s.content3 && (
                <p className="text-sm text-cc-sub leading-relaxed whitespace-pre-line">{s.content3}</p>
              )}

              {s.table && (
                <div className="border-2 border-cc-border bg-cc-dark overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b-2 border-cc-border">
                        <th className="text-left px-4 py-2 font-pixel text-[10px] text-cc-muted tracking-wider">TOOL</th>
                        <th className="text-left px-4 py-2 font-pixel text-[10px] text-cc-muted tracking-wider">DESCRIPTION</th>
                        <th className="text-left px-4 py-2 font-pixel text-[10px] text-cc-muted tracking-wider">PARAMS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.table.map((row) => (
                        <tr key={row[0]} className="border-b border-cc-border hover:bg-cc-surface transition-colors">
                          <td className="px-4 py-2 font-mono text-cc-pink">{row[0]}</td>
                          <td className="px-4 py-2 text-cc-sub">{row[1]}</td>
                          <td className="px-4 py-2 font-mono text-cc-muted">{row[2]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {s.faq && (
                <div className="space-y-4">
                  {s.faq.map(([q, a]) => (
                    <div key={q} className="border-2 border-cc-border bg-cc-dark p-4">
                      <p className="font-pixel text-xs text-cc-white tracking-wider mb-2">{q}</p>
                      <p className="text-xs text-cc-sub leading-relaxed">{a}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t-2 border-cc-border py-6 text-center mt-16">
        <p className="font-pixel text-[10px] text-cc-muted tracking-wider">
          CONTEXT CHEST &middot; MIT LICENSE &middot;{' '}
          <a href="https://github.com/fuckupic/context-chest" className="text-cc-pink hover:underline" target="_blank" rel="noopener noreferrer">
            GITHUB
          </a>
        </p>
      </footer>
    </div>
  );
}
