import { useState } from 'react';

interface TreeEntry {
  uri: string;
  l0: string;
  type: 'file' | 'directory';
  children?: TreeEntry[];
}

interface FileTreeProps {
  entries: TreeEntry[];
  selectedUri: string | null;
  onSelect: (uri: string) => void;
  depth?: number;
}

export function FileTree({ entries, selectedUri, onSelect, depth = 0 }: FileTreeProps) {
  return (
    <div className="text-sm">
      {entries.map((entry) => (
        <FileTreeNode
          key={entry.uri}
          entry={entry}
          selectedUri={selectedUri}
          onSelect={onSelect}
          depth={depth}
        />
      ))}
    </div>
  );
}

function FileTreeNode({
  entry,
  selectedUri,
  onSelect,
  depth,
}: {
  entry: TreeEntry;
  selectedUri: string | null;
  onSelect: (uri: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isDir = entry.type === 'directory';
  const isSelected = entry.uri === selectedUri;
  const name = entry.uri.split('/').filter(Boolean).pop() ?? entry.uri;

  return (
    <div>
      <button
        onClick={() => {
          if (isDir) {
            setExpanded((e) => !e);
          } else {
            onSelect(entry.uri);
          }
        }}
        className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 transition-colors ${
          isSelected ? 'bg-vault-accent/15 text-vault-accent' : 'text-vault-muted'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className="text-xs">{isDir ? (expanded ? '📂' : '📁') : '📄'}</span>
        <span className="truncate">{name}</span>
      </button>
      {isDir && expanded && entry.children && (
        <FileTree
          entries={entry.children}
          selectedUri={selectedUri}
          onSelect={onSelect}
          depth={depth + 1}
        />
      )}
    </div>
  );
}
