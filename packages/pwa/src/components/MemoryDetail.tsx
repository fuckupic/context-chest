import { useState } from 'react';
import { useAuth } from '../auth/context';
import { decryptL2FromBytes } from '../crypto';

interface MemoryDetailProps {
  uri: string;
  l0: string;
  l1?: string;
}

export function MemoryDetail({ uri, l0 }: MemoryDetailProps) {
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

  const pathSegments = uri.split('/');
  const fileName = pathSegments.pop() || uri;
  const dirPath = pathSegments.join('/');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-vault-border flex items-center gap-2 shrink-0 bg-vault-mantle/30">
        {dirPath && (
          <span className="text-[11px] text-vault-muted font-mono">{dirPath}/</span>
        )}
        <span className="text-[13px] text-vault-text font-medium">{fileName}</span>
        <div className="flex-1" />
        <button
          onClick={handleDecrypt}
          disabled={decrypting}
          className="px-3 py-1 bg-vault-surface border border-vault-border rounded text-[11px] text-vault-subtext hover:text-vault-pink hover:border-vault-pink-border transition-colors disabled:opacity-50"
        >
          {decrypting ? 'Decrypting...' : decryptedContent ? 'Re-decrypt' : 'Decrypt'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5 space-y-4">
        {l0 && (
          <div>
            <p className="text-[10px] text-vault-muted uppercase tracking-wider mb-1 font-medium">Summary</p>
            <p className="text-[13px] text-vault-subtext">{l0}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-[12px]">{error}</div>
        )}

        {decryptedContent && (
          <div>
            <p className="text-[10px] text-vault-muted uppercase tracking-wider mb-1 font-medium">Content</p>
            <div className="bg-vault-crust rounded-lg p-4 text-[13px] text-vault-text whitespace-pre-wrap font-mono leading-relaxed border border-vault-border">
              {decryptedContent}
            </div>
          </div>
        )}

        {!decryptedContent && !error && !decrypting && (
          <p className="text-[12px] text-vault-muted italic">Click Decrypt to view the full content.</p>
        )}
      </div>
    </div>
  );
}
