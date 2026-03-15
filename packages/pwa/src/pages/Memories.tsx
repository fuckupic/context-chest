import { useState, useEffect } from 'react';
import { useAuth } from '../auth/context';
import { MemoryDetail } from '../components/MemoryDetail';
import { EmptyState } from '../components/EmptyState';

interface TreeEntry {
  uri: string;
  l0: string;
  type: 'file' | 'directory';
  children?: TreeEntry[];
}

function TreeItem({ entry, selectedUri, onSelect, depth = 0 }: {
  entry: TreeEntry;
  selectedUri: string | null;
  onSelect: (uri: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const isDir = entry.type === 'directory';
  const isSelected = entry.uri === selectedUri;
  const label = entry.uri.split('/').pop() || entry.uri;

  return (
    <div>
      <button
        onClick={() => isDir ? setExpanded(!expanded) : onSelect(entry.uri)}
        className={`w-full text-left flex items-center gap-1.5 py-[3px] pr-2 text-[13px] transition-colors duration-100 ${
          isSelected
            ? 'bg-vault-pink-glow text-vault-pink'
            : 'text-vault-subtext hover:text-vault-text hover:bg-vault-surface/40'
        }`}
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        {isDir ? (
          <svg className={`w-3 h-3 shrink-0 text-vault-muted transition-transform ${expanded ? 'rotate-90' : ''}`} viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" />
          </svg>
        ) : (
          <svg className="w-3 h-3 shrink-0 text-vault-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
            <rect x="3" y="2" width="10" height="12" rx="1" />
            <line x1="5.5" y1="5" x2="10.5" y2="5" />
            <line x1="5.5" y1="7.5" x2="10.5" y2="7.5" />
            <line x1="5.5" y1="10" x2="8" y2="10" />
          </svg>
        )}
        <span className="truncate">{label}</span>
      </button>
      {isDir && expanded && entry.children?.map((child) => (
        <TreeItem
          key={child.uri}
          entry={child}
          selectedUri={selectedUri}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export function Memories() {
  const { client } = useAuth();
  const [tree, setTree] = useState<TreeEntry[]>([]);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TreeEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (!client) {
      setLoading(false);
      return;
    }
    client
      .browse('', 2)
      .then((result) => {
        setTree(result.data.tree);
        setTotalCount(result.meta.total);
      })
      .catch(() => setTree([]))
      .finally(() => setLoading(false));
  }, [client]);

  const handleSearch = async () => {
    if (!client || !searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const result = await client.recall(searchQuery, 20);
    setSearchResults(
      result.data.map((r) => ({ uri: r.uri, l0: r.l0, type: 'file' as const }))
    );
  };

  const displayTree = searchResults ?? tree;
  const selectedEntry = findEntry(displayTree, selectedUri);

  if (loading) {
    return <div className="flex items-center justify-center h-full text-vault-muted text-sm">Loading...</div>;
  }

  if (tree.length === 0 && !searchResults) {
    return (
      <EmptyState
        message="Your vault is empty. Connect an AI tool to start building your memory."
        actionLabel="Connect an agent"
        actionTo="/agents"
      />
    );
  }

  return (
    <div className="flex h-full">
      {/* File tree panel */}
      <div className="w-60 border-r border-vault-border flex flex-col bg-vault-mantle shrink-0">
        {/* Search */}
        <div className="p-2 border-b border-vault-border">
          <div className="relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-vault-muted" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="4.5" />
              <line x1="10.5" y1="10.5" x2="14" y2="14" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full bg-vault-surface border border-vault-border rounded pl-7 pr-2 py-1 text-[12px] text-vault-text placeholder-vault-muted focus:outline-none focus:border-vault-pink/40 transition-colors"
            />
          </div>
          {searchResults ? (
            <button
              onClick={() => { setSearchResults(null); setSearchQuery(''); }}
              className="text-[11px] text-vault-pink mt-1 hover:underline"
            >
              Clear ({searchResults.length} results)
            </button>
          ) : (
            <p className="text-[11px] text-vault-muted mt-1 px-0.5">
              {totalCount} {totalCount === 1 ? 'memory' : 'memories'}
            </p>
          )}
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-auto py-1">
          {displayTree.map((entry) => (
            <TreeItem
              key={entry.uri}
              entry={entry}
              selectedUri={selectedUri}
              onSelect={setSelectedUri}
            />
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-auto">
        {selectedEntry ? (
          <MemoryDetail uri={selectedEntry.uri} l0={selectedEntry.l0} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-vault-muted">
            <svg className="w-12 h-12 mb-3 opacity-20" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="8" y="6" width="32" height="36" rx="3" />
              <line x1="14" y1="14" x2="34" y2="14" />
              <line x1="14" y1="20" x2="34" y2="20" />
              <line x1="14" y1="26" x2="28" y2="26" />
            </svg>
            <p className="text-sm">Select a memory</p>
          </div>
        )}
      </div>
    </div>
  );
}

function findEntry(entries: TreeEntry[], uri: string | null): TreeEntry | null {
  if (!uri) return null;
  for (const entry of entries) {
    if (entry.uri === uri) return entry;
    if (entry.children) {
      const found = findEntry(entry.children, uri);
      if (found) return found;
    }
  }
  return null;
}
