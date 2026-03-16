import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { useChest } from '../context/chest-context';
import { PermissionEditor } from '../components/PermissionEditor';
import { exportChestAsZip } from '../lib/export';
import { importMdFile, importZipFile } from '../lib/import';

// Deterministic color palette based on chest name
const CHEST_COLORS: Record<string, { bg: string; border: string; glow: string }> = {
  default:  { bg: '#ff2d7b', border: '#ff2d7b', glow: 'rgba(255,45,123,0.15)' },
  work:     { bg: '#4a9eff', border: '#4a9eff', glow: 'rgba(74,158,255,0.15)' },
  personal: { bg: '#a855f7', border: '#a855f7', glow: 'rgba(168,85,247,0.15)' },
  health:   { bg: '#22c55e', border: '#22c55e', glow: 'rgba(34,197,94,0.15)' },
  finance:  { bg: '#eab308', border: '#eab308', glow: 'rgba(234,179,8,0.15)' },
  learning: { bg: '#06b6d4', border: '#06b6d4', glow: 'rgba(6,182,212,0.15)' },
  tools:    { bg: '#f97316', border: '#f97316', glow: 'rgba(249,115,22,0.15)' },
};

function getChestColor(name: string) {
  if (CHEST_COLORS[name]) return CHEST_COLORS[name];
  // Hash name to pick a hue for unknown chests
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    bg: `hsl(${hue}, 70%, 55%)`,
    border: `hsl(${hue}, 70%, 55%)`,
    glow: `hsla(${hue}, 70%, 55%, 0.15)`,
  };
}

interface ChestCardProps {
  chest: {
    id: string;
    name: string;
    description: string | null;
    isPublic: boolean;
    isAutoCreated: boolean;
    _count?: { memories: number };
  };
  isActive: boolean;
  onSelect: () => void;
  onExport: () => void;
  onImport: () => void;
  onDelete: () => void;
  onPermissions: () => void;
  exporting: string | null;
  importing: string | null;
}

