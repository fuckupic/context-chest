import { useState, useEffect } from 'react';
import { useAuth } from '../auth/context';
import { EmptyState } from '../components/EmptyState';

interface Session {
  id: string;
  status: string;
  messageCount: number;
  memoriesExtracted: number;
  clientId: string | null;
  createdAt: string;
  closedAt: string | null;
}

export function Sessions() {
  const { client } = useAuth();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client) return;
    client
      .listSessions(undefined, 1, 50)
      .then((result) => setSessions(result.data))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [client]);

  if (loading) {
    return <div className="flex items-center justify-center h-full text-vault-muted text-sm">Loading...</div>;
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        message="No sessions yet. Sessions are created when agents track conversations."
        actionLabel="Connect an agent"
        actionTo="/agents"
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-lg font-medium mb-6 text-vault-text">Sessions</h1>
      <div className="bg-vault-mantle rounded-lg border border-vault-border overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-vault-border">
              <th className="text-left px-4 py-2.5 text-vault-muted font-medium text-[10px] uppercase tracking-wider">ID</th>
              <th className="text-left px-4 py-2.5 text-vault-muted font-medium text-[10px] uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-2.5 text-vault-muted font-medium text-[10px] uppercase tracking-wider">Messages</th>
              <th className="text-left px-4 py-2.5 text-vault-muted font-medium text-[10px] uppercase tracking-wider">Memories</th>
              <th className="text-left px-4 py-2.5 text-vault-muted font-medium text-[10px] uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-vault-border/50 hover:bg-vault-surface/30 transition-colors">
                <td className="px-4 py-2.5 font-mono text-[11px] text-vault-subtext">{s.id.slice(0, 8)}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] ${
                    s.status === 'active' ? 'text-emerald-400' : 'text-vault-muted'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      s.status === 'active' ? 'bg-emerald-400' : 'bg-vault-muted'
                    }`} />
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-vault-subtext">{s.messageCount}</td>
                <td className="px-4 py-2.5 text-vault-subtext">{s.memoriesExtracted}</td>
                <td className="px-4 py-2.5 text-vault-muted text-[11px]">{new Date(s.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
