import { useState, useEffect } from 'react';
import { useAuth } from '../auth/context';
import { GrantCard } from '../components/GrantCard';
import { AgentCard } from '../components/AgentCard';
import { EmptyState } from '../components/EmptyState';

interface Grant {
  id: string;
  clientName: string;
  clientId: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

interface Agent {
  id: string;
  agentName: string;
  firstSeenAt: string;
  lastSeenAt: string;
  requestCount: number;
}

const MCP_CONFIG = `{
  "mcpServers": {
    "context-chest": {
      "command": "npx",
      "args": ["@context-chest/mcp-server"]
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
    ])
      .then(([grantResult, agentResult]) => {
        setGrants(grantResult.grants);
        setAgents(agentResult.agents);
      })
      .finally(() => setLoading(false));
  }, [client]);

  const handleRevoke = async (id: string) => {
    if (!client) return;
    setRevokingId(id);
    try {
      await client.revokeGrant(id);
      setGrants((prev) => prev.filter((g) => g.id !== id));
    } finally {
      setRevokingId(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!client) return;
    setDisconnectingId(id);
    try {
      await client.disconnectAgent(id);
      setAgents((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setDisconnectingId(null);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(MCP_CONFIG);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-vault-muted">Loading...</div>;
  }

  const hasConnections = agents.length > 0 || grants.length > 0;

  return (
    <div className="max-w-2xl mx-auto p-8">
      <h1 className="text-xl font-bold mb-6">Connected Agents</h1>

      {hasConnections ? (
        <>
          {agents.length > 0 && (
            <div className="space-y-3 mb-6">
              {agents.map((a) => (
                <AgentCard
                  key={a.id}
                  {...a}
                  onDisconnect={handleDisconnect}
                  disconnecting={disconnectingId === a.id}
                />
              ))}
            </div>
          )}
          {grants.length > 0 && (
            <>
              {agents.length > 0 && (
                <h2 className="text-sm font-medium text-vault-muted uppercase mb-3 mt-8">OAuth Grants</h2>
              )}
              <div className="space-y-3 mb-8">
                {grants.map((g) => (
                  <GrantCard key={g.id} {...g} onRevoke={handleRevoke} revoking={revokingId === g.id} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <EmptyState message="No agents connected yet. Add Context Chest to your AI tool in 30 seconds." />
      )}

      <div className="mt-8">
        <h2 className="text-sm font-medium text-vault-muted uppercase mb-3">Connect a new agent</h2>
        <p className="text-sm text-vault-muted mb-3">Add this to your Claude Code or Cursor MCP config:</p>
        <div className="relative">
          <pre className="bg-black/30 rounded-lg p-4 text-sm text-green-400 font-mono overflow-x-auto">{MCP_CONFIG}</pre>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 px-2 py-1 bg-vault-surface rounded text-xs text-vault-muted hover:text-white"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
