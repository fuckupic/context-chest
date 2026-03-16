import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';

const SETUP_CODE = `{
  "mcpServers": {
    "context-chest": {
      "command": "npx",
      "args": ["context-chest-mcp"]
    }
  }
}`;

const AGENT_INSTRUCTIONS = `## Context Chest — AI Agent Memory Protocol

You have access to Context Chest, an encrypted persistent memory vault via MCP.

### CRITICAL: Memory Protocol
Before responding to ANY user message:
1. Call \`context-chest_browse\` to see what's in the vault
2. Call \`context-chest_recall\` with keywords relevant to the current request

Before ending ANY session or when context is getting long:
- Store key decisions with \`context-chest_remember\` using descriptive paths
- Example: "decisions/chose-stripe-over-paddle", "bugs/auth-fix", "architecture/api-design"

### Available Tools
- \`context-chest_remember\` — Store a memory (content + optional path). Without a path, auto-routes to the right chest (work, health, finance, personal, tools, learning) based on content.
- \`context-chest_recall\` — Search memories by keyword. Always check before asking the user to repeat themselves.
- \`context-chest_read\` — Read full decrypted content of a specific memory.
- \`context-chest_forget\` — Delete a memory you no longer need.
- \`context-chest_browse\` — Browse the vault directory tree.
- \`context-chest_session-start\` — Start tracking a conversation session.
- \`context-chest_session-append\` — Add a message to the current session.
- \`context-chest_session-save\` — Extract memories and close a session.

### Best Practices
- Remember user preferences, project conventions, tech stack choices, and key decisions
- Use descriptive paths: "project/tech-stack", "preferences/coding-style", "clients/acme/database"
- Recall before re-asking — the user may have told you before
- Store decisions with reasoning: "Chose X because Y" not just "X"
- Memories are encrypted end-to-end — the server never sees plaintext`;

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="font-pixel text-[10px] tracking-wider px-3 py-1.5 border-2 border-cc-border text-cc-muted hover:border-cc-pink hover:text-cc-pink transition-colors"
    >
      {copied ? 'COPIED!' : label}
    </button>
  );
}

const FEATURES = [
  { title: 'ENCRYPTED', desc: 'AES-256-GCM on your machine. Server never sees plaintext.' },
  { title: '8 TOOLS', desc: 'Remember, recall, read, forget, browse, sessions.' },
  { title: 'ANY AGENT', desc: 'Claude Code, Cursor, OpenClaw, any MCP or API client. One vault.' },
  { title: 'ORGANIZED', desc: 'Path-based storage. Browse like a filesystem.' },
  { title: 'SEARCHABLE', desc: 'Instant text recall across all memories.' },
  { title: 'OPEN SOURCE', desc: 'MIT licensed. Self-host or use our cloud.' },
];

