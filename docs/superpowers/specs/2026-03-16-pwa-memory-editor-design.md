# PWA Memory Editor Design

## Overview

Replace the current decrypt-then-view flow with a full Tiptap WYSIWYG markdown editor. Memories auto-decrypt on selection and are editable inline. Save via Cmd+S or button, which re-encrypts and uploads.

---

## Section 1: Editor Component

New `MemoryEditor` component replaces `MemoryDetail`. Uses Tiptap with extensions:
- `StarterKit` (paragraphs, headings, bold, italic, lists, code blocks, blockquotes)
- `Placeholder` ("Start typing...")
- `CodeBlockLowlight` (syntax highlighted code blocks)
- `Link`
- `TaskList` / `TaskItem` (checkboxes)
- `tiptap-markdown` (serialize/deserialize markdown)

### Flow

1. User clicks memory in tree → component mounts with `uri` prop
2. Auto-decrypts content on mount (no "click Decrypt" button)
3. Renders decrypted markdown in Tiptap editor (read mode initially)
4. Click anywhere in content or press Enter → editor becomes active
5. Toolbar appears above content: **B** *I* `code` H1 H2 bullet-list ordered-list task-list blockquote
6. Cmd+S or Save button → re-encrypts → uploads → shows "Saved" indicator
7. Unsaved changes show a dot next to the file name in the tree

### Toolbar Styling

Matches cc-dark theme — dark background, cc-muted icons, cc-pink on hover/active. Compact, pixel-font labels.

---

## Section 2: Encrypt-on-Save Flow

When the user saves (Cmd+S or Save button):

1. Get markdown from Tiptap via `editor.storage.markdown.getMarkdown()`
2. Encode as UTF-8 `Uint8Array`
3. Encrypt: `encryptL2(masterKey, chestName, uri, plaintext)` → base64 ciphertext
4. Hash: `sha256(ciphertext)`
5. Upload via `PUT /v1/memory/update?chest=<chestName>` with `{ uri, l0, l1, encryptedL2, sha256 }`
6. Extract first line as l0, first 200 chars as l1 (update summaries alongside content)
7. Show brief "Saved" toast that fades after 2 seconds

### New API Endpoint

`PUT /v1/memory/update` — updates encrypted content AND l0/l1 summaries in one call:
- Request: `{ uri: string, l0: string, l1: string, encryptedL2: string, sha256: string }`
- Validates with Zod, same constraints as remember endpoint
- Uses chestGuard for chest resolution
- Calls `memoryService.update(userId, chestId, { uri, l0, l1, encryptedL2, sha256 })`

---

## Section 3: Auto-Decrypt on Mount

1. `MemoryEditor` mounts with `uri` and `l0` props
2. Shows l0 summary + loading skeleton immediately
3. Calls `client.getContent(uri)` in the background
4. Decrypts with `decryptL2FromBytes(masterKey, chestName, uri, bytes)`
5. If decryption fails (v0.2 scheme), tries `decryptL2FromBytesLegacy(masterKey, uri, bytes)` (v0.1 salt)
6. Converts decrypted bytes to string, loads into Tiptap as markdown
7. If both decryptions fail → shows error inline

### New PWA Crypto Function

`decryptL2FromBytesLegacy(masterKey, uri, bytes)` — same as `decryptL2FromBytes` but with `uri` as the HKDF salt instead of `chestName/uri`. For backwards compat with pre-migration memories.

---

## Section 4: File Structure

### New Dependencies (packages/pwa)

- `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`
- `@tiptap/extension-placeholder`
- `@tiptap/extension-code-block-lowlight`, `lowlight`
- `@tiptap/extension-link`
- `@tiptap/extension-task-list`, `@tiptap/extension-task-item`
- `tiptap-markdown`

### New Files

| File | Responsibility |
|------|---------------|
| `packages/pwa/src/components/MemoryEditor.tsx` | Tiptap editor with auto-decrypt, save, toolbar |
| `packages/pwa/src/components/EditorToolbar.tsx` | Formatting toolbar component |
| `packages/pwa/src/crypto/legacy.ts` | `decryptL2FromBytesLegacy` for v0.1 backwards compat |

### Modified Files

| File | Changes |
|------|---------|
| `packages/pwa/src/pages/Memories.tsx` | Replace `<MemoryDetail>` with `<MemoryEditor>` |
| `packages/pwa/src/api/client.ts` | Add `updateMemory()` method |
| `src/routes/memory.ts` | Add `PUT /v1/memory/update` endpoint |
| `src/services/memory.ts` | Add `update` method (content + l0/l1) |
| `packages/pwa/package.json` | Add Tiptap dependencies |

### Deleted Files

| File | Reason |
|------|--------|
| `packages/pwa/src/components/MemoryDetail.tsx` | Replaced by MemoryEditor |

---

## Implementation Order

1. Install Tiptap dependencies
2. API: `PUT /v1/memory/update` endpoint + MemoryService.update method
3. PWA crypto: `decryptL2FromBytesLegacy`
4. PWA client: `updateMemory()` method
5. `EditorToolbar` component
6. `MemoryEditor` component (auto-decrypt, Tiptap, save flow)
7. Replace MemoryDetail in Memories page
8. Delete MemoryDetail.tsx
