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

  const DEV_MODE = !import.meta.env.PROD;

  const MOCK_TREE: TreeEntry[] = [
    {
      uri: 'preferences/', l0: '', type: 'directory', children: [
        { uri: 'preferences/editor-theme', l0: 'User prefers dark mode in code editors', type: 'file' },
        { uri: 'preferences/terminal', l0: 'Uses iTerm2 with Dracula theme', type: 'file' },
        { uri: 'preferences/keybindings', l0: 'Custom vim-style keybindings in VS Code', type: 'file' },
      ],
    },
    {
      uri: 'projects/', l0: '', type: 'directory', children: [
        {
          uri: 'projects/context-chest/', l0: '', type: 'directory', children: [
            { uri: 'projects/context-chest/architecture', l0: 'Fastify + OpenViking orchestration layer', type: 'file' },
            { uri: 'projects/context-chest/stack', l0: 'TypeScript, Prisma, S3, PostgreSQL', type: 'file' },
            { uri: 'projects/context-chest/encryption', l0: 'AES-GCM 256 with HKDF key derivation', type: 'file' },
          ],
        },
      ],
    },
    {
      uri: 'workflows/', l0: '', type: 'directory', children: [
        { uri: 'workflows/git-conventions', l0: 'Conventional commits with feat/fix/refactor types', type: 'file' },
        { uri: 'workflows/tdd', l0: 'Test-driven development with 80% coverage target', type: 'file' },
      ],
    },
    {
      uri: 'tools/', l0: '', type: 'directory', children: [
        { uri: 'tools/debugging', l0: 'Systematic debugging methodology', type: 'file' },
        { uri: 'tools/claude-code', l0: 'Claude Code CLI usage patterns and tips', type: 'file' },
      ],
    },
  ];

  useEffect(() => {
    if (DEV_MODE) {
      setTree(MOCK_TREE);
      setLoading(false);
      return;
    }
    if (!client) return;
    client
      .browse('', 3)
      .then((result) => setTree(result.data.tree))
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
