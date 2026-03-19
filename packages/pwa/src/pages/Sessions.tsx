import { useState, useEffect } from 'react';
import { useAuth } from '../auth/context';
import { useChest } from '../context/chest-context';
import { EmptyState } from '../components/EmptyState';

interface Session { id: string; status: string; messageCount: number; memoriesExtracted: number; clientId: string | null; createdAt: string; closedAt: string | null; }

export function Sessions() {
  const { client } = useAuth();
  const { activeChest } = useChest();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client) return;
    client.listSessions(undefined, 1, 50)
      .then((r) => setSessions(r.data))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [client, activeChest]);

  if (loading) return <div className="flex items-center justify-center h-full text-cc-muted font-pixel text-sm">LOADING...</div>;
  if (sessions.length === 0) return <EmptyState message="No sessions yet. Sessions are tracked when agents use session tools." actionLabel="CONNECT AGENT" actionTo="/agents" />;

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="font-pixel text-xl text-cc-white tracking-wider mb-6">SESSIONS</h1>
      <div className="border-2 border-cc-border bg-cc-dark overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b-2 border-cc-border">
              <th className="text-left px-4 py-2.5 font-pixel text-[10px] text-cc-muted tracking-wider">ID</th>
              <th className="text-left px-4 py-2.5 font-pixel text-[10px] text-cc-muted tracking-wider">STATUS</th>
              <th className="text-left px-4 py-2.5 font-pixel text-[10px] text-cc-muted tracking-wider">MSG</th>
              <th className="text-left px-4 py-2.5 font-pixel text-[10px] text-cc-muted tracking-wider">MEM</th>
              <th className="text-left px-4 py-2.5 font-pixel text-[10px] text-cc-muted tracking-wider">DATE</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-cc-border hover:bg-cc-surface transition-colors">
                <td className="px-4 py-2.5 font-mono text-[11px] text-cc-sub">{s.id.slice(0, 8)}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-flex items-center gap-1.5 font-pixel text-[10px] tracking-wider ${s.status === 'active' ? 'text-green-400' : 'text-cc-muted'}`}>
                    <span className={`w-1.5 h-1.5 ${s.status === 'active' ? 'bg-green-400' : 'bg-cc-muted'}`} />
                    {s.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-cc-sub">{s.messageCount}</td>
                <td className="px-4 py-2.5 text-cc-sub">{s.memoriesExtracted}</td>
                <td className="px-4 py-2.5 text-cc-muted text-[10px]">{new Date(s.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
