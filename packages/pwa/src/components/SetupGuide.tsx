import { useState } from 'react';

export const SETUP_CODE = `{
  "mcpServers": {
    "context-chest": {
      "command": "npx",
      "args": ["context-chest-mcp"]
    }
  }
}`;

export const AGENT_INSTRUCTIONS = `## Context Chest — AI Agent Memory Protocol

You have access to Context Chest, an encrypted persistent memory vault via MCP. Your job is to BUILD CONTEXT AUTOMATICALLY — don't wait for "remember this" commands.

### CRITICAL: Passive Context Extraction

As you work with the user, PROACTIVELY extract and store important context you learn from the conversation. You don't need to be asked. Examples:

- User asks to "help with our landing page for Context Chest" → store: business name, what the product does, who it's for
- User mentions "we use Fastify and Prisma" → store: tech stack
- User says "we chose Stripe over Paddle because..." → store: the decision and reasoning
- User discusses pricing at "$20/month for pro tier" → store: pricing model
- User mentions "my co-founder Luky handles design" → store: team structure

**Extract facts, decisions, preferences, and context — even when the user doesn't explicitly ask you to remember.**

Do NOT store every message verbatim. Extract the MEANING — the facts, decisions, and context that would be useful in a future conversation.

### Before Every Response
1. Call \`context-chest_recall\` with keywords relevant to the current request
2. Use recalled context to give better, more informed responses
3. If you have no vault context yet, call \`context-chest_browse\` once to see what's there

### What to Extract and Store (automatically, without being asked)
- **Business context**: what the product/company does, target market, competitors, positioning
- **Technical decisions**: tech stack, architecture choices, deployment setup, conventions
- **People & roles**: team members, their responsibilities, stakeholders
- **Preferences**: coding style, communication preferences, tools they like
- **Key decisions**: what was chosen, what was rejected, and WHY
- **Project state**: current priorities, deadlines, blockers, milestones
- **Domain knowledge**: industry terms, client details, regulatory requirements

### How to Store
- Call \`context-chest_remember\` with the extracted context as content
- Skip the path — auto-routing will put it in the right chest (work, health, finance, personal, tools, learning)
- Write context as clear, factual statements — not conversation transcripts
- Example: "Context Chest is an encrypted memory vault for AI agents. Target market: developers using Claude Code and Cursor. Differentiator: E2E encryption where the server never sees plaintext."

### Available Tools
- \`context-chest_remember\` — Store context (auto-routes to the right chest based on content)
- \`context-chest_recall\` — Search memories by keyword — ALWAYS check before asking the user to repeat themselves
- \`context-chest_read\` — Read full content of a specific memory
- \`context-chest_forget\` — Delete outdated context
- \`context-chest_browse\` — Browse the vault tree

### Rules
- Recall before re-asking — the user may have told you (or a different AI) before
- Store decisions with reasoning: "Chose X because Y" not just "X"
- Update stale context — if something changed, store the new version
- Don't over-store — 2-3 meaningful extractions per conversation is plenty
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

export function SetupGuide({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {/* Terminal login */}
      <div className="border-2 border-cc-border bg-cc-dark">
        <div className="flex items-center gap-3 px-3 py-2 border-b-2 border-cc-border">
          <span className="font-pixel text-sm text-cc-pink">01</span>
          <span className="font-pixel text-[10px] text-cc-white tracking-wider">LOGIN FROM A SEPARATE TERMINAL</span>
        </div>
        <div className="p-3 space-y-2">
          <p className="text-[10px] text-cc-muted">Open a regular terminal (not Claude Code). Run this and enter your email + password:</p>
          <pre className="bg-cc-black border border-cc-border p-2.5 text-xs font-mono text-cc-sub overflow-x-auto">npx context-chest-mcp login</pre>
          <p className="text-[10px] text-cc-muted italic">This saves credentials to ~/.context-chest/credentials.json. Only needed once.</p>
        </div>
      </div>

      {/* MCP Config */}
      <div className="border-2 border-cc-border bg-cc-dark">
        <div className="flex items-center justify-between px-3 py-2 border-b-2 border-cc-border">
          <div className="flex items-center gap-3">
            <span className="font-pixel text-sm text-cc-pink">02</span>
            <span className="font-pixel text-[10px] text-cc-white tracking-wider">ADD MCP CONFIG TO YOUR PROJECT</span>
          </div>
          <CopyButton text={SETUP_CODE} label="COPY" />
        </div>
        <div className="p-3 space-y-2">
          <p className="text-[10px] text-cc-muted">Create a file called <span className="text-cc-white">.mcp.json</span> in your project root folder and paste this:</p>
          <pre className="bg-cc-black border border-cc-border p-2.5 text-xs font-mono text-cc-pink overflow-x-auto leading-relaxed">{SETUP_CODE}</pre>
          <p className="text-[10px] text-cc-muted italic">If .mcp.json already exists, add the "context-chest" block inside "mcpServers".</p>
        </div>
      </div>

      {/* Agent Instructions */}
      <div className="border-2 border-cc-border bg-cc-dark">
        <div className="flex items-center justify-between px-3 py-2 border-b-2 border-cc-border">
          <div className="flex items-center gap-3">
            <span className="font-pixel text-sm text-cc-pink">03</span>
            <span className="font-pixel text-[10px] text-cc-white tracking-wider">ADD INSTRUCTIONS TO CLAUDE.md</span>
          </div>
          <CopyButton text={AGENT_INSTRUCTIONS} label="COPY INSTRUCTIONS" />
        </div>
        <div className="p-3 space-y-2">
          <p className="text-[10px] text-cc-muted">Create or open <span className="text-cc-white">CLAUDE.md</span> in your project root folder. Paste the copied instructions there.</p>
          <p className="text-[10px] text-cc-muted italic">This teaches your AI to automatically extract and remember context from conversations.</p>
        </div>
      </div>

      {/* Restart */}
      <div className="border-2 border-cc-pink bg-cc-dark">
        <div className="flex items-center gap-3 px-3 py-2 border-b-2 border-cc-border">
          <span className="font-pixel text-sm text-cc-pink">04</span>
          <span className="font-pixel text-[10px] text-cc-white tracking-wider">RESTART CLAUDE CODE</span>
        </div>
        <div className="p-3">
          <p className="text-[10px] text-cc-muted">Type <span className="text-cc-white font-mono">/exit</span> in Claude Code, then relaunch it in the same project folder. The MCP tools will load automatically.</p>
        </div>
      </div>

      <p className="text-[10px] text-cc-muted font-mono text-center">
        Restart Claude Code or Cursor after setup.
      </p>
    </div>
  );
}
