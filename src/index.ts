#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);

const SERVER_NAME = "auggie-mcp";
const SERVER_VERSION = "0.1.0";

// Default timeouts in seconds
const DEFAULT_QUERY_TIMEOUT = 240;

interface QueryCodebaseArgs {
  query: string;
  workspace_root?: string;
  model?: string;
  rules_path?: string;
  timeout_sec?: number;
  output_format?: "text" | "json";
}

interface QueryResult {
  answer: string;
  usage: {
    duration_ms: number;
  };
}

/**
 * Preflight check to ensure Auggie CLI is available
 */
async function checkAuggieCLI(): Promise<void> {
  try {
    const { stdout } = await execAsync("auggie --version");
    if (!stdout.trim()) {
      throw new Error("Auggie CLI returned empty version");
    }
  } catch (error) {
    throw new Error(
      `Auggie CLI not found. Please install it first: https://docs.augmentcode.com/cli/overview\n` +
      `Error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Check if AUGMENT_SESSION_AUTH is set
 */
function checkAuthToken(): void {
  if (!process.env.AUGMENT_SESSION_AUTH) {
    throw new Error(
      "AUGMENT_SESSION_AUTH environment variable is required.\n" +
      "Get your token by running: auggie token print"
    );
  }
}

/**
 * Run Auggie CLI command and stream output
 */
async function runAuggieQuery(args: QueryCodebaseArgs): Promise<QueryResult> {
  const startTime = Date.now();
  
  // Build command arguments
  const cmdArgs: string[] = [];
  
  // Use --print for non-interactive mode
  cmdArgs.push("--print");
  
  // Add quiet mode to only get final output
  cmdArgs.push("--quiet");
  
  // Add workspace root if provided
  if (args.workspace_root) {
    cmdArgs.push("--workspace-root", args.workspace_root);
  }
  
  // Add model if provided
  if (args.model) {
    cmdArgs.push("--model", args.model);
  }
  
  // Add rules path if provided
  if (args.rules_path) {
    cmdArgs.push("--rules", args.rules_path);
  }
  
  // Add output format if JSON requested
  if (args.output_format === "json") {
    cmdArgs.push("--output-format", "json");
  }
  
  // Add the query as the instruction
  cmdArgs.push(args.query);
  
  return new Promise((resolve, reject) => {
    const timeout = (args.timeout_sec || DEFAULT_QUERY_TIMEOUT) * 1000;
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    
    const child = spawn("auggie", cmdArgs, {
      env: process.env,
      cwd: args.workspace_root || process.cwd(),
    });
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      reject(new Error(`Query timed out after ${args.timeout_sec || DEFAULT_QUERY_TIMEOUT} seconds`));
    }, timeout);
    
    // Collect stdout
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    
    // Collect stderr
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    
    // Handle process exit
    child.on("close", (code) => {
      clearTimeout(timeoutId);
      
      if (timedOut) {
        return; // Already rejected
      }
      
      if (code !== 0) {
        reject(new Error(
          `Auggie CLI failed with exit code ${code}\n` +
          `STDERR: ${stderr.trim() || "<empty>"}\n` +
          `STDOUT: ${stdout.trim() || "<empty>"}`
        ));
        return;
      }
      
      const duration = Date.now() - startTime;
      
      resolve({
        answer: stdout.trim(),
        usage: {
          duration_ms: duration,
        },
      });
    });
    
    // Handle errors
    child.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(new Error(`Failed to spawn Auggie CLI: ${error.message}`));
    });
  });
}

/**
 * Create and configure the MCP server
 */
function createServer(): Server {
  const server = new Server(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Define available tools
  const tools: Tool[] = [
    {
      name: "query_codebase",
      description: 
        "Query a codebase using Augment's context engine via Auggie CLI. " +
        "This tool provides intelligent answers about code structure, functionality, " +
        "and implementation details by leveraging Augment's advanced context retrieval.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The question or query about the codebase",
          },
          workspace_root: {
            type: "string",
            description: "Absolute path to the workspace/repository root. Defaults to current directory.",
          },
          model: {
            type: "string",
            description: "Model ID to use (optional). Example: 'claude-3-5-sonnet-20241022'",
          },
          rules_path: {
            type: "string",
            description: "Path to additional rules file (optional)",
          },
          timeout_sec: {
            type: "number",
            description: `Query timeout in seconds. Default: ${DEFAULT_QUERY_TIMEOUT}`,
            default: DEFAULT_QUERY_TIMEOUT,
          },
          output_format: {
            type: "string",
            enum: ["text", "json"],
            description: "Output format. Default: text",
            default: "text",
          },
        },
        required: ["query"],
      },
    },
  ];

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "query_codebase") {
      try {
        // Validate and cast arguments
        if (!args || typeof args !== "object") {
          throw new Error("Invalid arguments");
        }

        const queryArgs = args as unknown as QueryCodebaseArgs;

        if (!queryArgs.query || typeof queryArgs.query !== "string") {
          throw new Error("'query' argument is required and must be a string");
        }

        // Run the query
        const result = await runAuggieQuery(queryArgs);

        return {
          content: [
            {
              type: "text",
              text: result.answer,
            },
          ],
          isError: false,
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }

    throw new Error(`Unknown tool: ${name}`);
  });

  return server;
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Perform preflight checks
    console.error("[auggie-mcp] Checking Auggie CLI availability...");
    await checkAuggieCLI();
    
    console.error("[auggie-mcp] Checking authentication...");
    checkAuthToken();
    
    console.error("[auggie-mcp] Starting MCP server...");
    
    // Create and start server
    const server = createServer();
    const transport = new StdioServerTransport();
    
    await server.connect(transport);
    
    console.error("[auggie-mcp] Server started successfully");
  } catch (error) {
    console.error(
      `[auggie-mcp] Failed to start server: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    process.exit(1);
  }
}

main();

