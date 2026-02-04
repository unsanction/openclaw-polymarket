import { createConfig } from "@c0pilot/mcp-polymarket/config";
import { ClobClientWrapper } from "@c0pilot/mcp-polymarket/client";
import { createPolymarketTools } from "./tools.js";

/**
 * OpenClaw Polymarket Plugin
 */

// OpenClaw plugin context type
interface PluginContext {
  id: string;
  name: string;
  version?: string;
  pluginConfig?: Record<string, unknown>;
  registerTool: (tool: {
    name: string;
    description: string;
    parameters: object;
    execute: (...args: unknown[]) => Promise<unknown>;
  }) => void;
  log?: (level: string, message: string) => void;
}

function log(ctx: PluginContext, level: string, message: string) {
  if (ctx.log) {
    ctx.log(level, message);
  } else {
    console.log(`[polymarket] [${level}] ${message}`);
  }
}

// Helper to extract params from OpenClaw execute args
// OpenClaw passes: (toolCallId, params, context, callback)
function extractParams(...args: unknown[]): Record<string, unknown> {
  // If first arg is string (toolCallId), params are in second arg
  if (typeof args[0] === "string" && args.length > 1) {
    return (args[1] as Record<string, unknown>) || {};
  }
  // If first arg is object, it's the params
  if (typeof args[0] === "object" && args[0] !== null) {
    return args[0] as Record<string, unknown>;
  }
  return {};
}

// Convert TypeBox schema to plain JSON Schema (strip Symbol keys)
function toJsonSchema(typeboxSchema: object): object {
  return JSON.parse(JSON.stringify(typeboxSchema));
}

export async function activate(ctx: PluginContext): Promise<void> {
  const pluginConfig = ctx.pluginConfig || {};

  const privateKey = (pluginConfig.privateKey as string) || process.env.POLYMARKET_PRIVATE_KEY;

  if (!privateKey) {
    log(ctx, "error", "privateKey is required (via plugin config or POLYMARKET_PRIVATE_KEY env var)");
    return;
  }

  try {
    const config = createConfig({
      privateKey,
      funder: (pluginConfig.funder as string) || process.env.POLYMARKET_FUNDER,
      apiKey: (pluginConfig.apiKey as string) || process.env.POLYMARKET_API_KEY,
      apiSecret: (pluginConfig.apiSecret as string) || process.env.POLYMARKET_API_SECRET,
      passphrase: (pluginConfig.passphrase as string) || process.env.POLYMARKET_PASSPHRASE,
      chainId: (pluginConfig.chainId as number) || parseInt(process.env.POLYMARKET_CHAIN_ID || "137", 10),
      readonly: (pluginConfig.readonly as boolean) || process.env.POLYMARKET_READONLY?.toLowerCase() === "true",
    });

    const client = new ClobClientWrapper(config);
    const tools = createPolymarketTools(client);

    let registeredCount = 0;
    for (const tool of tools) {
      // Skip write tools if in readonly mode
      if (config.readonly && (tool.name === "polymarket_place_order" || tool.name === "polymarket_cancel_order")) {
        continue;
      }

      // Register with OpenClaw format
      ctx.registerTool({
        name: tool.name,
        description: tool.description,
        parameters: toJsonSchema(tool.parameters),
        execute: async (...args: unknown[]) => {
          const params = extractParams(...args);
          const toolCallId = typeof args[0] === "string" ? args[0] : "unknown";
          return tool.execute(toolCallId, params);
        },
      });

      registeredCount++;
    }
  } catch (error) {
    log(ctx, "error", `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function deactivate(): Promise<void> {
  // Cleanup if needed
}

// Also export for direct use
export { createConfig } from "@c0pilot/mcp-polymarket/config";
export { ClobClientWrapper } from "@c0pilot/mcp-polymarket/client";
export { createPolymarketTools } from "./tools.js";
