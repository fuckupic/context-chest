import { useState, useEffect } from 'react';
import { useAuth } from '../auth/context';
import { FileTree } from '../components/FileTree';
import { MemoryDetail } from '../components/MemoryDetail';
import { EmptyState } from '../components/EmptyState';

interface TreeEntry {
  uri: string;
  l0: string;
  type: 'file' | 'directory';
  children?: TreeEntry[];
}

export function Memories() {
  const { client } = useAuth();
  const [tree, setTree] = useState<TreeEntry[]>([]);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TreeEntry[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client) {
      setLoading(false);
      return;
    }

    // List memories from Prisma (always available, doesn't need OpenViking)
    client
      .listMemories(1, 100)
      .then((result) => {
        const entries = result.data;

        // Group URIs into directory tree
        const dirs = new Map<string, TreeEntry[]>();
        for (const e of entries) {
          const parts = e.uri.split('/');
          const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
          const file: TreeEntry = { uri: e.uri, l0: '', type: 'file' };
          if (!dirs.has(dir)) dirs.set(dir, []);
          dirs.get(dir)!.push(file);
        }

        const treeEntries: TreeEntry[] = [];
        for (const [dir, files] of dirs) {
          if (dir) {
            treeEntries.push({
              uri: dir + '/',
              l0: '',
              type: 'directory',
              children: files,
            });
          } else {
            treeEntries.push(...files);
          }
        }

        setTree(treeEntries);
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

  const selectedEntry = findEntry(searchResults ?? tree, selectedUri);
  const displayTree = searchResults ?? tree;

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
      <div className="w-52 border-r border-white/10 flex flex-col">
        <div className="p-3">
          <input
            type="text"
            placeholder="Search memories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full bg-vault-bg border border-white/10 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-vault-accent"
          />
          {searchResults && (
            <button
              onClick={() => { setSearchResults(null); setSearchQuery(''); }}
              className="text-xs text-vault-accent mt-1 hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
        <div className="flex-1 overflow-auto px-1">
          <FileTree entries={displayTree} selectedUri={selectedUri} onSelect={setSelectedUri} />
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {selectedEntry ? (
          <MemoryDetail uri={selectedEntry.uri} l0={selectedEntry.l0} />
        ) : (
          <div className="flex items-center justify-center h-full text-vault-muted text-sm">
            Select a memory to view details
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
