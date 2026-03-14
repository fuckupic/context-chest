import { useState } from 'react';
import { useAuth } from '../auth/context';
import { decryptL2FromBytes } from '../crypto';

interface MemoryDetailProps {
  uri: string;
  l0: string;
  l1?: string;
}

export function MemoryDetail({ uri, l0, l1 }: MemoryDetailProps) {
  const { client, masterKey } = useAuth();
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDecrypt = async () => {
    if (!client || !masterKey) return;
    setDecrypting(true);
    setError(null);
    try {
      const encryptedBytes = await client.getContent(uri);
      const decrypted = await decryptL2FromBytes(masterKey, uri, encryptedBytes);
      setDecryptedContent(new TextDecoder().decode(decrypted));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decryption failed');
    } finally {
      setDecrypting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-vault-muted text-xs mb-1">{uri.split('/').slice(0, -1).join('/')}/</p>
          <h2 className="text-lg font-bold">{uri.split('/').pop()}</h2>
        </div>
        <button
          onClick={handleDecrypt}
          disabled={decrypting}
          className="px-3 py-1.5 bg-vault-surface border border-white/10 rounded text-xs text-vault-muted hover:text-white transition-colors disabled:opacity-50"
        >
          {decrypting ? 'Decrypting...' : 'Decrypt'}
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <p className="text-vault-muted text-xs uppercase mb-1">L0 Summary</p>
          <p className="text-white text-sm">{l0}</p>
        </div>
        {l1 && (
          <div>
            <p className="text-vault-muted text-xs uppercase mb-1">L1 Overview</p>
            <div className="bg-black/20 rounded-lg p-4 text-sm text-gray-300 whitespace-pre-wrap font-mono">{l1}</div>
          </div>
        )}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>
        )}
        {decryptedContent && (
          <div>
            <p className="text-vault-muted text-xs uppercase mb-1">L2 Full Content (Decrypted)</p>
            <div className="bg-black/30 rounded-lg p-4 text-sm text-white whitespace-pre-wrap font-mono border border-vault-accent/20">{decryptedContent}</div>
          </div>
        )}
      </div>
    </div>
  );
}
