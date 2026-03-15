import { useState } from 'react';
import { useAuth } from '../auth/context';
import { useChest } from '../context/chest-context';
import { decryptL2FromBytes } from '../crypto';

interface MemoryDetailProps {
  uri: string;
  l0: string;
}

export function MemoryDetail({ uri, l0 }: MemoryDetailProps) {
  const { client, masterKey } = useAuth();
  const { activeChest } = useChest();
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDecrypt = async () => {
    if (!client || !masterKey) {
      setError('Not authenticated — master key unavailable. Try logging out and back in.');
      return;
    }
    setDecrypting(true);
    setError(null);
    try {
      const encryptedBytes = await client.getContent(uri);
      const decrypted = await decryptL2FromBytes(masterKey, activeChest?.name ?? 'default', uri, encryptedBytes);
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
      <div className="px-4 py-3 border-b-2 border-cc-border flex items-center gap-2 shrink-0 bg-cc-dark">
        {dirPath && <span className="font-mono text-[10px] text-cc-muted">{dirPath}/</span>}
        <span className="font-pixel text-sm text-cc-white tracking-wider">{fileName.toUpperCase()}</span>
        <div className="flex-1" />
        <button
          onClick={handleDecrypt}
          disabled={decrypting}
          className="px-3 py-1 border-2 border-cc-border font-pixel text-[10px] text-cc-muted tracking-wider hover:text-cc-pink hover:border-cc-pink-border transition-colors disabled:opacity-50"
        >
          {decrypting ? 'DECRYPTING...' : decryptedContent ? 'RE-DECRYPT' : 'DECRYPT'}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-5 space-y-4">
        {l0 && (
          <div>
            <p className="font-pixel text-[10px] text-cc-muted tracking-wider mb-1">SUMMARY</p>
            <p className="text-sm text-cc-sub">{l0}</p>
          </div>
        )}

        {error && (
          <div className="border-2 border-red-500/30 bg-red-500/5 p-3 text-red-400 text-xs">{error}</div>
        )}

        {decryptedContent && (
          <div>
            <p className="font-pixel text-[10px] text-cc-muted tracking-wider mb-1">CONTENT</p>
            <div className="bg-cc-dark border-2 border-cc-border p-4 text-sm text-cc-text whitespace-pre-wrap font-mono leading-relaxed">
              {decryptedContent}
            </div>
          </div>
        )}

        {!decryptedContent && !error && !decrypting && (
          <p className="text-xs text-cc-muted italic">Click Decrypt to view content.</p>
        )}
      </div>
    </div>
  );
}
