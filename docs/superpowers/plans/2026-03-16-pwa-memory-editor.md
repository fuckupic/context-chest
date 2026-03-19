# PWA Memory Editor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the decrypt-then-view memory detail with a Tiptap WYSIWYG markdown editor that auto-decrypts, supports inline editing, and re-encrypts on Cmd+S save.

**Architecture:** Tiptap editor with `tiptap-markdown` for serialization replaces `MemoryDetail`. Auto-decrypt on mount with v0.1 legacy fallback. Save encrypts client-side, hashes raw bytes, uploads via extended `PUT /content/*` endpoint that now also accepts l0/l1 summaries and updates the OpenViking vector index.

**Tech Stack:** Tiptap (React), tiptap-markdown, lowlight, TailwindCSS, Web Crypto API (existing), Fastify + Prisma (existing).

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `packages/pwa/src/components/MemoryEditor.tsx` | Tiptap editor: auto-decrypt on mount, Cmd+S save, error handling |
| `packages/pwa/src/components/EditorToolbar.tsx` | Formatting toolbar: bold, italic, headings, lists, code, blockquote |
| `packages/pwa/src/crypto/legacy.ts` | `decryptL2FromBytesLegacy` — v0.1 decrypt with uri-only salt |
| `packages/pwa/src/components/editor-styles.css` | Tiptap prose styling for cc-dark theme |

### Modified Files
| File | Changes |
|------|---------|
| `packages/pwa/package.json` | Add Tiptap + lowlight dependencies |
| `src/routes/memory.ts` | Extend `PUT /content/*` to accept optional l0/l1 |
| `src/services/memory.ts` | Extend `updateContent` to accept optional l0/l1, call `context.write()` |
| `packages/pwa/src/api/client.ts` | Add `updateMemory()` method |
| `packages/pwa/src/pages/Memories.tsx` | Replace MemoryDetail with MemoryEditor, add dirty state + confirm dialog |

### Deleted Files
| File | Reason |
|------|--------|
| `packages/pwa/src/components/MemoryDetail.tsx` | Replaced by MemoryEditor |

---

## Chunk 1: Backend + Dependencies + Crypto

### Task 1: Install Tiptap Dependencies

**Files:**
- Modify: `packages/pwa/package.json`

- [ ] **Step 1: Install dependencies**

Run:
```bash
cd /Users/tadytudy/Desktop/context-chest/packages/pwa && npm install @tiptap/react @tiptap/starter-kit @tiptap/pm @tiptap/extension-placeholder @tiptap/extension-code-block-lowlight lowlight @tiptap/extension-link @tiptap/extension-task-list @tiptap/extension-task-item tiptap-markdown
```

- [ ] **Step 2: Commit**

```bash
git add packages/pwa/package.json packages/pwa/package-lock.json
git commit -m "chore: add Tiptap editor dependencies"
```

---

### Task 2: Extend PUT /content/* Endpoint

**Files:**
- Modify: `src/routes/memory.ts`
- Modify: `src/services/memory.ts`

- [ ] **Step 1: Update MemoryService.updateContent to accept optional l0/l1**

In `src/services/memory.ts`, update the `updateContent` method signature and body:

```typescript
async updateContent(
  userId: string, chestId: string, chestName: string, uri: string,
  encryptedL2: Buffer, sha256: string, encryptionVersion: number,
  l0?: string, l1?: string
): Promise<void> {
  const entry = await this.prisma.memoryEntry.findUnique({
    where: { userId_chestId_uri: { userId, chestId, uri } },
  });
  if (!entry) throw new Error('Memory not found');

  const key = this.s3Key(userId, chestId, uri);
  if (this.storage) await this.storage.upload(key, encryptedL2, sha256);

  const updateData: Record<string, unknown> = {
    s3Key: key, sha256, sizeBytes: encryptedL2.length, content: encryptedL2, encryptionVersion,
  };
  if (l0 !== undefined) updateData.l0 = l0;
  if (l1 !== undefined) updateData.l1 = l1;

  await this.prisma.memoryEntry.update({
    where: { id: entry.id },
    data: updateData,
  });

  // Update OpenViking index when summaries change
  if (l0 !== undefined && l1 !== undefined) {
    await this.context.write(userId, uri, { l0, l1 }, chestName).catch(() => {});
  }
}
```

