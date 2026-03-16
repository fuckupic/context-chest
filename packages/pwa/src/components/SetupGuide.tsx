import { useState } from 'react';

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
          Teaches your AI to auto-browse vault, recall memories, store decisions, and auto-route to chests.
        </div>
      </div>

      <p className="text-[10px] text-cc-muted font-mono text-center">
        Restart Claude Code or Cursor after setup.
      </p>
    </div>
  );
}
