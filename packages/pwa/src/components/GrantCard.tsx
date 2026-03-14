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
  tool: 'bg-gray-500/20 text-gray-400',
  assistant: 'bg-blue-500/20 text-blue-400',
  admin: 'bg-vault-accent/20 text-vault-accent',
};

export function GrantCard({ id, clientName, role, createdAt, expiresAt, onRevoke, revoking }: GrantCardProps) {
  return (
    <div className="bg-vault-surface rounded-lg p-4 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium">{clientName}</span>
          <span className={`px-2 py-0.5 rounded text-xs ${roleBadgeColors[role] ?? 'bg-gray-500/20 text-gray-400'}`}>
            {role}
          </span>
        </div>
        <p className="text-vault-muted text-xs">
          Connected {new Date(createdAt).toLocaleDateString()} · Expires {new Date(expiresAt).toLocaleDateString()}
        </p>
      </div>
      <button
        onClick={() => onRevoke(id)}
        disabled={revoking}
        className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
      >
        {revoking ? 'Revoking...' : 'Revoke'}
      </button>
    </div>
  );
}