function ChestCard({ chest, isActive, onSelect, onExport, onImport, onDelete, onPermissions, exporting, importing }: ChestCardProps) {
  const color = getChestColor(chest.name);
  const memCount = chest._count?.memories ?? 0;

  return (
    <div
      onClick={onSelect}
      className={`relative cursor-pointer group transition-all duration-200 border-2 bg-cc-dark hover:scale-[1.02] ${
        isActive ? 'border-current ring-1 ring-current' : 'border-cc-border hover:border-current'
      }`}
      style={{ borderColor: isActive ? color.border : undefined, color: color.bg }}
    >
      {/* Dithered chest image with color tint */}
      <div
        className="flex items-center justify-center py-6 relative overflow-hidden"
        style={{ backgroundColor: color.glow }}
      >
        <img
          src="/chest.png"
          alt=""
          className="w-20 h-20 relative z-10 drop-shadow-lg transition-transform group-hover:scale-110"
          style={{
            filter: `brightness(0) saturate(100%) drop-shadow(0 0 8px ${color.bg})`,
            imageRendering: 'auto',
          }}
        />
        {/* Color overlay on the chest */}
        <img
          src="/chest.png"
          alt=""
          className="w-20 h-20 absolute z-20 opacity-80 mix-blend-screen"
          style={{
            filter: `brightness(0.5) sepia(1) saturate(5) hue-rotate(${getHueRotation(color.bg)}deg)`,
            imageRendering: 'auto',
          }}
        />
        {isActive && (
          <div className="absolute top-2 right-2 z-30">
            <span className="font-pixel text-[8px] tracking-wider px-1.5 py-0.5 border" style={{ borderColor: color.border, color: color.bg }}>
              ACTIVE
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 border-t-2" style={{ borderColor: isActive ? color.border : '#222' }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-pixel text-sm text-cc-white tracking-wider truncate">{chest.name.toUpperCase()}</span>
          {chest.isAutoCreated && (
            <span className="font-pixel text-[8px] tracking-wider border px-1" style={{ borderColor: color.border, color: color.bg }}>
              AUTO
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono text-cc-muted">
          <span style={{ color: color.bg }}>{memCount}</span>
          <span>{memCount === 1 ? 'memory' : 'memories'}</span>
          {chest.isPublic && <span className="text-cc-muted">/ public</span>}
        </div>
        {chest.description && (
          <p className="text-[10px] text-cc-muted font-mono mt-1 truncate">{chest.description}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-cc-border">
          <button
            onClick={(e) => { e.stopPropagation(); onExport(); }}
            disabled={exporting === chest.name}
            className="font-pixel text-[9px] text-cc-muted hover:text-cc-white tracking-wider transition-colors disabled:opacity-50"
          >
            {exporting === chest.name ? 'EXPORTING...' : 'EXPORT'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onImport(); }}
            disabled={importing === chest.name}
            className="font-pixel text-[9px] text-cc-muted hover:text-cc-white tracking-wider transition-colors disabled:opacity-50"
          >
            {importing === chest.name ? 'IMPORTING...' : 'IMPORT'}
          </button>
          {chest.name !== 'default' && !chest.isPublic && (
            <button
              onClick={(e) => { e.stopPropagation(); onPermissions(); }}
              className="font-pixel text-[9px] text-cc-muted hover:text-cc-white tracking-wider transition-colors"
            >
              ACCESS
            </button>
          )}
          {chest.name !== 'default' && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="font-pixel text-[9px] text-cc-muted hover:text-red-400 tracking-wider transition-colors ml-auto"
            >
              DELETE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function getHueRotation(color: string): number {
  // Extract hue from hex or hsl color for CSS hue-rotate
  if (color.startsWith('hsl')) {
    const match = color.match(/hsl\((\d+)/);
    return match ? parseInt(match[1]) - 330 : 0; // 330 is the base sepia hue
  }
  // For hex colors, map to approximate hue
  const colorMap: Record<string, number> = {
    '#ff2d7b': 0,    // pink (base)
    '#4a9eff': 200,   // blue
    '#a855f7': 260,   // purple
    '#22c55e': 130,   // green
    '#eab308': 45,    // yellow
    '#06b6d4': 180,   // cyan
    '#f97316': 25,    // orange
  };
  return (colorMap[color] ?? 0) - 330;
}

export function Chests() {
  const { client, masterKey } = useAuth();
  const { chests, activeChest, setActiveChest, refreshChests } = useChest();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingChest, setEditingChest] = useState<{ id: string; name: string } | null>(null);
  const [exportingChest, setExportingChest] = useState<string | null>(null);
  const [importingChest, setImportingChest] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!client || !newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await client.createChest(newName.trim(), newDesc.trim() || undefined, isPublic);
      setNewName('');
      setNewDesc('');
      setIsPublic(false);
      setShowCreate(false);
      await refreshChests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create chest');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!client || name === 'default') return;
    if (!confirm(`Delete chest "${name}"? All memories inside will be permanently deleted.`)) return;
    try {
      await client.deleteChest(id);
      await refreshChests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete chest');
    }
  };

  const handleExportChest = async (chestName: string) => {
    if (!client || !masterKey) return;
    setExportingChest(chestName);
    try {
      await exportChestAsZip(client, masterKey, chestName);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportingChest(null);
    }
  };

  const handleImportToChest = async (chestName: string) => {
    if (!client || !masterKey) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.zip';
    input.multiple = true;
    input.onchange = async () => {
      if (!input.files?.length) return;
      setImportingChest(chestName);
      try {
        for (const file of Array.from(input.files)) {
          if (file.name.endsWith('.zip')) {
            await importZipFile(file, client, masterKey, chestName);
          } else {
            await importMdFile(file, client, masterKey, chestName);
          }
        }
        await refreshChests();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import failed');
      } finally {
        setImportingChest(null);
      }
    };
    input.click();
  };

  const handleSelectChest = (chest: typeof chests[0]) => {
    setActiveChest(chest);
    navigate('/memories');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-pixel text-xl text-cc-white tracking-wider">YOUR CHESTS</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="font-pixel text-xs tracking-wider px-4 py-2 border-2 border-cc-pink text-cc-pink hover:bg-cc-pink hover:text-cc-black transition-colors"
        >
          {showCreate ? 'CANCEL' : '+ NEW CHEST'}
        </button>
      </div>

      {error && (
        <div className="border-2 border-red-500/30 bg-red-500/5 p-3 text-red-400 text-xs mb-4 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-3">x</button>
        </div>
      )}

      {/* Create form (collapsible) */}
      {showCreate && (
        <div className="border-2 border-cc-border p-4 mb-6 bg-cc-dark">
          <input type="text" placeholder="chest-name (lowercase, hyphens)" value={newName}
            onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            className="w-full bg-cc-black border-2 border-cc-border px-3 py-2 text-sm text-cc-white font-mono placeholder-cc-muted focus:outline-none focus:border-cc-pink mb-2" />
          <input type="text" placeholder="Description (optional)" value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            className="w-full bg-cc-black border-2 border-cc-border px-3 py-2 text-sm text-cc-white font-mono placeholder-cc-muted focus:outline-none focus:border-cc-pink mb-2" />
          <label className="flex items-center gap-2 mb-3 text-xs text-cc-sub font-mono">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="accent-cc-pink" />
            Public (all agents can access)
          </label>
          <button onClick={handleCreate} disabled={creating || !newName.trim()}
            className="font-pixel text-xs tracking-wider px-4 py-2 border-2 border-cc-pink text-cc-pink hover:bg-cc-pink hover:text-cc-black transition-colors disabled:opacity-50">
            {creating ? 'CREATING...' : 'CREATE'}
          </button>
        </div>
      )}

      {/* Chest grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {chests.map((chest) => (
          <ChestCard
            key={chest.id}
            chest={chest}
            isActive={activeChest?.id === chest.id}
            onSelect={() => handleSelectChest(chest)}
            onExport={() => handleExportChest(chest.name)}
            onImport={() => handleImportToChest(chest.name)}
            onDelete={() => handleDelete(chest.id, chest.name)}
            onPermissions={() => setEditingChest(editingChest?.id === chest.id ? null : { id: chest.id, name: chest.name })}
            exporting={exportingChest}
            importing={importingChest}
          />
        ))}
      </div>

      {/* Permission editor */}
      {editingChest && (
        <div className="border-2 border-cc-border p-4 mt-4 bg-cc-dark">
          <PermissionEditor chestId={editingChest.id} chestName={editingChest.name} />
        </div>
      )}
    </div>
  );
}
