# Context Chest for OpenClaw

Give your OpenClaw agent encrypted, persistent memory that works across all your AI tools.

## Setup

1. **Create an account** at [pwa-one-gold.vercel.app](https://pwa-one-gold.vercel.app)

2. **Get your token**:
```bash
npx context-chest-mcp login
```

3. **Add to OpenClaw config** (`~/.openclaw/config.yaml`):
```yaml
plugins:
  context-chest:
    apiToken: "your-jwt-token-here"
```

## Tools

| Tool | Description |
|------|-------------|
| `context_chest_remember` | Store a memory with a path |
| `context_chest_recall` | Search memories by keyword |
| `context_chest_browse` | Browse memory tree |
| `context_chest_forget` | Delete a memory |

## Cross-Agent Memory

Memories stored by OpenClaw are accessible from Claude Code, Cursor, or any other connected agent — and vice versa. One vault, every agent.

## More Info

- [Context Chest](https://github.com/fuckupic/context-chest)
- [OpenClaw](https://openclaw.ai)
