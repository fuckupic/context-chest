import { useState, useEffect } from 'react';
import { useAuth } from '../auth/context';
import { useChest } from '../context/chest-context';
import { MemoryEditor } from '../components/MemoryEditor';
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
        className={`w-full text-left flex items-center gap-2 py-1.5 pr-3 text-xs font-mono transition-colors border-l-2 ${
          isSelected
            ? 'border-cc-pink text-cc-pink bg-cc-pink-glow'
            : 'border-transparent text-cc-sub hover:text-cc-white hover:bg-cc-surface'
        }`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        <span className="text-cc-muted text-[10px]">{isDir ? (expanded ? '[-]' : '[+]') : ' > '}</span>
        <span className="truncate">{label}</span>
      </button>
      {isDir && expanded && entry.children?.map((child) => (
        <TreeItem key={child.uri} entry={child} selectedUri={selectedUri} onSelect={onSelect} depth={depth + 1} />
      ))}
    </div>
  );
}

export function Memories() {
  const { client } = useAuth();
  const { activeChest } = useChest();
  const [tree, setTree] = useState<TreeEntry[]>([]);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TreeEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!client) { setLoading(false); return; }
    setLoading(true);
    setSelectedUri(null);
    setSearchResults(null);
    setSearchQuery('');
    client.browse('', 2)
      .then((r) => { setTree(r.data.tree); setTotalCount(r.meta.total); })
      .catch(() => setTree([]))
      .finally(() => setLoading(false));
  }, [client, activeChest]);

  const handleSelectMemory = (newUri: string) => {
    if (isDirty && !confirm('You have unsaved changes. Discard them?')) return;
    setSelectedUri(newUri);
  };

  const handleSearch = async () => {
    if (!client || !searchQuery.trim()) { setSearchResults(null); return; }
    const result = await client.recall(searchQuery, 20);
    setSearchResults(result.data.map((r) => ({ uri: r.uri, l0: r.l0, type: 'file' as const })));
  };

  const displayTree = searchResults ?? tree;
  const selectedEntry = findEntry(displayTree, selectedUri);

  if (loading) return <div className="flex items-center justify-center h-full text-cc-muted font-pixel text-sm">LOADING...</div>;

  if (tree.length === 0 && !searchResults) {
    return <EmptyState message="Vault empty. Connect an AI agent to start." actionLabel="CONNECT AGENT" actionTo="/agents" />;
  }

  return (
    <div className="flex h-full">
      {/* Tree panel */}
      <div className="w-56 border-r-2 border-cc-border flex flex-col bg-cc-dark shrink-0">
        <div className="p-2.5 border-b-2 border-cc-border">
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full bg-cc-black border-2 border-cc-border px-2.5 py-1.5 text-xs text-cc-white font-mono placeholder-cc-muted focus:outline-none focus:border-cc-pink transition-colors"
          />
          {searchResults ? (
            <button onClick={() => { setSearchResults(null); setSearchQuery(''); }} className="text-[10px] text-cc-pink font-pixel mt-1.5 tracking-wider hover:underline">
              CLEAR ({searchResults.length})
            </button>
          ) : (
            <p className="text-[10px] text-cc-muted font-pixel mt-1.5 tracking-wider">{totalCount} MEMORIES</p>
          )}
        </div>
        <div className="flex-1 overflow-auto py-1">
          {displayTree.map((entry) => (
            <TreeItem key={entry.uri} entry={entry} selectedUri={selectedUri} onSelect={handleSelectMemory} />
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-auto">
        {selectedEntry ? (
          <MemoryEditor
              key={selectedEntry.uri}
              uri={selectedEntry.uri}
              l0={selectedEntry.l0}
              onDirtyChange={setIsDirty}
            />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-cc-muted">
            <img src="/logo.png" alt="" className="w-16 h-16 mb-4 opacity-10" style={{ imageRendering: 'auto' }} />
            <p className="font-pixel text-xs tracking-wider">SELECT A MEMORY</p>
          </div>
        )}
      </div>
    </div>
  );
}

function findEntry(entries: TreeEntry[], uri: string | null): TreeEntry | null {
  if (!uri) return null;
  for (const e of entries) {
    if (e.uri === uri) return e;
    if (e.children) { const f = findEntry(e.children, uri); if (f) return f; }
  }
  return null;
}
