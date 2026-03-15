interface GrantCardProps {
  id: string;
  clientName: string;
  role: string;
  createdAt: string;
  expiresAt: string;
  onRevoke: (id: string) => void;
  revoking: boolean;
}

export function GrantCard({ id, clientName, role, createdAt, expiresAt, onRevoke, revoking }: GrantCardProps) {
  return (
    <div className="border-2 border-cc-border bg-cc-dark p-4 flex items-center justify-between hover:border-cc-pink-border transition-colors">
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-pixel text-sm text-cc-white tracking-wider">{clientName.toUpperCase()}</span>
          <span className="font-pixel text-[10px] text-cc-muted tracking-wider border border-cc-border px-1.5 py-0.5">{role.toUpperCase()}</span>
        </div>
        <p className="text-cc-muted text-[11px]">
          Connected {new Date(createdAt).toLocaleDateString()} &middot; Expires {new Date(expiresAt).toLocaleDateString()}
        </p>
      </div>
      <button
        onClick={() => onRevoke(id)}
        disabled={revoking}
        className="px-2.5 py-1 border-2 border-cc-border font-pixel text-[10px] text-cc-muted tracking-wider hover:text-red-400 hover:border-red-400/30 transition-colors disabled:opacity-50"
      >
        {revoking ? '...' : 'REVOKE'}
      </button>
    </div>
  );
}
