# PWA Dashboard — Design Spec

**Date:** 2026-03-14
**Status:** Approved
**Summary:** Consumer-facing PWA dashboard for Context Chest — memory browser, agent management, and onboarding via smart empty states.

---

## 1. Product Vision

A file-explorer-style dashboard where users can browse their encrypted memory vault, manage connected AI agents, view sessions, and configure their account. Progressive onboarding — no wizards, just smart empty states that guide activation.

---

## 2. Architecture

### Approach: React SPA

Single-page app built with React + Vite + Tailwind. React Router handles 4 views, all behind auth. Deploys as static files (Vercel, S3, Cloudflare Pages). No server-side rendering needed.

```
packages/pwa/
├── index.html
├── src/
│   ├── main.tsx                 # React root + router
│   ├── api/client.ts            # HTTP client for Context Chest API
│   ├── crypto/
│   │   └── index.ts             # WebCrypto: HKDF + AES-GCM (browser-compatible)
│   ├── auth/
│   │   └── opaque.ts            # OPAQUE client in browser + session management
│   ├── hooks/
│   │   ├── useAuth.ts           # Auth state, login/register, MK derivation
│   │   ├── useMemories.ts       # Memory tree fetching + search
│   │   ├── useGrants.ts         # Grant list + revoke
│   │   └── useSessions.ts       # Session list
│   ├── pages/
│   │   ├── Login.tsx            # Registration + login form
│   │   ├── Memories.tsx         # File tree + detail pane
│   │   ├── Agents.tsx           # Connected agents + MCP config
│   │   ├── Sessions.tsx         # Session list
│   │   └── Settings.tsx         # Account + logout
│   ├── components/
│   │   ├── Layout.tsx           # Sidebar + content shell
│   │   ├── FileTree.tsx         # Recursive tree component
│   │   ├── MemoryDetail.tsx     # L0/L1 display + decrypt button
│   │   ├── EmptyState.tsx       # Smart empty states per page
│   │   └── GrantCard.tsx        # Single grant display + revoke
│   └── lib/
│       └── router.tsx           # Route definitions + auth guard
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── postcss.config.js
```

**Key decisions:**
- Browser crypto uses WebCrypto API — same HKDF + AES-GCM spec as MCP server, different implementation
- API client shares the same interface as MCP server's client but uses browser `fetch`
- Auth state held in React context — JWT in memory, wrapped MK in `localStorage`
- No state management library — React context + hooks sufficient for 4 pages

---

## 3. Pages

### Login Page (`/login`)

Single page for both registration and login. Toggle between "Create account" and "Sign in" modes.

- Email + password form
- On register: OPAQUE client runs locally → exchanges messages with server → gets JWT → generates MK → wraps with export_key → stores on server
- On login: OPAQUE client → gets JWT → fetches wrapped MK → unwraps with export_key
- Redirects to `/memories` on success

### Memories Page (`/memories`) — Default view

Split pane file explorer layout:

- **Left: File tree** — Fetched from `GET /v1/memory/browse`. Collapsible folders, click file to select. `📁`/`📄` icons.
- **Right: Detail pane** — Selected memory's L0 summary and L1 overview (always visible, plaintext from server). "Decrypt" button fetches L2 from `GET /v1/memory/content/*`, decrypts with MK in memory, shows full content below.
- **Search bar** at top — Calls `POST /v1/memory/recall`, results replace the tree temporarily.
- **Empty state** — "Your vault is empty. Connect an AI tool to start building your memory." with button linking to Agents page.

### Agents Page (`/agents`)

- **Connected agents list** — Cards showing client name, role badge (tool/assistant/admin), connected date, expiry. Revoke button per card.
- **Connect new agent section** — Code snippet block showing MCP server config JSON with copy-to-clipboard. Tabs for "Claude Code" / "Cursor" / "Other" with placement instructions.
- **Empty state** — "No agents connected yet. Add Context Chest to your AI tool in 30 seconds." with MCP config snippet displayed inline.

MCP config snippet:
```json
{
  "mcpServers": {
    "context-chest": {
      "command": "npx",
      "args": ["@context-chest/mcp-server"]
    }
  }
}
```

### Sessions Page (`/sessions`)

- **Session list** — Table: ID (truncated), status badge (active/closed), message count, memories extracted, created date. Fetched from `GET /v1/sessions` (new endpoint, see API Dependencies).
- Clicking a session shows basic metadata. No message content (encrypted, only accessible via MCP server).
- **Empty state** — "No sessions yet. Sessions are created automatically when connected agents track conversations."

### Settings Page (`/settings`)

- Account info: email (read-only), account created date
- Master key status: "Active" with indicator
- API URL display
- Logout button (clears JWT + MK from memory)

---

## 4. Auth & Crypto in the Browser

### OPAQUE client-side flow

Uses `@cloudflare/opaque-ts` in the browser (JS/WASM).

**Registration:**
1. User enters email + password
2. PWA runs `OpaqueClient.registerInit(password)` → sends `registrationRequest` (base64) to `POST /v1/auth/register`
3. Server returns `registrationResponse`
4. PWA runs `OpaqueClient.registerFinish(registrationResponse)` → gets `record` + `export_key`
5. PWA sends `record` to `POST /v1/auth/register/finish` → gets JWT
6. PWA generates random 256-bit MK, derives wrapping key from `export_key` via HKDF-SHA256 (salt: userId, info: "context-chest-mk-wrap")
7. Wraps MK with AES-GCM using wrapping key
8. Sends wrapped MK to `PUT /v1/auth/master-key`
9. Stores JWT in React state (memory), wrapped MK in `localStorage`

