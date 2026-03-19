import { useState, useEffect } from 'react';
import { useAuth } from '../auth/context';
import { AgentCard } from '../components/AgentCard';
import { GrantCard } from '../components/GrantCard';
import { EmptyState } from '../components/EmptyState';

interface Grant { id: string; clientName: string; clientId: string; role: string; createdAt: string; expiresAt: string; }
interface Agent { id: string; agentName: string; firstSeenAt: string; lastSeenAt: string; requestCount: number; }

// Removed — setup config is now in Settings via API key

export function Agents() {
  const { client } = useAuth();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

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

      <div className="mt-8 border-2 border-cc-border bg-cc-dark p-4 text-center">
        <p className="font-pixel text-[10px] text-cc-muted tracking-wider mb-3">CONNECT NEW AGENT</p>
        <p className="text-cc-muted text-xs mb-3">Generate an API key in Settings — no terminal login needed.</p>
        <a href="/settings" className="inline-block px-5 py-2 bg-cc-pink text-cc-black font-pixel text-xs tracking-wider hover:bg-cc-pink-dim transition-colors">
          GO TO SETTINGS
        </a>
      </div>
    </div>
  );
}
