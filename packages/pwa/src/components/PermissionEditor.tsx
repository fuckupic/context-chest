import { useState, useEffect } from 'react';
import { useAuth } from '../auth/context';

interface Permission {
  agentName: string;
  canRead: boolean;
  canWrite: boolean;
}

export function PermissionEditor({ chestId, chestName }: { chestId: string; chestName: string }) {
  const { client } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!client) return;
    Promise.all([client.listAgents(), client.getChestPermissions(chestId)])
      .then(([agentsRes, permsRes]) => {
        setPermissions(
          agentsRes.agents.map((a) => {
            const existing = permsRes.data.find((p) => p.agentName === a.agentName);
            return { agentName: a.agentName, canRead: existing?.canRead ?? false, canWrite: existing?.canWrite ?? false };
          })
        );
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [client, chestId]);

  const togglePermission = (agentName: string, field: 'canRead' | 'canWrite') => {
    setPermissions((prev) => prev.map((p) => p.agentName === agentName ? { ...p, [field]: !p[field] } : p));
  };

  const handleSave = async () => {
    if (!client) return;
    setSaving(true);
    try { await client.setChestPermissions(chestId, permissions); } catch { /* */ }
    finally { setSaving(false); }
  };

  if (!loaded) return <p className="text-xs text-cc-muted font-mono">Loading...</p>;
  if (permissions.length === 0) return <p className="text-xs text-cc-muted font-mono">No agents connected yet.</p>;

  return (
    <div>
      <h3 className="font-pixel text-xs text-cc-sub tracking-wider mb-2">PERMISSIONS — {chestName}</h3>
      <table className="w-full text-xs font-mono">
        <thead><tr className="text-cc-muted"><td className="py-1">Agent</td><td className="py-1 text-center">Read</td><td className="py-1 text-center">Write</td></tr></thead>
        <tbody>
          {permissions.map((p) => (
            <tr key={p.agentName} className="border-t border-cc-border">
              <td className="py-1.5 text-cc-white">{p.agentName}</td>
              <td className="py-1.5 text-center"><input type="checkbox" checked={p.canRead} onChange={() => togglePermission(p.agentName, 'canRead')} className="accent-cc-pink" /></td>
              <td className="py-1.5 text-center"><input type="checkbox" checked={p.canWrite} onChange={() => togglePermission(p.agentName, 'canWrite')} className="accent-cc-pink" /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={handleSave} disabled={saving}
        className="mt-3 font-pixel text-[10px] tracking-wider px-3 py-1.5 border-2 border-cc-pink text-cc-pink hover:bg-cc-pink hover:text-cc-black transition-colors disabled:opacity-50">
        {saving ? 'SAVING...' : 'SAVE'}
      </button>
    </div>
  );
}
