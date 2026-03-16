# Export / Import Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client-side export (single memory as .md, full chest as .zip) and import (.md/.zip) to the PWA.

**Architecture:** Pure utility functions in `lib/export.ts` and `lib/import.ts` handle all logic — decrypt, serialize, zip/unzip, encrypt, upload. Components call these and manage UI state. No API changes — existing endpoints are sufficient. All crypto happens in the browser.

**Tech Stack:** JSZip (zip creation/extraction), Web Crypto API (existing), Tiptap (existing editor), React + TailwindCSS.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `packages/pwa/src/lib/export.ts` | `exportMemoryAsMd()`, `exportChestAsZip()` |
| `packages/pwa/src/lib/import.ts` | `importMdFile()`, `importZipFile()` |

### Modified Files
| File | Changes |
|------|---------|
| `packages/pwa/package.json` | Add `jszip` dependency |
| `packages/pwa/src/components/MemoryEditor.tsx` | Add EXPORT button in header |
| `packages/pwa/src/pages/Chests.tsx` | Add EXPORT + IMPORT buttons per chest with progress |

---

## Chunk 1: All Tasks

### Task 1: Install JSZip

**Files:**
- Modify: `packages/pwa/package.json`

- [ ] **Step 1: Install jszip**

Run: `cd /Users/tadytudy/Desktop/context-chest && npm install jszip`

- [ ] **Step 2: Commit**

```bash
git add package-lock.json packages/pwa/package.json
git commit -m "chore: add jszip dependency"
```

---

### Task 2: Export Utilities

**Files:**
- Create: `packages/pwa/src/lib/export.ts`

- [ ] **Step 1: Create export.ts**

```typescript
import JSZip from 'jszip';
import { decryptL2FromBytes } from '../crypto';
import { decryptL2FromBytesLegacy } from '../crypto/legacy';
import type { ApiClient } from '../api/client';

function buildFrontmatter(uri: string, chestName: string): string {
  return `---\nuri: ${uri}\nchest: ${chestName}\nexported: ${new Date().toISOString()}\n---\n\n`;
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportMemoryAsMd(content: string, uri: string, chestName: string): void {
  const frontmatter = buildFrontmatter(uri, chestName);
  const blob = new Blob([frontmatter + content], { type: 'text/markdown' });
  const filename = uri.replace(/\//g, '-') + '.md';
  triggerDownload(blob, filename);
}

async function decryptMemory(
  client: ApiClient,
  masterKey: Uint8Array,
  chestName: string,
  uri: string
): Promise<string> {
  const encryptedBytes = await client.getContent(uri);
  let plaintext: Uint8Array;
  try {
    plaintext = await decryptL2FromBytes(masterKey, chestName, uri, encryptedBytes);
  } catch {
    plaintext = await decryptL2FromBytesLegacy(masterKey, uri, encryptedBytes);
  }
  return new TextDecoder().decode(plaintext);
}

interface MemoryListItem {
  uri: string;
  l0: string;
  sha256: string;
  sizeBytes: number;
  createdAt: string;
}

export async function exportChestAsZip(
  client: ApiClient,
  masterKey: Uint8Array,
  chestName: string,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  // Fetch all memories in the chest
  const result = await client.listMemories(1, 1000);
  const memories = result.data as MemoryListItem[];

  if (memories.length === 0) {
    throw new Error('No memories to export');
  }

  const zip = new JSZip();
  const manifest: { chest: string; exportedAt: string; memories: MemoryListItem[] } = {
    chest: chestName,
    exportedAt: new Date().toISOString(),
    memories: [],
  };

  for (let i = 0; i < memories.length; i++) {
    const mem = memories[i];
    onProgress?.(i, memories.length);

    try {
      const content = await decryptMemory(client, masterKey, chestName, mem.uri);
      const frontmatter = buildFrontmatter(mem.uri, chestName);
      zip.file(`${mem.uri}.md`, frontmatter + content);
      manifest.memories.push(mem);
    } catch {
      // Skip memories that fail to decrypt — don't block the whole export
    }
  }

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  onProgress?.(memories.length, memories.length);

  const blob = await zip.generateAsync({ type: 'blob' });
  triggerDownload(blob, `${chestName}-export.zip`);
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/pwa/src/lib/export.ts
git commit -m "feat: export utilities — single memory .md + chest .zip"
```

---

### Task 3: Import Utilities

**Files:**
- Create: `packages/pwa/src/lib/import.ts`

- [ ] **Step 1: Create import.ts**

```typescript
import JSZip from 'jszip';
import { encryptL2, sha256 } from '../crypto';
import type { ApiClient } from '../api/client';

function parseFrontmatter(content: string): { uri: string | null; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
  if (!match) return { uri: null, body: content };

  const frontmatter = match[1];
  const body = match[2];
  const uriMatch = frontmatter.match(/^uri:\s*(.+)$/m);
  return { uri: uriMatch?.[1]?.trim() ?? null, body };
}

function filenameToUri(filename: string): string {
  return filename
    .replace(/\.md$/i, '')
    .replace(/\\/g, '/')
    .replace(/^\//, '');
}

function extractSummaries(text: string): { l0: string; l1: string } {
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const firstLine = (lines[0] ?? '').replace(/^#+\s*/, '').replace(/^[-*]\s*/, '').trim();
  const l0 = firstLine.slice(0, 500);
  const plainText = text.replace(/[#*_`>\[\]()!~-]/g, '').replace(/\s+/g, ' ').trim();
  const l1 = plainText.slice(0, 500);
  return { l0, l1 };
}

