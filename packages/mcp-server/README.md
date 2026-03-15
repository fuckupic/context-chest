# context-chest-mcp

MCP server that gives AI agents encrypted, persistent memory.

## Setup

Add to your Claude Code or Cursor MCP config:

```json
{
  "mcpServers": {
    "context-chest": {
      "command": "npx",
      "args": ["context-chest-mcp"]
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `context-chest_remember` | Store encrypted memory |
| `context-chest_recall` | Search memories |
| `context-chest_read` | Read decrypted content |
| `context-chest_forget` | Delete a memory |
| `context-chest_browse` | Browse memory tree |
| `context-chest_session-start` | Start tracking a conversation |
| `context-chest_session-append` | Add message to session |
| `context-chest_session-save` | Extract memories and close session |

## How it works

Content is encrypted client-side with AES-256-GCM before leaving your machine. The server stores only ciphertext. Keys are derived via HKDF from your credentials.

## More info

See [Context Chest](https://github.com/fuckupic/context-chest) for full documentation.
