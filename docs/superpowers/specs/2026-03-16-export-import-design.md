# Export / Import Design

## Overview

Client-side export and import of memories as markdown files with YAML frontmatter. Single memory export from the editor, chest-level zip export from the Chests page, and import via .md/.zip file upload. All encryption/decryption happens in the browser — server never sees plaintext.

---

## Section 1: Single Memory Export

In the MemoryEditor header, an EXPORT button downloads the current memory as a `.md` file.

- Content is already decrypted in the Tiptap editor — no additional API calls needed
- Markdown file includes YAML frontmatter with metadata:

```markdown
---
uri: project/database
chest: acme-corp
exported: 2026-03-16T12:00:00Z
---

Acme Corp uses PostgreSQL 16 on AWS RDS...
```

- Filename: URI slug with `.md` extension (e.g., `project-database.md`)
- Download triggered via `URL.createObjectURL` + anchor click

---

## Section 2: Chest Export (Zip)

On the Chests page, an EXPORT button per chest downloads all memories as a zip.

1. Shows progress ("Exporting 12 memories...")
2. Fetches all memories via `GET /v1/memory/list?chest=<name>`
3. For each memory: fetches encrypted content via `client.getContent(uri)`, decrypts client-side
4. Assembles zip using JSZip:
   - Each memory as `{uri}.md` with YAML frontmatter (folder structure preserved from URI paths)
   - `manifest.json` at root: `{ chest, exportedAt, memories: [{ uri, l0, l1, sha256, createdAt }] }`
5. Downloads as `{chestName}-export.zip`

---

## Section 3: Import

On the Chests page, an IMPORT button per chest accepts `.md`, `.json`, or `.zip` files.

**Single .md file:**
- Parse YAML frontmatter for URI (fall back to filename slug if no frontmatter)
- Strip frontmatter from content
- Encrypt client-side: `encryptL2(masterKey, chestName, uri, plaintext)`
- Generate l0 (first non-empty line) and l1 (first 500 chars plain text)
- Upload via `POST /v1/memory/remember?chest=<name>`

**.zip file:**
- Extract via JSZip
- Process each `.md` file as above
- Use `manifest.json` for metadata if present (URI mapping, original l0/l1)
- Shows progress ("Imported 8/12 memories...")

**Duplicate handling:** upsert — overwrites existing memory with same URI in that chest.

**Frontmatter parsing:** regex between `---` fences, extract `uri:` field. Simple, no YAML library needed.

---

## Section 4: File Structure

### New Dependency

- `jszip` (MIT, ~100KB, browser zip creation/extraction)

### New Files

| File | Responsibility |
|------|---------------|
| `packages/pwa/src/lib/export.ts` | `exportMemoryAsMd(content, uri, chestName)`, `exportChestAsZip(client, masterKey, chestName, memories, onProgress)` |
| `packages/pwa/src/lib/import.ts` | `importMdFile(file, client, masterKey, chestName)`, `importZipFile(file, client, masterKey, chestName, onProgress)` |

### Modified Files

| File | Changes |
|------|---------|
| `packages/pwa/src/components/MemoryEditor.tsx` | Add EXPORT button in header |
| `packages/pwa/src/pages/Chests.tsx` | Add EXPORT + IMPORT buttons per chest with progress state |
| `packages/pwa/package.json` | Add `jszip` |

### No API Changes

All export/import logic is client-side. Existing endpoints are sufficient:
- `GET /v1/memory/list?chest=` — list memories for export
- `GET /v1/memory/content/{uri}?chest=` — fetch encrypted content for export
- `POST /v1/memory/remember?chest=` — store imported memories

---

## Implementation Order

1. Install jszip dependency
2. Create `lib/export.ts` — exportMemoryAsMd + exportChestAsZip
3. Create `lib/import.ts` — importMdFile + importZipFile
4. Add EXPORT button to MemoryEditor
5. Add EXPORT + IMPORT to Chests page
6. Final verification
