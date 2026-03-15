// OpenClaw plugin API types (minimal subset)
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (id: string, params: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;
}

export interface PluginAPI {
  registerTool(tool: ToolDefinition, options?: { optional?: boolean }): void;
}
