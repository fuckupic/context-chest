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
  return `${Math.floor(hours / 24)}d ago`;
}

function isOnline(lastSeenAt: string): boolean {
  return Date.now() - new Date(lastSeenAt).getTime() < 5 * 60 * 1000;
}

export function AgentCard({ id, agentName, lastSeenAt, requestCount, firstSeenAt, onDisconnect, disconnecting }: AgentCardProps) {
  const online = isOnline(lastSeenAt);

  return (
    <div className="border-2 border-cc-border bg-cc-dark p-4 flex items-center justify-between hover:border-cc-pink-border transition-colors">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 ${online ? 'bg-green-400' : 'bg-cc-muted'}`} />
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-pixel text-sm text-cc-white tracking-wider">{agentName.toUpperCase()}</span>
            <span className={`font-pixel text-[10px] tracking-wider ${online ? 'text-green-400' : 'text-cc-muted'}`}>
              {online ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <p className="text-cc-muted text-[11px]">
            Last seen {timeAgo(lastSeenAt)} &middot; {requestCount} req &middot; Since {new Date(firstSeenAt).toLocaleDateString()}
          </p>
        </div>
      </div>
      <button
        onClick={() => onDisconnect(id)}
        disabled={disconnecting}
        className="px-2.5 py-1 border-2 border-cc-border font-pixel text-[10px] text-cc-muted tracking-wider hover:text-red-400 hover:border-red-400/30 transition-colors disabled:opacity-50"
      >
        {disconnecting ? '...' : 'REMOVE'}
      </button>
    </div>
  );
}