- [ ] **Step 2: Update the PUT /content/* route to accept optional l0/l1**

In `src/routes/memory.ts`, update the Zod schema for the PUT /content/* handler:

```typescript
const body = z.object({
  encryptedL2: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  encryptionVersion: z.number().int().min(1).max(2),
  l0: z.string().min(1).max(500).optional(),
  l1: z.string().min(1).max(10000).optional(),
}).parse(request.body);
```

Pass `chestName`, `body.l0`, `body.l1` to the service call:

```typescript
await memoryService.updateContent(userId, chestId, chestName, uri, Buffer.from(body.encryptedL2, 'base64'), body.sha256, body.encryptionVersion, body.l0, body.l1);
```

- [ ] **Step 3: Update existing tests for updateContent**

Update `src/tests/services/memory.test.ts` — the updateContent tests need the new `chestName` parameter and tests for l0/l1 + context.write.

- [ ] **Step 4: Run tests**

Run: `npx jest src/tests/services/memory.test.ts --no-coverage`

- [ ] **Step 5: Commit**

```bash
git add src/routes/memory.ts src/services/memory.ts src/tests/services/memory.test.ts
git commit -m "feat: extend PUT /content/* to accept optional l0/l1 summaries + update OpenViking"
```

---

### Task 3: PWA Legacy Crypto + Client Method

**Files:**
- Create: `packages/pwa/src/crypto/legacy.ts`
- Modify: `packages/pwa/src/api/client.ts`

- [ ] **Step 1: Create legacy decrypt function**

Create `packages/pwa/src/crypto/legacy.ts`:

```typescript
const IV_LENGTH = 12;
const TAG_LENGTH = 128;

async function deriveAesKey(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits', 'deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
}

export async function decryptL2FromBytesLegacy(
  masterKey: Uint8Array,
  uri: string,
  encryptedBytes: ArrayBuffer
): Promise<Uint8Array> {
  const salt = new TextEncoder().encode(uri);
  const info = new TextEncoder().encode('context-chest-l2');
  const key = await deriveAesKey(masterKey, salt, info);
  const data = new Uint8Array(encryptedBytes);
  const iv = data.slice(0, IV_LENGTH);
  const ciphertext = data.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LENGTH },
    key,
    ciphertext
  );
  return new Uint8Array(decrypted);
}
```

- [ ] **Step 2: Add updateMemory to PWA client**

In `packages/pwa/src/api/client.ts`, add method:

```typescript
async updateMemory(uri: string, data: { l0: string; l1: string; encryptedL2: string; sha256: string }) {
  return this.request<{ success: boolean }>(
    'PUT', `/v1/memory/content/${uri}?chest=${encodeURIComponent(this.chestName)}`,
    { ...data, encryptionVersion: 2 }
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/pwa/src/crypto/legacy.ts packages/pwa/src/api/client.ts
git commit -m "feat: PWA legacy decrypt + updateMemory client method"
```

---

## Chunk 2: Editor Components + Integration

### Task 4: Editor Styles

**Files:**
- Create: `packages/pwa/src/components/editor-styles.css`

- [ ] **Step 1: Create Tiptap prose styles**

Create `packages/pwa/src/components/editor-styles.css`:

```css
.tiptap-editor .ProseMirror {
  outline: none;
  min-height: 200px;
  padding: 1rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.875rem;
  line-height: 1.7;
  color: #ccc;
}

.tiptap-editor .ProseMirror h1 { font-size: 1.5rem; font-weight: bold; color: #fff; margin: 1.5rem 0 0.75rem; }
.tiptap-editor .ProseMirror h2 { font-size: 1.25rem; font-weight: bold; color: #fff; margin: 1.25rem 0 0.5rem; }
.tiptap-editor .ProseMirror h3 { font-size: 1.1rem; font-weight: bold; color: #fff; margin: 1rem 0 0.5rem; }

.tiptap-editor .ProseMirror p { margin: 0.5rem 0; }

.tiptap-editor .ProseMirror ul,
.tiptap-editor .ProseMirror ol { padding-left: 1.5rem; margin: 0.5rem 0; color: #999; }
.tiptap-editor .ProseMirror li { margin: 0.25rem 0; }

.tiptap-editor .ProseMirror pre {
  background: #0a0a0a;
  border: 1px solid #333;
  border-radius: 4px;
  padding: 0.75rem;
  margin: 0.75rem 0;
  overflow-x: auto;
}
.tiptap-editor .ProseMirror code {
  background: #1a1a2e;
  padding: 0.15rem 0.3rem;
  border-radius: 2px;
  font-size: 0.85em;
  color: #ff6b9d;
}
.tiptap-editor .ProseMirror pre code {
  background: none;
  padding: 0;
  color: #ccc;
}

.tiptap-editor .ProseMirror blockquote {
  border-left: 3px solid #ff2d7b;
  padding-left: 1rem;
  margin: 0.75rem 0;
  color: #888;
}

.tiptap-editor .ProseMirror a { color: #ff2d7b; text-decoration: none; }
.tiptap-editor .ProseMirror a:hover { text-decoration: underline; }

.tiptap-editor .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 0; }
.tiptap-editor .ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
.tiptap-editor .ProseMirror ul[data-type="taskList"] input[type="checkbox"] { accent-color: #ff2d7b; margin-top: 0.3rem; }

.tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: #555;
  pointer-events: none;
  height: 0;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/pwa/src/components/editor-styles.css
git commit -m "feat: Tiptap editor prose styles for cc-dark theme"
```

---

### Task 5: EditorToolbar Component

**Files:**
- Create: `packages/pwa/src/components/EditorToolbar.tsx`

- [ ] **Step 1: Create toolbar**

Create `packages/pwa/src/components/EditorToolbar.tsx`:

```typescript
import { Editor } from '@tiptap/react';

interface EditorToolbarProps {
  editor: Editor | null;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
}

function ToolbarButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 text-xs font-mono transition-colors ${
        active ? 'text-cc-pink bg-cc-pink-glow' : 'text-cc-muted hover:text-cc-white'
      }`}
    >
      {label}
    </button>
  );
}

export function EditorToolbar({ editor, onSave, saving, dirty }: EditorToolbarProps) {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b-2 border-cc-border bg-cc-dark flex-wrap">
      <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} label="B" />
      <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} label="I" />
      <ToolbarButton active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()} label="<>" />
      <div className="w-px h-4 bg-cc-border mx-1" />
      <ToolbarButton active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} label="H1" />
      <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} label="H2" />
      <ToolbarButton active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} label="H3" />
      <div className="w-px h-4 bg-cc-border mx-1" />
      <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} label="&bull;" />
      <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} label="1." />
      <ToolbarButton active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()} label="[]" />
      <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} label=">" />
      <ToolbarButton active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} label="{}" />
      <div className="flex-1" />
      <button
        onClick={onSave}
        disabled={saving || !dirty}
        className={`px-3 py-1 font-pixel text-[10px] tracking-wider border-2 transition-colors ${
          dirty
            ? 'border-cc-pink text-cc-pink hover:bg-cc-pink hover:text-cc-black'
            : 'border-cc-border text-cc-muted'
        } disabled:opacity-50`}
      >
        {saving ? 'SAVING...' : 'SAVE'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/pwa/src/components/EditorToolbar.tsx
git commit -m "feat: EditorToolbar component with formatting buttons and save"
```

---

### Task 6: MemoryEditor Component

**Files:**
- Create: `packages/pwa/src/components/MemoryEditor.tsx`

- [ ] **Step 1: Create the editor component**

Create `packages/pwa/src/components/MemoryEditor.tsx`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';
import { useAuth } from '../auth/context';
import { useChest } from '../context/chest-context';
import { decryptL2FromBytes, encryptL2, sha256 } from '../crypto';
import { decryptL2FromBytesLegacy } from '../crypto/legacy';
import { EditorToolbar } from './EditorToolbar';
import './editor-styles.css';

interface MemoryEditorProps {
  uri: string;
  l0: string;
  onDirtyChange?: (dirty: boolean) => void;
}

function extractSummaries(markdown: string): { l0: string; l1: string } {
  const lines = markdown.split('\n').filter((l) => l.trim().length > 0);
  const firstLine = (lines[0] ?? '').replace(/^#+\s*/, '').replace(/^[-*]\s*/, '').trim();
  const l0 = firstLine.slice(0, 500);
  const plainText = markdown.replace(/[#*_`>\[\]()!~-]/g, '').replace(/\s+/g, ' ').trim();
  const l1 = plainText.slice(0, 500);
  return { l0, l1 };
}

export function MemoryEditor({ uri, l0, onDirtyChange }: MemoryEditorProps) {
  const { client, masterKey } = useAuth();
  const { activeChest } = useChest();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);

  const chestName = activeChest?.name ?? 'default';

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder: 'Start typing...' }),
      Link.configure({ openOnClick: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Markdown,
    ],
    content: '',
    onUpdate: () => {
      setDirty(true);
      onDirtyChange?.(true);
    },
  });

  // Auto-decrypt on mount / uri change
  useEffect(() => {
    if (!client || !masterKey || !editor) return;

    setLoading(true);
    setError(null);
    setDirty(false);
    onDirtyChange?.(false);

    client.getContent(uri)
      .then(async (encryptedBytes) => {
        let plaintext: Uint8Array;
        try {
          plaintext = await decryptL2FromBytes(masterKey, chestName, uri, encryptedBytes);
        } catch {
          try {
            plaintext = await decryptL2FromBytesLegacy(masterKey, uri, encryptedBytes);
          } catch {
            throw new Error('Decryption failed — memory may be corrupted or encrypted with a different key');
          }
        }
        const text = new TextDecoder().decode(plaintext);
        editor.commands.setContent(text);
        setDirty(false);
        onDirtyChange?.(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load memory');
      })
      .finally(() => setLoading(false));
  }, [uri, client, masterKey, editor, chestName]);

  // Save handler
  const handleSave = useCallback(async () => {
    if (!client || !masterKey || !editor || !dirty) return;

    setSaving(true);
    setError(null);
    try {
      const markdown = editor.storage.markdown.getMarkdown();
      const plaintext = new TextEncoder().encode(markdown);
      const { l0: newL0, l1: newL1 } = extractSummaries(markdown);
      const encrypted = await encryptL2(masterKey, chestName, uri, plaintext);
      const encryptedBytes = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
      const hash = await sha256(encryptedBytes);

      await client.updateMemory(uri, { l0: newL0, l1: newL1, encryptedL2: encrypted, sha256: hash });
      setDirty(false);
      onDirtyChange?.(false);
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 2000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      if (msg.includes('401')) setError('Session expired — please log in again');
      else if (msg.includes('429')) setError('Rate limited — try again in a moment');
      else setError(`Save failed — ${msg}`);
    } finally {
      setSaving(false);
    }
  }, [client, masterKey, editor, dirty, chestName, uri, onDirtyChange]);

  // Cmd+S keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleSave]);

  const pathSegments = uri.split('/');
  const fileName = pathSegments.pop() || uri;
  const dirPath = pathSegments.join('/');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b-2 border-cc-border flex items-center gap-2 shrink-0 bg-cc-dark">
        {dirPath && <span className="font-mono text-[10px] text-cc-muted">{dirPath}/</span>}
        <span className="font-pixel text-sm text-cc-white tracking-wider">{fileName.toUpperCase()}</span>
        {dirty && <span className="w-2 h-2 rounded-full bg-cc-pink" title="Unsaved changes" />}
        {savedMessage && <span className="text-green-400 text-xs font-mono ml-2">Saved</span>}
        <div className="flex-1" />
        <span className="font-pixel text-[9px] text-cc-muted tracking-wider">{chestName}</span>
      </div>

      {/* Toolbar */}
      <EditorToolbar editor={editor} onSave={handleSave} saving={saving} dirty={dirty} />

      {/* Editor / Loading / Error */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="p-5 space-y-3">
            <p className="text-sm text-cc-sub">{l0}</p>
            <div className="space-y-2 animate-pulse">
              <div className="h-3 bg-cc-surface rounded w-3/4" />
              <div className="h-3 bg-cc-surface rounded w-1/2" />
              <div className="h-3 bg-cc-surface rounded w-5/6" />
            </div>
          </div>
        )}

        {error && (
          <div className="m-4 border-2 border-red-500/30 bg-red-500/5 p-3 text-red-400 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-3">x</button>
          </div>
        )}

        {!loading && <div className="tiptap-editor"><EditorContent editor={editor} /></div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/pwa/src/components/MemoryEditor.tsx
git commit -m "feat: MemoryEditor — Tiptap WYSIWYG with auto-decrypt, Cmd+S save, error handling"
```

---

### Task 7: Integrate into Memories Page + Delete MemoryDetail

**Files:**
- Modify: `packages/pwa/src/pages/Memories.tsx`
- Delete: `packages/pwa/src/components/MemoryDetail.tsx`

- [ ] **Step 1: Update Memories.tsx**

Read the file first. Replace MemoryDetail import and usage:

Change import from:
```typescript
import { MemoryDetail } from '../components/MemoryDetail';
```
To:
```typescript
import { MemoryEditor } from '../components/MemoryEditor';
```

Add dirty state tracking:
```typescript
const [isDirty, setIsDirty] = useState(false);
```

Add unsaved-changes guard when switching memories — update `onSelect` in TreeItem:
```typescript
const handleSelectMemory = (newUri: string) => {
  if (isDirty && !confirm('You have unsaved changes. Discard them?')) return;
  setSelectedUri(newUri);
};
```

Replace the MemoryDetail render with MemoryEditor:
```typescript
{selectedEntry ? (
  <MemoryEditor
    key={selectedEntry.uri}
    uri={selectedEntry.uri}
    l0={selectedEntry.l0}
    onDirtyChange={setIsDirty}
  />
) : (
  // ... existing empty state
)}
```

Use `handleSelectMemory` instead of `setSelectedUri` in the TreeItem `onSelect` prop.

- [ ] **Step 2: Delete MemoryDetail.tsx**

Run: `rm packages/pwa/src/components/MemoryDetail.tsx`

- [ ] **Step 3: Verify the app compiles**

Run: `cd packages/pwa && npx tsc --noEmit 2>&1 | head -20`

If there are import errors from other files referencing MemoryDetail, fix them (there should be none since only Memories.tsx imported it).

- [ ] **Step 4: Commit**

```bash
git add packages/pwa/src/pages/Memories.tsx && git rm packages/pwa/src/components/MemoryDetail.tsx
git commit -m "feat: replace MemoryDetail with MemoryEditor in Memories page"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run all backend tests**

Run: `cd /Users/tadytudy/Desktop/context-chest && npx jest --no-coverage`

- [ ] **Step 2: Restart API server and PWA**

Kill existing servers and restart:
```bash
pkill -f "ts-node-dev" 2>/dev/null; sleep 1
cd /Users/tadytudy/Desktop/context-chest && npx ts-node-dev --respawn --transpile-only src/index.ts &
cd /Users/tadytudy/Desktop/context-chest/packages/pwa && npm run dev &
```

- [ ] **Step 3: Manual E2E test**

Open http://localhost:5173, log in, click a memory in the tree:
- Should auto-decrypt and show content in Tiptap editor
- Toolbar should be visible with formatting buttons
- Edit content, see pink dot appear next to filename
- Press Cmd+S → should see "Saved" indicator
- Switch to another memory → should prompt about unsaved changes

- [ ] **Step 4: Final commit + push**

```bash
git add -A && git commit -m "feat: PWA memory editor — Tiptap WYSIWYG with auto-decrypt and Cmd+S save"
git push
```
