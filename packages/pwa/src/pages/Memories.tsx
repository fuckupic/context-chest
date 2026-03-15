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
        className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
          isSelected
            ? 'bg-vault-gold/10 text-vault-gold'
            : 'text-vault-muted hover:text-white hover:bg-white/5'
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        <span className="text-xs opacity-60">
          {isDir ? (expanded ? '▾' : '▸') : '·'}
        </span>
        <span className="truncate font-mono text-xs">{label}</span>
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
    return <div className="flex items-center justify-center h-full text-vault-muted">Loading...</div>;
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
      <div className="w-64 border-r border-vault-border flex flex-col bg-vault-surface/30">
        <div className="p-3 border-b border-vault-border">
          <div className="relative">
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full bg-vault-bg border border-vault-border rounded-lg px-3 py-1.5 text-xs text-white placeholder-vault-muted focus:outline-none focus:border-vault-gold/40 transition-colors"
            />
          </div>
          {searchResults && (
            <button
              onClick={() => { setSearchResults(null); setSearchQuery(''); }}
              className="text-xs text-vault-gold mt-2 hover:underline"
            >
              Clear search ({searchResults.length} results)
            </button>
          )}
          {!searchResults && (
            <p className="text-xs text-vault-muted mt-2">
              {totalCount} {totalCount === 1 ? 'memory' : 'memories'}
            </p>
          )}
        </div>
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
      <div className="flex-1 overflow-auto">
        {selectedEntry ? (
          <MemoryDetail uri={selectedEntry.uri} l0={selectedEntry.l0} />
        ) : (
          <div className="flex items-center justify-center h-full text-vault-muted text-sm">
            Select a memory to view its content
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
