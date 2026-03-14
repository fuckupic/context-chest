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
    <div className="bg-vault-surface rounded-lg p-4 flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-400' : 'bg-gray-500'}`} />
          <span className="font-medium">{agentName}</span>
          <span className="px-2 py-0.5 rounded text-xs bg-vault-accent/20 text-vault-accent">
            {online ? 'online' : 'offline'}
          </span>
        </div>
        <p className="text-vault-muted text-xs">
          Last seen {timeAgo(lastSeenAt)} · {requestCount.toLocaleString()} requests · Since {new Date(firstSeenAt).toLocaleDateString()}
        </p>
      </div>
      <button
        onClick={() => onDisconnect(id)}
        disabled={disconnecting}
        className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
      >
        {disconnecting ? 'Removing...' : 'Remove'}
      </button>
    </div>
  );
}
