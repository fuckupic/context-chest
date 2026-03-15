interface GrantCardProps {
  id: string;
  clientName: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  onRevoke: (id: string) => void;
  revoking: boolean;
}

const roleBadgeColors: Record<string, string> = {
  tool: 'bg-vault-surface text-vault-muted',
  assistant: 'bg-blue-500/10 text-blue-400',
  admin: 'bg-vault-pink-glow text-vault-pink',
};

export function GrantCard({ id, clientName, role, createdAt, expiresAt, onRevoke, revoking }: GrantCardProps) {
  return (
    <div className="bg-vault-mantle rounded-lg border border-vault-border p-4 flex items-center justify-between hover:border-vault-pink-border transition-colors">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[13px] font-medium text-vault-text">{clientName}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] ${roleBadgeColors[role] ?? 'bg-vault-surface text-vault-muted'}`}>
            {role}
          </span>
        </div>
        <p className="text-vault-muted text-[11px]">
          Connected {new Date(createdAt).toLocaleDateString()} &middot; Expires {new Date(expiresAt).toLocaleDateString()}
        </p>
      </div>
      <button
        onClick={() => onRevoke(id)}
        disabled={revoking}
        className="px-2.5 py-1 bg-vault-surface border border-vault-border rounded text-[11px] text-vault-muted hover:text-red-400 hover:border-red-400/30 transition-colors disabled:opacity-50"
      >
        {revoking ? '...' : 'Revoke'}
      </button>
    </div>
  );
}
