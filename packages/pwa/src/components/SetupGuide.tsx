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
          <span className="font-pixel text-[10px] text-cc-white tracking-wider">LOGIN FROM TERMINAL</span>
        </div>
        <div className="p-3">
          <pre className="bg-cc-black border border-cc-border p-2.5 text-xs font-mono text-cc-sub overflow-x-auto">npx context-chest-mcp login</pre>
        </div>
      </div>

      {/* MCP Config */}
      <div className="border-2 border-cc-border bg-cc-dark">
        <div className="flex items-center justify-between px-3 py-2 border-b-2 border-cc-border">
          <div className="flex items-center gap-3">
            <span className="font-pixel text-sm text-cc-pink">02</span>
            <span className="font-pixel text-[10px] text-cc-white tracking-wider">ADD MCP CONFIG</span>
          </div>
          <CopyButton text={SETUP_CODE} label="COPY" />
        </div>
        <pre className="p-3 text-xs font-mono text-cc-pink overflow-x-auto leading-relaxed">{SETUP_CODE}</pre>
      </div>

      {/* Agent Instructions */}
      <div className="border-2 border-cc-border bg-cc-dark">
        <div className="flex items-center justify-between px-3 py-2 border-b-2 border-cc-border">
          <div className="flex items-center gap-3">
            <span className="font-pixel text-sm text-cc-pink">03</span>
            <span className="font-pixel text-[10px] text-cc-white tracking-wider">PASTE INTO CLAUDE.md</span>
          </div>
          <CopyButton text={AGENT_INSTRUCTIONS} label="COPY INSTRUCTIONS" />
        </div>
        <div className="p-3 text-[11px] font-mono text-cc-muted leading-relaxed">
          Your AI will passively extract context from conversations — learning your business, tech stack, preferences, and decisions without being asked.
        </div>
      </div>

      <p className="text-[10px] text-cc-muted font-mono text-center">
        Restart Claude Code or Cursor after setup.
      </p>
    </div>
  );
}
