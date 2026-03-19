# OpenViking on Railway — Reliable Semantic Search

**Date:** 2026-03-19
**Status:** Approved

## Summary

Deploy OpenViking as a new Railway service in the existing project. Fix silent write failures with retry + logging. Add background sync to backfill missing records. Result: recall actually works.

## Current Problems

1. `OPENVIKING_URL=http://disabled` on production — 100% of recall goes through keyword `contains` fallback
2. `context.write()` has `.catch(() => {})` — write failures are silently swallowed
3. l0/l1 were keyword soup (fixed in v0.2.4 with agent-provided summaries)

## Architecture

```
┌─────────────┐     internal network      ┌──────────────┐
│  API Server  │ ──────────────────────── │  OpenViking   │
│  (Railway)   │   http://openviking:1933 │  (Railway)    │
│              │                           │  Port 1933    │
│  Postgres ◄──┼─── primary storage        │  Jina embed   │
│              │                           │  Volume /data │
└─────────────┘                           └──────────────┘
```

### OpenViking Service

- **Source:** GitHub `volcengine/OpenViking` → Dockerfile
- **Port:** 1933
- **Volume:** Railway Volume mounted at `/data` for workspace
- **Embedding:** Jina (`jina-embeddings-v3`, 1024 dimensions, free tier)
- **Config:** `ov.conf` passed via env var or mounted config
- **Healthcheck:** `GET /health` (built into Dockerfile)

### Environment Variables (OpenViking service)

```
OPENVIKING_CONFIG_FILE=/data/ov.conf
```

Config file content (generated at startup):
```json
{
  "storage": { "workspace": "/data/workspace" },
  "embedding": {
    "dense": {
      "api_base": "https://api.jina.ai/v1",
      "api_key": "<JINA_API_KEY>",
      "provider": "jina",
      "model": "jina-embeddings-v3",
      "dimension": 1024
    }
  }
}
```

### API Service Changes

**Environment variables:**
- `OPENVIKING_URL` → change from `http://disabled` to `http://openviking.railway.internal:1933` (Railway private networking)

**Fix silent write failures in `src/services/context.ts`:**

Replace `.catch(() => {})` pattern with retry + log:

```typescript
async writeWithRetry(userId, uri, payload, chestName): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await this.write(userId, uri, payload, chestName);
      return;
    } catch (err) {
      if (attempt === 0) continue; // retry once
      console.error(`[context] OpenViking write failed after retry: ${uri}`, err);
    }
  }
}
```

Update callers in `memory.ts`:
- `remember()` line 54: `.catch(() => {})` → `await this.context.writeWithRetry(...).catch((err) => fastify.log.warn(err, 'OV write failed'))`
- `updateContent()` line 284: same pattern
- `forget()` line 169: `.catch(() => {})` is ok here (delete best-effort)

**Background sync (`src/services/ov-sync.ts`):**

On server startup, run a one-time sync:
1. Fetch all memories from Postgres (with l0/l1)
2. For each, check if OpenViking has the record (`context.read()`)
3. If missing, write it (`context.write()`)
4. Log progress: `[ov-sync] Synced 42/150 memories`
5. Run async — don't block server startup

Triggered on boot, debounced to not hammer OpenViking. Process max 10 concurrent writes.

## Deployment Steps

1. Add OpenViking service to Railway project (from GitHub repo `volcengine/OpenViking`)
2. Attach Railway Volume at `/data`
3. Set env vars on OpenViking service
4. Create startup script that generates `ov.conf` from env vars
5. Update API service `OPENVIKING_URL` to internal URL
6. Deploy both services
7. Run background sync to backfill existing memories

## Scope

| Component | Effort |
|-----------|--------|
| Railway OpenViking service setup | Manual (dashboard) |
| Startup config script | ~30 LoC |
| Fix context.ts write retry | ~20 LoC |
| Update memory.ts callers | ~10 LoC |
| Background sync service | ~60 LoC |
| Integration in index.ts | ~10 LoC |
| **Total code** | **~130 LoC** |
