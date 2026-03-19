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
- `tiptap-markdown` (serialize/deserialize markdown — chosen over official `@tiptap/extension-markdown` for MIT license and maturity)

### Flow

1. User clicks memory in tree → component mounts with `uri` prop
2. Auto-decrypts content on mount (no "click Decrypt" button)
3. Renders decrypted markdown in Tiptap editor (starts editable — no read-only toggle, use `editor.setEditable()` is unnecessary complexity)
4. Toolbar always visible above content: **B** *I* `code` H1 H2 bullet-list ordered-list task-list blockquote
5. Cmd+S (with `e.preventDefault()` to block browser save dialog) or Save button → re-encrypts → uploads → shows "Saved" indicator
6. Unsaved changes tracked via `editor.on('update')` — parent `Memories.tsx` receives dirty state via `onDirtyChange` callback prop, shows dot next to filename in tree
7. Switching memories with unsaved changes → shows confirm dialog ("Unsaved changes. Discard?")

### Toolbar Styling

Matches cc-dark theme — dark background, cc-muted icons, cc-pink on hover/active. Compact, pixel-font labels.

### Editor Content CSS

Tiptap editor area styled with custom prose classes:
- Headings: cc-white, scaled sizes
- Code blocks: cc-dark background with cc-border, monospace
- Lists: cc-sub color, proper indentation
- Task items: cc-pink checkboxes
- Links: cc-pink, underline on hover
- Blockquotes: left border cc-pink, cc-muted text

---

## Section 2: Encrypt-on-Save Flow

When the user saves (Cmd+S or Save button):

1. Extract l0/l1 summaries from content (BEFORE upload):
   - `l0`: first non-empty line, stripped of markdown prefix (`#`, `- `, etc.), truncated to 500 chars
   - `l1`: first 500 chars of plain text (markdown stripped), max 10000 per schema
2. Get markdown from Tiptap via `editor.storage.markdown.getMarkdown()`
3. Encode as UTF-8 `Uint8Array`
4. Encrypt using existing `encryptL2(masterKey, chestName, uri, plaintext)` from `packages/pwa/src/crypto/index.ts` — returns base64 string
5. Hash: decode base64 back to `Uint8Array`, then `sha256(rawBytes)` → hex string (consistent with how MCP server hashes in `remember.ts`)
6. Upload via existing `PUT /v1/memory/content/*?chest=<chestName>` endpoint extended to accept optional `l0`/`l1` fields
7. Show brief "Saved" toast (green text, fades after 2s). On failure: show red error inline with message.

### Extending Existing Endpoint (not a new one)

Extend `PUT /v1/memory/content/*` to accept optional `l0` and `l1` in the request body:
- Request: `{ encryptedL2: string, sha256: string, encryptionVersion: number, l0?: string, l1?: string }`
- When `l0`/`l1` present: update Prisma row + call `context.write()` to update OpenViking vector index
- When absent: behaves as before (content-only update for migration)
- Uses `requirePermission('remember')` + `chestGuard`

This avoids creating an overlapping endpoint. The existing `memoryService.updateContent()` method is extended to accept optional `l0`/`l1` and call `context.write()` when provided.

---

## Section 3: Auto-Decrypt on Mount

1. `MemoryEditor` mounts with `uri` and `l0` props
2. Shows l0 summary + pulsing `cc-muted` placeholder lines as loading skeleton
3. Calls `client.getContent(uri)` in the background
4. Decrypts with `decryptL2FromBytes(masterKey, chestName, uri, bytes)` (existing function)
5. If decryption fails (v0.2 scheme), tries `decryptL2FromBytesLegacy(masterKey, uri, bytes)` (v0.1 salt)
6. Converts decrypted bytes to string, loads into Tiptap as markdown via `editor.commands.setContent(markdownString)`
7. If both decryptions fail → shows red error inline with message (never silent)

### New PWA Crypto Function

`decryptL2FromBytesLegacy(masterKey, uri, bytes)` in `packages/pwa/src/crypto/legacy.ts` — same as `decryptL2FromBytes` but uses `uri` as the HKDF salt instead of `chestName/uri`. For backwards compat with pre-migration memories.

---

## Section 4: Error Handling

### Save Failures
- Network error → red inline error "Save failed — check your connection"
- 401 → red inline error "Session expired — please log in again"
- 429 → red inline error "Rate limited — try again in a moment"
- Any other error → red inline error with server message

### Decrypt Failures
- Both v0.2 and v0.1 schemes fail → red inline error "Decryption failed — memory may be corrupted or encrypted with a different key"
- Network error fetching content → "Failed to load memory — check your connection"

All errors are dismissible and don't block the UI — user can still navigate to other memories.

---

## Section 5: File Structure

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
| `packages/pwa/src/components/MemoryEditor.tsx` | Tiptap editor with auto-decrypt, save, Cmd+S handler |
| `packages/pwa/src/components/EditorToolbar.tsx` | Formatting toolbar component |
| `packages/pwa/src/crypto/legacy.ts` | `decryptL2FromBytesLegacy` for v0.1 backwards compat |

### Modified Files

| File | Changes |
|------|---------|
| `packages/pwa/src/pages/Memories.tsx` | Replace `<MemoryDetail>` with `<MemoryEditor>`, add `onDirtyChange` prop, unsaved confirm dialog |
| `packages/pwa/src/api/client.ts` | Add `updateMemory(uri, { l0, l1, encryptedL2, sha256 })` method |
| `src/routes/memory.ts` | Extend `PUT /content/*` to accept optional l0/l1 |
| `src/services/memory.ts` | Extend `updateContent` to accept optional l0/l1, call `context.write()` when provided |
| `packages/pwa/package.json` | Add Tiptap dependencies |

### Deleted Files

| File | Reason |
|------|--------|
| `packages/pwa/src/components/MemoryDetail.tsx` | Replaced by MemoryEditor |

---

## Implementation Order

1. Install Tiptap dependencies
2. API: extend `PUT /content/*` with optional l0/l1 + context.write
3. PWA crypto: `decryptL2FromBytesLegacy` in `legacy.ts`
4. PWA client: `updateMemory()` method
5. `EditorToolbar` component
6. `MemoryEditor` component (auto-decrypt, Tiptap, save flow, error handling)
7. Replace MemoryDetail in Memories page (add onDirtyChange, unsaved confirm)
8. Delete MemoryDetail.tsx
