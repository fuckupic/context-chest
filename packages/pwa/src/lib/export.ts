import JSZip from 'jszip';
import { decryptL2FromBytes } from '../crypto';
import { decryptL2FromBytesLegacy } from '../crypto/legacy';
import type { ApiClient } from '../api/client';

function buildMarkdown(content: string, uri: string, chestName: string): string {
  const exported = new Date().toISOString();
  return `---\nuri: ${uri}\nchest: ${chestName}\nexported: ${exported}\n---\n\n${content}`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportMemoryAsMd(content: string, uri: string, chestName: string): void {
  const markdown = buildMarkdown(content, uri, chestName);
  const blob = new Blob([markdown], { type: 'text/markdown; charset=utf-8' });
  const filename = uri.replaceAll('/', '-') + '.md';
  triggerDownload(blob, filename);
}

interface ExportManifestEntry {
  uri: string;
  filename: string;
  exportedAt: string;
}

export async function exportChestAsZip(
  client: ApiClient,
  masterKey: Uint8Array,
  chestName: string,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const listResult = await client.listMemories();
  const memories = listResult.data;
  const total = memories.length;
  const exportedAt = new Date().toISOString();
  const zip = new JSZip();
  const manifestEntries: ExportManifestEntry[] = [];
  let done = 0;

  for (const memory of memories) {
    const { uri } = memory;
    try {
      const encryptedBytes = await client.getContent(uri);
      let plaintext: Uint8Array;
      try {
        plaintext = await decryptL2FromBytes(masterKey, chestName, uri, encryptedBytes);
      } catch {
        plaintext = await decryptL2FromBytesLegacy(masterKey, uri, encryptedBytes);
      }
      const content = new TextDecoder().decode(plaintext);
      const markdown = buildMarkdown(content, uri, chestName);
      const filename = uri.replaceAll('/', '-') + '.md';
      zip.file(filename, markdown);
      manifestEntries.push({ uri, filename, exportedAt });
    } catch {
      // Skip memories that fail to decrypt — don't block the export
    }
    done += 1;
    onProgress?.(done, total);
  }

  const manifest = {
    chest: chestName,
    exportedAt,
    memories: manifestEntries,
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(zipBlob, `${chestName}-export.zip`);
}
