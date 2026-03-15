import { useState, useEffect } from 'react';
import { useAuth } from '../auth/context';
import { AgentCard } from '../components/AgentCard';
import { GrantCard } from '../components/GrantCard';
import { EmptyState } from '../components/EmptyState';

interface Grant { id: string; clientName: string; clientId: string; role: string; createdAt: string; expiresAt: string; }
interface Agent { id: string; agentName: string; firstSeenAt: string; lastSeenAt: string; requestCount: number; }

const MCP_CONFIG = `{
  "mcpServers": {
    "context-chest": {
      "command": "npx",
      "args": ["context-chest-mcp"]
    }
  }
}`;

export function Agents() {
  const { client } = useAuth();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!client) return;
    Promise.all([
      client.listGrants().catch(() => ({ grants: [] })),
      client.listAgents().catch(() => ({ agents: [] })),
    ]).then(([g, a]) => { setGrants(g.grants); setAgents(a.agents); }).finally(() => setLoading(false));
  }, [client]);

  const handleRevoke = async (id: string) => {
    if (!client) return;
    setRevokingId(id);
    try { await client.revokeGrant(id); setGrants((p) => p.filter((g) => g.id !== id)); } finally { setRevokingId(null); }
  };

  const handleDisconnect = async (id: string) => {
    if (!client) return;
    setDisconnectingId(id);
    try { await client.disconnectAgent(id); setAgents((p) => p.filter((a) => a.id !== id)); } finally { setDisconnectingId(null); }
  };

  if (loading) return <div className="flex items-center justify-center h-full text-cc-muted font-pixel text-sm">LOADING...</div>;

  const hasConnections = agents.length > 0 || grants.length > 0;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="font-pixel text-xl text-cc-white tracking-wider mb-6">AGENTS</h1>

      {hasConnections ? (
        <>
          {agents.length > 0 && (
            <div className="space-y-2 mb-6">
              {agents.map((a) => (
                <AgentCard key={a.id} {...a} onDisconnect={handleDisconnect} disconnecting={disconnectingId === a.id} />
              ))}
            </div>
          )}
          {grants.length > 0 && (
            <>
              {agents.length > 0 && <p className="font-pixel text-[10px] text-cc-muted tracking-wider mb-2 mt-8">OAUTH GRANTS</p>}
              <div className="space-y-2 mb-8">
                {grants.map((g) => <GrantCard key={g.id} {...g} onRevoke={handleRevoke} revoking={revokingId === g.id} />)}
              </div>
            </>
          )}
        </>
      ) : (
        <EmptyState message="No agents connected. Add Context Chest to your AI tool." />
      )}

      <div className="mt-8">
        <p className="font-pixel text-[10px] text-cc-muted tracking-wider mb-3">CONNECT NEW AGENT</p>
        <p className="text-cc-muted text-xs mb-3">Add to Claude Code or Cursor MCP config:</p>
        <div className="relative border-2 border-cc-border bg-cc-dark">
          <div className="flex items-center px-3 py-1.5 border-b-2 border-cc-border">
            <span className="font-pixel text-[10px] text-cc-muted tracking-wider">.mcp.json</span>
          </div>
          <pre className="p-4 text-xs font-mono text-cc-pink overflow-x-auto">{MCP_CONFIG}</pre>
          <button
            onClick={() => { navigator.clipboard.writeText(MCP_CONFIG); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="absolute top-1.5 right-2 px-2 py-0.5 border border-cc-border font-pixel text-[9px] text-cc-muted tracking-wider hover:text-cc-pink hover:border-cc-pink-border transition-colors"
          >
            {copied ? 'COPIED' : 'COPY'}
          </button>
        </div>
      </div>
    </div>
  );
}
