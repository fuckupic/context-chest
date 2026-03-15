interface AgentCardProps {
  id: string;
  agentName: string;
  firstSeenAt: string;
  lastSeenAt: string;
  requestCount: number;
  onDisconnect: (id: string) => void;
  disconnecting: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isOnline(lastSeenAt: string): boolean {
  return Date.now() - new Date(lastSeenAt).getTime() < 5 * 60 * 1000;
}

export function AgentCard({ id, agentName, firstSeenAt, lastSeenAt, requestCount, onDisconnect, disconnecting }: AgentCardProps) {
  const online = isOnline(lastSeenAt);

  return (
    <div className="bg-vault-mantle rounded-lg border border-vault-border p-4 flex items-center justify-between hover:border-vault-pink-border transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded flex items-center justify-center text-[11px] font-mono font-medium ${
          online ? 'bg-vault-pink-glow text-vault-pink border border-vault-pink-border' : 'bg-vault-surface text-vault-muted border border-vault-border'
        }`}>
          {agentName.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[13px] font-medium text-vault-text">{agentName}</span>
            <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400' : 'bg-vault-muted'}`} />
          </div>
          <p className="text-vault-muted text-[11px]">
            Last seen {timeAgo(lastSeenAt)} &middot; {requestCount.toLocaleString()} requests &middot; Since {new Date(firstSeenAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <button
        onClick={() => onDisconnect(id)}
        disabled={disconnecting}
        className="px-2.5 py-1 bg-vault-surface border border-vault-border rounded text-[11px] text-vault-muted hover:text-red-400 hover:border-red-400/30 transition-colors disabled:opacity-50"
      >
        {disconnecting ? '...' : 'Remove'}
      </button>
    </div>
  );
}