export function Landing() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleCTA = () => navigate(isAuthenticated ? '/memories' : '/login');

  return (
    <div className="min-h-screen bg-cc-black relative">
      {/* Dither overlay */}
      <div className="fixed inset-0 dither-bg pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between max-w-5xl mx-auto px-6 py-5">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="" className="w-6 h-6" style={{ imageRendering: 'auto' }} />
          <span className="font-pixel text-base text-cc-white tracking-wide">Context Chest</span>
        </div>
        <div className="flex gap-4">
          <a href="/docs" className="font-pixel text-xs text-cc-muted hover:text-cc-pink tracking-wider transition-colors">DOCS</a>
          <button onClick={handleCTA} className="font-pixel text-xs text-cc-muted hover:text-cc-pink tracking-wider transition-colors">
            {isAuthenticated ? 'DASHBOARD' : 'SIGN IN'}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 pt-10 md:pt-16 pb-12 md:pb-20">
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
          {/* Chest image with memory pills — hidden on small mobile, visible from sm+ */}
          <div className="opacity-0 animate-fade-in md:w-1/2 flex justify-center">
            <div className="relative py-4 px-2 md:py-6 md:px-4">
              {/* Floating memories — hidden on mobile, too cramped */}
              <span className="hidden sm:block absolute top-[12%] left-[8%] z-20 px-2 md:px-3 py-1 md:py-1.5 bg-cc-white text-cc-black font-pixel text-[10px] md:text-xs tracking-wider border-2 border-cc-white rotate-[-5deg] shadow-[3px_3px_0_0_rgba(232,69,122,0.5)]">Q3 REVENUE: $2.4M</span>
              <span className="hidden sm:block absolute top-[6%] right-[5%] z-20 px-2 md:px-3 py-1 md:py-1.5 bg-cc-pink text-cc-black font-pixel text-[10px] md:text-xs tracking-wider border-2 border-cc-pink rotate-[3deg] shadow-[3px_3px_0_0_rgba(255,255,255,0.2)]">SK-PROJ-████████</span>

              <span className="hidden sm:block absolute top-[35%] left-[12%] z-20 px-2 md:px-3 py-1 md:py-1.5 bg-cc-dark text-cc-white font-pixel text-[10px] md:text-xs tracking-wider border-2 border-cc-white rotate-[-2deg] shadow-[3px_3px_0_0_#222]">CLIENT NDA</span>
              <span className="hidden sm:block absolute top-[30%] right-[6%] z-20 px-2 md:px-3 py-1 md:py-1.5 bg-cc-white text-cc-black font-pixel text-[10px] md:text-xs tracking-wider border-2 border-cc-white rotate-[4deg] shadow-[3px_3px_0_0_rgba(232,69,122,0.5)]">AWS_SECRET_████</span>
              <span className="hidden sm:block absolute top-[48%] left-[25%] z-20 px-2 md:px-3 py-1 md:py-1.5 bg-cc-pink text-cc-black font-pixel text-[10px] md:text-xs tracking-wider border-2 border-cc-pink rotate-[1deg] shadow-[3px_3px_0_0_rgba(255,255,255,0.2)]">INVESTOR DECK</span>

              <span className="hidden sm:block absolute top-[62%] right-[10%] z-20 px-2 md:px-3 py-1 md:py-1.5 bg-cc-dark text-cc-white font-pixel text-[10px] md:text-xs tracking-wider border-2 border-cc-white rotate-[-3deg] shadow-[3px_3px_0_0_#222]">DB PASSWORD</span>
              <span className="hidden sm:block absolute top-[72%] left-[6%] z-20 px-2 md:px-3 py-1 md:py-1.5 bg-cc-white text-cc-black font-pixel text-[10px] md:text-xs tracking-wider border-2 border-cc-white rotate-[5deg] shadow-[3px_3px_0_0_rgba(232,69,122,0.5)]">HIRING PLAN</span>
              <span className="hidden sm:block absolute top-[78%] right-[18%] z-20 px-2 md:px-3 py-1 md:py-1.5 bg-cc-dark text-cc-white font-pixel text-[10px] md:text-xs tracking-wider border-2 border-cc-white rotate-[-4deg] shadow-[3px_3px_0_0_#222]">ROADMAP</span>
              <span className="hidden sm:block absolute top-[88%] left-[20%] z-20 px-2 md:px-3 py-1 md:py-1.5 bg-cc-pink text-cc-black font-pixel text-[10px] md:text-xs tracking-wider border-2 border-cc-pink rotate-[2deg] shadow-[3px_3px_0_0_rgba(255,255,255,0.2)]">████ ENCRYPTED</span>

              <img
                src="/logo.png"
                alt="Context Chest"
                className="w-48 sm:w-72 md:w-96 relative"
                style={{ imageRendering: 'auto' }}
              />
            </div>
          </div>

          {/* Text */}
          <div className="md:w-1/2 text-center md:text-left">
            <h1 className="opacity-0 animate-fade-up font-pixel text-3xl sm:text-4xl md:text-6xl text-cc-white leading-none mb-4 md:mb-6 tracking-wide">
              AI processes.<br />
              Memory <span className="text-cc-pink">persists.</span><br />
              Encrypt it.
            </h1>
            <p className="opacity-0 animate-fade-up stagger-1 text-cc-sub text-xs sm:text-sm leading-relaxed mb-6 md:mb-8 max-w-sm mx-auto md:mx-0">
              Your AI sees your secrets temporarily. But a permanent, searchable
              database of everything you've ever shared? That's a different risk.
              Context Chest encrypts your AI's memory so even a full breach
              reveals nothing. Self-host it. Own your keys.
            </p>
            <div className="opacity-0 animate-fade-up stagger-2 flex gap-3 justify-center md:justify-start">
              <button
                onClick={handleCTA}
                className="px-5 md:px-6 py-2.5 bg-cc-pink text-cc-black font-pixel text-xs sm:text-sm tracking-wider hover:bg-cc-pink-dim transition-colors"
              >
                {isAuthenticated ? 'OPEN DASHBOARD' : 'GET STARTED'}
              </button>
              <a
                href="https://github.com/fuckupic/context-chest"
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 md:px-6 py-2.5 border-2 border-cc-border text-cc-muted font-pixel text-xs sm:text-sm tracking-wider hover:border-cc-pink hover:text-cc-pink transition-colors"
              >
                GITHUB
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="border-t-2 border-cc-border border-dashed" />
      </div>

      {/* Setup */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <p className="font-pixel text-xs text-cc-muted tracking-[0.3em] mb-4 text-center">30 SECOND SETUP</p>

        {/* MCP Config */}
        <div className="border-2 border-cc-border bg-cc-dark mb-4">
          <div className="flex items-center justify-between px-3 py-2 border-b-2 border-cc-border">
            <span className="font-pixel text-[10px] text-cc-muted tracking-wider">.mcp.json</span>
            <CopyButton text={SETUP_CODE} label="COPY CONFIG" />
          </div>
          <pre className="p-4 text-sm font-mono text-cc-pink overflow-x-auto leading-relaxed">{SETUP_CODE}</pre>
        </div>

        {/* Agent Instructions */}
        <div className="border-2 border-cc-border bg-cc-dark">
          <div className="flex items-center justify-between px-3 py-2 border-b-2 border-cc-border">
            <span className="font-pixel text-[10px] text-cc-muted tracking-wider">CLAUDE.md / AGENTS.md</span>
            <CopyButton text={AGENT_INSTRUCTIONS} label="COPY AGENT INSTRUCTIONS" />
          </div>
          <div className="p-4 text-xs font-mono text-cc-sub leading-relaxed max-h-48 overflow-y-auto">
            <p className="text-cc-white mb-2">Paste into your CLAUDE.md or AGENTS.md to teach your AI how to use Context Chest:</p>
            <ul className="space-y-1 text-cc-muted">
              <li>- Auto-browse vault before every response</li>
              <li>- Auto-recall relevant memories for current task</li>
              <li>- Store decisions, preferences, and project context</li>
              <li>- Auto-route memories to the right chest (work, health, finance...)</li>
              <li>- Use descriptive paths for organization</li>
            </ul>
          </div>
        </div>

        <p className="text-center text-xs text-cc-muted mt-3">
          Add MCP config to Claude Code or Cursor. Paste agent instructions into CLAUDE.md.
        </p>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="border-t-2 border-cc-border border-dashed" />
      </div>

      {/* Works with */}
      <section className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <h2 className="font-pixel text-2xl md:text-3xl text-cc-white text-center mb-4 tracking-wide">
          ONE VAULT. <span className="text-cc-pink">EVERY AGENT.</span>
        </h2>
        <p className="text-center text-[11px] md:text-xs text-cc-muted mb-10">
          Store a memory from Claude Code. Recall it from Cursor. Browse it from OpenClaw. All encrypted.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-cc-border">
          {[
            { name: 'CLAUDE CODE', status: 'MCP server', supported: true },
            { name: 'CURSOR', status: 'MCP server', supported: true },
            { name: 'OPENCLAW', status: 'Plugin', supported: true },
            { name: 'ANY REST API', status: 'HTTP client', supported: true },
          ].map((agent) => (
            <div key={agent.name} className="bg-cc-black p-5 text-center hover:bg-cc-surface transition-colors group">
              <h3 className="font-pixel text-sm text-cc-white tracking-wider mb-1 group-hover:text-cc-pink transition-colors">{agent.name}</h3>
              <p className="text-[10px] text-cc-muted font-mono">{agent.status}</p>
            </div>
          ))}
        </div>
        <div className="border-2 border-cc-border bg-cc-dark mt-6 p-4">
          <p className="font-pixel text-[10px] text-cc-muted tracking-wider mb-3">HOW CROSS-AGENT MEMORY WORKS</p>
          <pre className="text-[9px] sm:text-[11px] font-mono text-cc-sub leading-relaxed overflow-x-auto">{'Claude Code ──▶ Context Chest ◀── OpenClaw\n        │            │            │\n        │    ┌───────┴───────┐    │\n        │    │ Encrypted     │    │\n        │    │ Vault (AES)   │    │\n        │    │ ████████████  │    │\n        │    └───────┬───────┘    │\n        │            │            │\nCursor ─────▶ Same keys ◀─── REST API'}</pre>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="border-t-2 border-cc-border border-dashed" />
      </div>

      {/* Features */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <h2 className="font-pixel text-2xl md:text-3xl text-cc-white text-center mb-8 md:mb-12 tracking-wide">
          WHAT'S IN THE <span className="text-cc-pink">CHEST</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-px bg-cc-border">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-cc-black p-6 hover:bg-cc-surface transition-colors group">
              <h3 className="font-pixel text-base text-cc-white mb-2 tracking-wider group-hover:text-cc-pink transition-colors">
                {f.title}
              </h3>
              <p className="text-xs text-cc-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="border-t-2 border-cc-border border-dashed" />
      </div>

      {/* Use cases */}
      <section className="relative z-10 max-w-5xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <h2 className="font-pixel text-2xl md:text-3xl text-cc-white text-center mb-8 md:mb-12 tracking-wide">
          WHO IT'S <span className="text-cc-pink">FOR</span>
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            {
              who: 'DEVELOPERS',
              what: 'Your AI remembers your stack, conventions, and past decisions. No more re-explaining your architecture every session.',
              example: '"Remember: we use Fastify, not Express, and deploy to Fly.io"',
            },
            {
              who: 'FOUNDERS & PMs',
              what: 'You paste revenue numbers, hiring plans, and strategy into AI daily. Context Chest encrypts it before it leaves your machine.',
              example: '"Remember: Q3 revenue $2.4M, targeting break-even by Q1 2027"',
            },
            {
              who: 'FREELANCERS',
              what: 'Juggle 5 client projects. Your AI switches context instantly. Client A\'s secrets never leak into client B\'s session.',
              example: '"Remember: Acme Corp uses PostgreSQL, Widget Inc uses MongoDB"',
            },
            {
              who: 'REGULATED INDUSTRIES',
              what: 'Healthcare, finance, legal. AES-256-GCM, keys on your machine, server sees only ciphertext. Your compliance team can breathe.',
              example: '"Remember: patient data schema uses field-level encryption"',
            },
          ].map((uc) => (
            <div key={uc.who} className="border-2 border-cc-border bg-cc-dark p-5 hover:border-cc-pink-border transition-colors group">
              <h3 className="font-pixel text-sm text-cc-white tracking-wider mb-2 group-hover:text-cc-pink transition-colors">{uc.who}</h3>
              <p className="text-xs text-cc-sub leading-relaxed mb-3">{uc.what}</p>
              <p className="text-[11px] text-cc-pink font-mono italic">{uc.example}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="border-t-2 border-cc-border border-dashed" />
      </div>

      {/* How it works */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <h2 className="font-pixel text-2xl md:text-3xl text-cc-white text-center mb-8 md:mb-12 tracking-wide">
          HOW IT <span className="text-cc-pink">WORKS</span>
        </h2>
        <div className="space-y-6">
          {[
            { n: '01', title: 'AI PROCESSES TEMPORARILY', desc: 'Your AI provider sees your data during a session. That\'s the deal you already made.' },
            { n: '02', title: 'MEMORY PERSISTS FOREVER', desc: 'But a permanent database of all your secrets is a bigger target. Context Chest encrypts it client-side with AES-256-GCM.' },
            { n: '03', title: 'BREACH REVEALS NOTHING', desc: 'Even if the server is compromised, attackers get ciphertext. Your keys stay on your machine. Self-host for full control.' },
          ].map((item) => (
            <div key={item.n} className="flex gap-5 items-start border-2 border-cc-border p-4 hover:border-cc-pink-border transition-colors">
              <span className="font-pixel text-2xl text-cc-pink shrink-0">{item.n}</span>
              <div>
                <h3 className="font-pixel text-sm text-cc-white tracking-wider mb-1">{item.title}</h3>
                <p className="text-xs text-cc-muted leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Real examples */}
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="border-t-2 border-cc-border border-dashed" />
      </div>
      <section className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <h2 className="font-pixel text-2xl md:text-3xl text-cc-white text-center mb-4 tracking-wide">
          SEE IT IN <span className="text-cc-pink">ACTION</span>
        </h2>
        <p className="text-center text-xs text-cc-muted mb-12">Real conversations with Claude Code + Context Chest</p>

        <div className="space-y-8">
          {/* Example 1 */}
          <div className="border-2 border-cc-border bg-cc-dark p-5">
            <p className="font-pixel text-[10px] text-cc-muted tracking-wider mb-4">EXAMPLE 1 — REMEMBER PROJECT CONTEXT</p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="font-pixel text-[10px] text-cc-pink shrink-0 w-12">YOU:</span>
                <p className="text-sm text-cc-text">"Remember that this project uses Fastify with Prisma, deploys to Railway, and we always use Zod for validation"</p>
              </div>
              <div className="flex gap-3">
                <span className="font-pixel text-[10px] text-cc-sub shrink-0 w-12">AI:</span>
                <p className="text-sm text-cc-sub">Remembered at project/stack. Encrypted and stored.</p>
              </div>
              <div className="border-t border-cc-border my-2" />
              <p className="text-[11px] text-cc-muted italic">Next session — different day, different conversation:</p>
              <div className="flex gap-3">
                <span className="font-pixel text-[10px] text-cc-pink shrink-0 w-12">YOU:</span>
                <p className="text-sm text-cc-text">"Add a new endpoint for user profiles"</p>
              </div>
              <div className="flex gap-3">
                <span className="font-pixel text-[10px] text-cc-sub shrink-0 w-12">AI:</span>
                <p className="text-sm text-cc-sub">I see from your vault that you use Fastify + Prisma with Zod validation. I'll follow that pattern...</p>
              </div>
            </div>
          </div>

          {/* Example 2 */}
          <div className="border-2 border-cc-border bg-cc-dark p-5">
            <p className="font-pixel text-[10px] text-cc-muted tracking-wider mb-4">EXAMPLE 2 — RECALL A PAST DECISION</p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="font-pixel text-[10px] text-cc-pink shrink-0 w-12">YOU:</span>
                <p className="text-sm text-cc-text">"Why did we choose Stripe over Paddle?"</p>
              </div>
              <div className="flex gap-3">
                <span className="font-pixel text-[10px] text-cc-sub shrink-0 w-12">AI:</span>
                <p className="text-sm text-cc-sub">Searching your vault... Found at decisions/payments: "Chose Stripe because Paddle doesn't support marketplace payouts for our multi-vendor model."</p>
              </div>
            </div>
          </div>

          {/* Example 3 */}
          <div className="border-2 border-cc-border bg-cc-dark p-5">
            <p className="font-pixel text-[10px] text-cc-muted tracking-wider mb-4">EXAMPLE 3 — BROWSE YOUR VAULT</p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <span className="font-pixel text-[10px] text-cc-pink shrink-0 w-12">YOU:</span>
                <p className="text-sm text-cc-text">"What's in my vault?"</p>
              </div>
              <div className="flex gap-3">
                <span className="font-pixel text-[10px] text-cc-sub shrink-0 w-12">AI:</span>
                <pre className="text-sm text-cc-sub font-mono">{'project/\n  stack\n  architecture\n  deploy-config\ndecisions/\n  payments\n  auth-provider\npreferences/\n  coding-style'}</pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick start guide */}
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="border-t-2 border-cc-border border-dashed" />
      </div>
      <section className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <h2 className="font-pixel text-2xl md:text-3xl text-cc-white text-center mb-8 md:mb-12 tracking-wide">
          QUICK <span className="text-cc-pink">START</span>
        </h2>
        <div className="space-y-4">
          {[
            { n: '01', cmd: 'Create your account', code: 'contextchest.com → Sign up' },
            { n: '02', cmd: 'Login from terminal', code: 'npm install -g context-chest-mcp && context-chest login' },
            { n: '03', cmd: 'Add MCP config', code: '{ "mcpServers": { "context-chest": {\n  "command": "npx",\n  "args": ["context-chest-mcp"]\n}}}' },
            { n: '04', cmd: 'Restart your AI tool', code: 'Claude Code: /exit → relaunch\nCursor: restart' },
            { n: '05', cmd: 'Start remembering', code: '"Remember that I prefer TypeScript\n and always use Tailwind"' },
          ].map((step) => (
            <div key={step.n} className="flex gap-4 items-start">
              <span className="font-pixel text-xl text-cc-pink shrink-0 w-8">{step.n}</span>
              <div className="flex-1">
                <p className="font-pixel text-xs text-cc-white tracking-wider mb-1.5">{step.cmd.toUpperCase()}</p>
                <pre className="bg-cc-surface border border-cc-border p-3 text-[12px] font-mono text-cc-sub overflow-x-auto">{step.code}</pre>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Developer notes */}
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="border-t-2 border-cc-border border-dashed" />
      </div>
      <section className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-16">
        <h2 className="font-pixel text-2xl md:text-3xl text-cc-white text-center mb-8 md:mb-12 tracking-wide">
          UNDER THE <span className="text-cc-pink">HOOD</span>
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border-2 border-cc-border bg-cc-dark p-5">
            <h3 className="font-pixel text-sm text-cc-white tracking-wider mb-3">ENCRYPTION MODEL</h3>
            <pre className="text-[11px] font-mono text-cc-sub leading-relaxed">{'Master Key (256-bit random)\n  │\n  ├─ HKDF(exportKey, userId)\n  │  → wrapping key\n  │  → wraps master key for storage\n  │\n  └─ HKDF(masterKey, memoryURI)\n     → per-item AES-256-GCM key\n     → encrypts content'}</pre>
          </div>
          <div className="border-2 border-cc-border bg-cc-dark p-5">
            <h3 className="font-pixel text-sm text-cc-white tracking-wider mb-3">WHAT THE SERVER SEES</h3>
            <div className="space-y-2 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-cc-muted">URI path</span>
                <span className="text-green-400">project/stack</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cc-muted">Category label</span>
                <span className="text-green-400">project: stack</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cc-muted">Word count</span>
                <span className="text-green-400">~24 words</span>
              </div>
              <div className="flex justify-between">
                <span className="text-cc-muted">Content</span>
                <span className="text-cc-pink">████████████</span>
              </div>
              <div className="border-t border-cc-border my-1" />
              <p className="text-cc-muted">Server stores ciphertext only. Category labels are derived from the path you choose — never from actual content.</p>
            </div>
          </div>
          <div className="border-2 border-cc-border bg-cc-dark p-5">
            <h3 className="font-pixel text-sm text-cc-white tracking-wider mb-3">TECH STACK</h3>
            <div className="space-y-1.5 text-[11px] font-mono text-cc-sub">
              <p><span className="text-cc-pink">API</span> — Fastify + Prisma + PostgreSQL</p>
              <p><span className="text-cc-pink">MCP</span> — @modelcontextprotocol/sdk</p>
              <p><span className="text-cc-pink">CRYPTO</span> — Node.js crypto (AES-256-GCM + HKDF)</p>
              <p><span className="text-cc-pink">PWA</span> — React + Tailwind + Vite</p>
              <p><span className="text-cc-pink">AUTH</span> — JWT + refresh token rotation</p>
              <p><span className="text-cc-pink">DEPLOY</span> — Railway (API) + Vercel (PWA)</p>
            </div>
          </div>
          <div className="border-2 border-cc-border bg-cc-dark p-5">
            <h3 className="font-pixel text-sm text-cc-white tracking-wider mb-3">SELF-HOST IT</h3>
            <pre className="text-[11px] font-mono text-cc-sub leading-relaxed">{'git clone github.com/fuckupic/\n  context-chest\n\ndocker-compose up -d\nnpm install\ncp .env.example .env\nnpx prisma migrate dev\nnpm run dev'}</pre>
            <p className="text-[11px] text-cc-muted mt-3">Full control. Your infra, your keys, your data. MIT licensed.</p>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="border-t-2 border-cc-border border-dashed" />
      </div>

      {/* CTA */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 py-12 md:py-20 text-center">
        <h2 className="font-pixel text-2xl sm:text-4xl md:text-5xl text-cc-white mb-4 tracking-wide">
          YOUR AI REMEMBERS.<br /><span className="text-cc-pink">NOBODY ELSE CAN READ IT.</span>
        </h2>
        <p className="text-cc-muted text-sm mb-8">Open source. Self-hostable. Your keys, your data.</p>
        <button
          onClick={handleCTA}
          className="px-8 py-3 bg-cc-pink text-cc-black font-pixel text-sm tracking-wider hover:bg-cc-pink-dim transition-colors"
        >
          {isAuthenticated ? 'OPEN DASHBOARD' : 'GET STARTED FREE'}
        </button>
      </section>

      {/* Founders */}
      <section className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 py-10 md:py-16 text-center">
        <p className="font-pixel text-[10px] text-cc-muted tracking-[0.3em] mb-8">BUILT BY</p>
        <div className="flex justify-center gap-12">
          <div>
            <img src="/tady.png" alt="Tady" className="w-24 h-24 border-2 border-cc-border mx-auto mb-3" style={{ imageRendering: 'auto' }} />
            <p className="font-pixel text-sm text-cc-white tracking-wider">TADY</p>
            <p className="text-[11px] text-cc-muted">Co-founder</p>
          </div>
          <div>
            <img src="/luky.png" alt="Luky" className="w-24 h-24 border-2 border-cc-border mx-auto mb-3" style={{ imageRendering: 'auto' }} />
            <p className="font-pixel text-sm text-cc-white tracking-wider">LUKY</p>
            <p className="text-[11px] text-cc-muted">Co-founder</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t-2 border-cc-border py-6 text-center">
        <p className="font-pixel text-[10px] text-cc-muted tracking-wider">
          CONTEXT CHEST &middot; MIT LICENSE &middot;{' '}
          <a href="https://github.com/fuckupic/context-chest" className="text-cc-pink hover:underline" target="_blank" rel="noopener noreferrer">
            GITHUB
          </a>
          {' '}&middot;{' '}
          <a href="https://www.feedsea.com/submit/feedback/ad2ca0f3-23df-4362-8e95-5778ca3a85ac" className="text-cc-pink hover:underline" target="_blank" rel="noopener noreferrer">
            FEEDBACK
          </a>
        </p>
      </footer>
    </div>
  );
}