async function encryptAndUpload(
  client: ApiClient,
  masterKey: Uint8Array,
  chestName: string,
  uri: string,
  content: string
): Promise<void> {
  const plaintext = new TextEncoder().encode(content);
  const { l0, l1 } = extractSummaries(content);
  const encrypted = await encryptL2(masterKey, chestName, uri, plaintext);
  const encryptedBytes = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const hash = await sha256(encryptedBytes);

  await client.remember({
    uri,
    l0,
    l1,
    encryptedL2: encrypted,
    sha256: hash,
    chest: chestName,
  });
}

export async function importMdFile(
  file: File,
  client: ApiClient,
  masterKey: Uint8Array,
  chestName: string
): Promise<string> {
  const text = await file.text();
  const { uri, body } = parseFrontmatter(text);
  const finalUri = uri ?? filenameToUri(file.name);

  await encryptAndUpload(client, masterKey, chestName, finalUri, body);
  return finalUri;
}

export async function importZipFile(
  file: File,
  client: ApiClient,
  masterKey: Uint8Array,
  chestName: string,
  onProgress?: (done: number, total: number) => void
): Promise<{ imported: number; failed: number }> {
  const zip = await JSZip.loadAsync(file);
  const mdFiles = Object.keys(zip.files).filter((name) => name.endsWith('.md'));

  // Try to load manifest for URI mapping
  let manifest: Record<string, string> = {};
  const manifestFile = zip.files['manifest.json'];
  if (manifestFile) {
    try {
      const manifestText = await manifestFile.async('text');
      const parsed = JSON.parse(manifestText);
      if (parsed.memories) {
        for (const mem of parsed.memories) {
          manifest[`${mem.uri}.md`] = mem.uri;
        }
      }
    } catch {
      // Invalid manifest — continue without it
    }
  }

  let imported = 0;
  let failed = 0;

  for (let i = 0; i < mdFiles.length; i++) {
    const name = mdFiles[i];
    onProgress?.(i, mdFiles.length);

    try {
      const text = await zip.files[name].async('text');
      const { uri: frontmatterUri, body } = parseFrontmatter(text);
      const finalUri = frontmatterUri ?? manifest[name] ?? filenameToUri(name);

      await encryptAndUpload(client, masterKey, chestName, finalUri, body);
      imported++;
    } catch {
      failed++;
    }
  }

  onProgress?.(mdFiles.length, mdFiles.length);
  return { imported, failed };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/pwa/src/lib/import.ts
git commit -m "feat: import utilities — .md file + .zip with manifest support"
```

---

### Task 4: Add EXPORT Button to MemoryEditor

**Files:**
- Modify: `packages/pwa/src/components/MemoryEditor.tsx`

- [ ] **Step 1: Add export to MemoryEditor**

Read the file first. Add import:

```typescript
import { exportMemoryAsMd } from '../lib/export';
```

Add an export handler inside the component (after `handleSave`):

```typescript
const handleExport = useCallback(() => {
  if (!editor) return;
  const markdown = (editor.storage as unknown as { markdown: { getMarkdown: () => string } }).markdown.getMarkdown();
  exportMemoryAsMd(markdown, uri, chestName);
}, [editor, uri, chestName]);
```

In the header div (after the chest name span), add an EXPORT button:

```tsx
<button
  onClick={handleExport}
  className="font-pixel text-[10px] text-cc-muted hover:text-cc-pink tracking-wider transition-colors"
>
  EXPORT
</button>
```

- [ ] **Step 2: Commit**

```bash
git add packages/pwa/src/components/MemoryEditor.tsx
git commit -m "feat: add EXPORT button to MemoryEditor"
```

---

### Task 5: Add EXPORT + IMPORT to Chests Page

**Files:**
- Modify: `packages/pwa/src/pages/Chests.tsx`

- [ ] **Step 1: Add export/import to Chests page**

Read the file first. Add imports:

```typescript
import { exportChestAsZip } from '../lib/export';
import { importMdFile, importZipFile } from '../lib/import';
```

Add state for progress:

```typescript
const [exportingChest, setExportingChest] = useState<string | null>(null);
const [exportProgress, setExportProgress] = useState('');
const [importingChest, setImportingChest] = useState<string | null>(null);
const [importProgress, setImportProgress] = useState('');
```

Get masterKey from auth:

```typescript
const { client, masterKey } = useAuth();
```

Add export handler:

```typescript
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
```

Add import handler:

```typescript
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
          totalImported += result.imported;
          totalFailed += result.failed;
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
```

In the chest list item buttons area, add EXPORT and IMPORT buttons alongside existing DELETE and PERMISSIONS buttons:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/pwa/src/pages/Chests.tsx
git commit -m "feat: EXPORT + IMPORT buttons on Chests page with progress"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Run all backend tests**

Run: `cd /Users/tadytudy/Desktop/context-chest && npx jest --no-coverage`

- [ ] **Step 2: Verify the PWA compiles**

Kill and restart the PWA dev server, verify it loads at localhost without errors.

- [ ] **Step 3: Manual E2E test**

Open PWA, log in:
- Click a memory → verify EXPORT button in editor header → click it → `.md` file downloads with frontmatter
- Go to Chests page → click EXPORT on a chest → verify zip downloads with `.md` files and `manifest.json`
- Click IMPORT on a chest → select a `.md` file → verify it appears in the chest
- Click IMPORT → select a `.zip` file (the one just exported) → verify memories are imported

- [ ] **Step 4: Final commit + push**

```bash
git add -A && git commit -m "feat: export/import — single memory .md + chest .zip + import with progress"
git push
```