**Login:**
1. PWA runs `OpaqueClient.authInit(password)` → sends `credentialRequest` to `POST /v1/auth/login`
2. Server returns `credentialResponse`
3. PWA runs `OpaqueClient.authFinish(credentialResponse)` → gets `export_key`
4. Sends `credentialFinalization` to `POST /v1/auth/login/finish` → gets JWT
5. Derives wrapping key from export_key, fetches wrapped MK from `GET /v1/auth/master-key`, unwraps
6. JWT in React state, wrapped MK in `localStorage`

### WebCrypto implementation

Same spec as MCP server's `crypto.ts`, using `window.crypto.subtle`:

- `deriveWrappingKey`: `crypto.subtle.importKey` → `crypto.subtle.deriveBits` (HKDF-SHA256)
- `deriveItemKey`: same HKDF with "context-chest-l2" info string
- `wrapMasterKey`: `crypto.subtle.encrypt` (AES-GCM, random 96-bit IV)
- `unwrapMasterKey`: `crypto.subtle.decrypt` (AES-GCM)
- `encryptL2`: `deriveItemKey` → AES-GCM encrypt → `base64(IV || ciphertext || tag)`
- `decryptL2`: `deriveItemKey` → parse IV/tag → AES-GCM decrypt

**Content endpoint format:** `GET /v1/memory/content/*` returns raw encrypted bytes (`application/octet-stream`), NOT base64. The browser should use `response.arrayBuffer()` to get the raw bytes, then slice: first 12 bytes = IV, last 16 bytes = auth tag, middle = ciphertext. Pass these directly to `crypto.subtle.decrypt`. The base64 encoding described above is only used in JSON payloads (e.g., `POST /v1/memory/remember`).

**HKDF salt URI format:** The HKDF salt for per-item key derivation uses the **client-supplied relative URI** encoded as UTF-8 bytes (e.g., `preferences/editor-theme`), NOT the fully resolved `viking://` URI. This must match exactly between the MCP server (`packages/mcp-server/src/crypto.ts`) and the PWA (`packages/pwa/src/crypto/index.ts`) — if they differ, cross-client decryption breaks.

### Session management

- JWT stored in React state (memory only — lost on tab close, intentional security choice)
- Wrapped MK in `localStorage` (encrypted, safe to persist — useless without export_key)
- On page load: check `localStorage` for wrapped MK. If present but no JWT → show login. After login, unwrap MK immediately.
- Logout: clear JWT from state, optionally clear `localStorage`

---

## 5. Smart Empty States

| Page | Message | Action |
|---|---|---|
| Memories | "Your vault is empty. Connect an AI tool to start building your memory." | Button → Agents page |
| Agents | "No agents connected yet. Add Context Chest to your AI tool in 30 seconds." | MCP config snippet inline |
| Sessions | "No sessions yet. Sessions are created automatically when connected agents track conversations." | Link → Agents page |
| Settings | Never empty — always shows account info | — |

The Agents page empty state is the critical activation path — the MCP config snippet should be front and center with copy-to-clipboard and platform-specific tabs.

---

## 6. UI Design

### Layout

File explorer layout (chosen via visual brainstorming):
- Persistent sidebar (220px) with logo, nav items (Memories, Agents, Sessions, Settings), and usage indicator at bottom
- Main content area fills remaining width
- Dark theme matching the vault/security aesthetic
- Memories page has a secondary split: file tree (200px) + detail pane

### Visual language

- Dark backgrounds (#1a1a2e, #16213e)
- Accent color: #e94560 (for active states, badges, CTAs)
- Monospace for URIs and code snippets
- Role badges: tool (gray), assistant (blue), admin (red)
- Status badges: active (green), closed (gray)

---

## 7. Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 |
| Build | Vite |
| Styling | Tailwind CSS |
| Routing | React Router v6 |
| Crypto | WebCrypto API (browser native) |
| OPAQUE | @cloudflare/opaque-ts |
| HTTP | Browser fetch API |
| Deploy | Static files (Vercel/S3/Cloudflare Pages) |

---

## 8. API Dependencies

All endpoints used by the PWA (all exist from Phase 1):

| Endpoint | Used by |
|---|---|
| `POST /v1/auth/register` | Login page (registration) |
| `POST /v1/auth/register/finish` | Login page (registration) |
| `POST /v1/auth/login` | Login page (login) |
| `POST /v1/auth/login/finish` | Login page (login) |
| `PUT /v1/auth/master-key` | Login page (registration) |
| `GET /v1/auth/master-key` | Login page (login) |
| `GET /v1/memory/browse` | Memories page (tree) |
| `POST /v1/memory/recall` | Memories page (search) |
| `GET /v1/memory/content/*` | Memories page (decrypt) |
| `GET /v1/connect/grants` | Agents page |
| `DELETE /v1/connect/grants/:id` | Agents page (revoke) |

### New endpoint required for PWA

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /v1/sessions` | JWT | List user's sessions (paginated) |

**`GET /v1/sessions` spec:**
- Query params: `?status=active|closed&page=1&limit=50`
- Response: `{ success: true, data: [{ id, status, messageCount, memoriesExtracted, clientId, createdAt, closedAt }], meta: { total, page, limit } }`
- Requires adding `memoriesExtracted Int @default(0) @map("memories_extracted")` to the Session model in `prisma/schema.prisma`
- `SessionService.close()` must set `memoriesExtracted` when closing a session
- This endpoint + schema change should be implemented as Task 1 of the PWA implementation plan
