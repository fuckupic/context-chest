import { useState } from 'react';
import { useAuth } from '../auth/context';
import { useChest } from '../context/chest-context';
import { PermissionEditor } from '../components/PermissionEditor';
import { exportChestAsZip } from '../lib/export';
import { importMdFile, importZipFile } from '../lib/import';

export function Chests() {
  const { client, masterKey } = useAuth();
  const { chests, refreshChests } = useChest();
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingChest, setEditingChest] = useState<{ id: string; name: string } | null>(null);
  const [exportingChest, setExportingChest] = useState<string | null>(null);
  const [exportProgress, setExportProgress] = useState('');
  const [importingChest, setImportingChest] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState('');

  const handleCreate = async () => {
    if (!client || !newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await client.createChest(newName.trim(), newDesc.trim() || undefined, isPublic);
      setNewName('');
      setNewDesc('');
      setIsPublic(false);
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
    setExportProgress('Starting...');
    try {
      await exportChestAsZip(client, masterKey, chestName, (done, total) => {
        setExportProgress(`${done}/${total} memories`);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportingChest(null);
      setExportProgress('');
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
      setImportProgress('Starting...');
      try {
        let totalImported = 0;
        let totalFailed = 0;
        for (const file of Array.from(input.files)) {
          if (file.name.endsWith('.zip')) {
            const result = await importZipFile(file, client, masterKey, chestName, (done, total) => {
              setImportProgress(`${done}/${total} memories`);
            });
            totalImported += result.imported.length;
            totalFailed += result.failed.length;
          } else {
            await importMdFile(file, client, masterKey, chestName);
            totalImported++;
          }
        }
        setImportProgress(`Done — ${totalImported} imported${totalFailed > 0 ? `, ${totalFailed} failed` : ''}`);
        await refreshChests();
        setTimeout(() => setImportProgress(''), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import failed');
      } finally {
        setImportingChest(null);
      }
    };
    input.click();
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="font-pixel text-xl text-cc-white tracking-wider mb-6">CHESTS</h1>

      {/* Create form */}
      <div className="border-2 border-cc-border p-4 mb-6 bg-cc-dark">
        <h2 className="font-pixel text-sm text-cc-sub tracking-wider mb-3">CREATE CHEST</h2>
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
        {error && <p className="text-red-400 text-xs mt-2 font-mono">{error}</p>}
      </div>

      {/* Chest list */}
      <div className="space-y-2">
        {chests.map((chest) => (
          <div key={chest.id} className="border-2 border-cc-border p-3 bg-cc-dark flex items-center justify-between">
            <div>
              <span className="font-mono text-sm text-cc-white">{chest.name}</span>
              {chest.isPublic && <span className="ml-2 font-pixel text-[9px] text-cc-muted tracking-wider">PUBLIC</span>}
              {chest.isAutoCreated && (
                <span className="ml-2 font-pixel text-[9px] text-cc-pink tracking-wider border border-cc-pink px-1">AUTO</span>
              )}
              <p className="text-xs text-cc-muted font-mono mt-0.5">
                {chest._count?.memories ?? 0} memories{chest.description ? ` — ${chest.description}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleExportChest(chest.name)}
                disabled={exportingChest === chest.name}
                className="font-pixel text-[10px] text-cc-muted hover:text-cc-pink tracking-wider transition-colors disabled:opacity-50"
              >
                {exportingChest === chest.name ? exportProgress : 'EXPORT'}
              </button>
              <button
                onClick={() => handleImportToChest(chest.name)}
                disabled={importingChest === chest.name}
                className="font-pixel text-[10px] text-cc-muted hover:text-cc-pink tracking-wider transition-colors disabled:opacity-50"
              >
                {importingChest === chest.name ? importProgress : 'IMPORT'}
              </button>
              {chest.name !== 'default' && !chest.isPublic && (
                <button onClick={() => setEditingChest(editingChest?.id === chest.id ? null : { id: chest.id, name: chest.name })}
                  className="font-pixel text-[10px] text-cc-muted hover:text-cc-pink tracking-wider transition-colors">
                  PERMISSIONS
                </button>
              )}
              {chest.name !== 'default' && (
                <button onClick={() => handleDelete(chest.id, chest.name)}
                  className="font-pixel text-[10px] text-cc-muted hover:text-red-400 tracking-wider transition-colors">
                  DELETE
                </button>
              )}
            </div>
          </div>
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
