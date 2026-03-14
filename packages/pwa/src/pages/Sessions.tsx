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
    return <div className="flex items-center justify-center h-full text-vault-muted">Loading...</div>;
  }

  if (sessions.length === 0) {
    return (
      <EmptyState
        message="No sessions yet. Sessions are created automatically when connected agents track conversations."
        actionLabel="Connect an agent"
        actionTo="/agents"
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-xl font-bold mb-6">Sessions</h1>
      <div className="bg-vault-surface rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left px-4 py-3 text-vault-muted font-medium text-xs uppercase">ID</th>
              <th className="text-left px-4 py-3 text-vault-muted font-medium text-xs uppercase">Status</th>
              <th className="text-left px-4 py-3 text-vault-muted font-medium text-xs uppercase">Messages</th>
              <th className="text-left px-4 py-3 text-vault-muted font-medium text-xs uppercase">Memories</th>
              <th className="text-left px-4 py-3 text-vault-muted font-medium text-xs uppercase">Created</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-4 py-3 font-mono text-xs">{s.id.slice(0, 8)}...</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    s.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                  }`}>{s.status}</span>
                </td>
                <td className="px-4 py-3 text-vault-muted">{s.messageCount}</td>
                <td className="px-4 py-3 text-vault-muted">{s.memoriesExtracted}</td>
                <td className="px-4 py-3 text-vault-muted text-xs">{new Date(s.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
