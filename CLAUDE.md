# Context Chest

## CRITICAL: Memory Protocol

Before responding to ANY user message, you MUST:
1. Check if you have vault context loaded in this conversation
2. If not (or if context was recently compacted), call `context-chest_browse` first
3. Then call `context-chest_recall` with keywords relevant to the user's current request

This is non-negotiable. Never start working without checking the vault first.

Before ending ANY session or when the conversation is getting long:
- Store key decisions with `context-chest_remember` using descriptive paths
- Example: `decisions/chose-stripe-over-paddle`, `bugs/browse-empty-fix`, `architecture/encryption-model`

## Project

This is Context Chest — an encrypted memory vault for AI agents.
Check the vault for architecture details, past decisions, and conventions.
