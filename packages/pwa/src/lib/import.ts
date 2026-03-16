import JSZip from 'jszip';
import { encryptL2, sha256 } from '../crypto';
import type { ApiClient } from '../api/client';

interface ParsedMemory {
  uri: string;
  content: string;
}

function parseFrontmatter(raw: string): { uri: string | null; content: string } {
  const fencePattern = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;
  const match = fencePattern.exec(raw);
  if (!match) {
    return { uri: null, content: raw };
  }
  const frontmatter = match[1];
  const uriMatch = /^uri:\s*(.+)$/m.exec(frontmatter);
  const uri = uriMatch ? uriMatch[1].trim() : null;
  const content = raw.slice(match[0].length);
  return { uri, content };
}

function uriFromFilename(filename: string): string {
  return filename
    .replace(/\.md$/i, '')
    .replaceAll('\\', '/');
}

function extractSummaries(markdown: string): { l0: string; l1: string } {
  const lines = markdown.split('\n').filter((l) => l.trim().length > 0);
  const firstLine = (lines[0] ?? '').replace(/^#+\s*/, '').replace(/^[-*]\s*/, '').trim();
  const l0 = firstLine.slice(0, 500);
  const plainText = markdown.replace(/[#*_`>\[\]()!~-]/g, '').replace(/\s+/g, ' ').trim();
  const l1 = plainText.slice(0, 500);
  return { l0, l1 };
}

async function uploadMemory(
  client: ApiClient,
  masterKey: Uint8Array,
  chestName: string,
  uri: string,
  content: string
): Promise<void> {
  const plaintext = new TextEncoder().encode(content);
  const { l0, l1 } = extractSummaries(content);
  const encryptedL2 = await encryptL2(masterKey, chestName, uri, plaintext);
  const encryptedBytes = Uint8Array.from(atob(encryptedL2), (c) => c.charCodeAt(0));
  const hash = await sha256(encryptedBytes);
  await client.remember({ uri, l0, l1, encryptedL2, sha256: hash, chest: chestName });
}

export async function importMdFile(
  file: File,
  client: ApiClient,
  masterKey: Uint8Array,
  chestName: string
): Promise<string> {
  const raw = await file.text();
  const { uri: frontmatterUri, content } = parseFrontmatter(raw);
  const uri = frontmatterUri ?? uriFromFilename(file.name);
  await uploadMemory(client, masterKey, chestName, uri, content);
  return uri;
}

interface ImportResult {
  imported: string[];
  failed: Array<{ filename: string; error: string }>;
}

interface ManifestEntry {
  uri: string;
  filename: string;
}

interface Manifest {
  memories?: ManifestEntry[];
}

export async function importZipFile(
  file: File,
  client: ApiClient,
  masterKey: Uint8Array,
  chestName: string,
  onProgress?: (done: number, total: number) => void
): Promise<ImportResult> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  // Build URI map from manifest if present
  const uriByFilename = new Map<string, string>();
  const manifestFile = zip.file('manifest.json');
  if (manifestFile) {
    try {
      const manifestText = await manifestFile.async('string');
      const manifest = JSON.parse(manifestText) as Manifest;
      for (const entry of manifest.memories ?? []) {
        uriByFilename.set(entry.filename, entry.uri);
      }
    } catch {
      // Ignore malformed manifest — fall back to frontmatter / filename
    }
  }

  const mdFiles = Object.entries(zip.files).filter(
    ([name, f]) => name.endsWith('.md') && !f.dir
  );

  const total = mdFiles.length;
  const imported: string[] = [];
  const failed: Array<{ filename: string; error: string }> = [];
  let done = 0;

  for (const [filename, zipEntry] of mdFiles) {
    try {
      const raw = await zipEntry.async('string');
      const { uri: frontmatterUri, content } = parseFrontmatter(raw);
      const uri =
        frontmatterUri ??
        uriByFilename.get(filename) ??
        uriFromFilename(filename);
      await uploadMemory(client, masterKey, chestName, uri, content);
      imported.push(uri);
    } catch (err) {
      failed.push({
        filename,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
    done += 1;
    onProgress?.(done, total);
  }

  return { imported, failed };
}
