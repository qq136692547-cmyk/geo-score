/**
 * GeoScore MCP Server — Model Context Protocol server for GEO audit.
 *
 * Zero-dependency MCP server using stdio JSON-RPC 2.0.
 * Exposes the `audit_url` tool to MCP-compatible AI clients.
 *
 * Usage:
 *   node bin/geoscore-mcp.mjs
 *
 * Or add to MCP client config:
 *   {
 *     "mcpServers": {
 *       "geoscore": {
 *         "command": "node",
 *         "args": ["path/to/bin/geoscore-mcp.mjs"]
 *       }
 *     }
 *   }
 *
 * Protocol: MCP 2024-11-05 (JSON-RPC 2.0 over stdio)
 */

import { auditUrl } from '../src/lib/node-scanner.js';
import { generateFixFiles } from '../src/lib/fixGenerator.js';
import readline from 'readline';

const SERVER_INFO = {
  name: 'geoscore',
  version: '1.2.0',
};

const TOOLS = [
  {
    name: 'audit_url',
    description: 'Audit a website\'s GEO (Generative Engine Optimization) score. Checks AI crawlability (20 AI crawlers), structured data (JSON-LD), meta tags, content quality, E-E-A-T signals, citation readiness, AI discovery endpoints, agent-friendliness, freshness, negative signals, and prompt injection. Returns a score 0-100 with 11 dimension breakdowns and actionable recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to audit (e.g., https://example.com). Protocol optional.',
        },
        format: {
          type: 'string',
          enum: ['json', 'summary', 'full'],
          description: 'Output format: "json" (raw JSON), "summary" (score + dimension percentages), "full" (score + dimensions + negative signals + prompt injection + recommendations). Default: "full".',
          default: 'full',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'generate_fixes',
    description: 'Generate fix files (llms.txt, robots.txt, JSON-LD schema) for a website based on its GEO audit results. Returns the content of each fix file so you can apply them directly.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to generate fixes for.',
        },
      },
      required: ['url'],
    },
  },
];

// --- JSON-RPC 2.0 helpers ---

function makeResponse(id, result) {
  return JSON.stringify({ jsonrpc: '2.0', id, result });
}

function makeError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return JSON.stringify({ jsonrpc: '2.0', id, error });
}

// --- Tool handlers ---

async function handleAuditUrl(args) {
  const { url, format = 'full' } = args;

  if (!url || typeof url !== 'string') {
    throw new Error('url is required and must be a string');
  }

  const result = await auditUrl(url);

  if (format === 'json') {
    return result;
  }

  if (format === 'summary') {
    return {
      url: result.url,
      score: result.score,
      level: result.level,
      summary: result.summary,
      dimensions: Object.fromEntries(
        Object.entries(result.dimensions).map(([k, v]) => [k, {
          percentage: v.percentage,
          score: v.score,
          weight: v.weight,
        }])
      ),
    };
  }

  // full (default)
  return {
    url: result.url,
    timestamp: result.timestamp,
    score: result.score,
    level: result.level,
    summary: result.summary,
    dimensions: result.dimensions,
    negativeSignals: result.negativeSignals,
    promptInjection: result.promptInjection,
    seoSupplement: result.seoSupplement,
    recommendations: result.recommendations,
  };
}

async function handleGenerateFixes(args) {
  const { url } = args;

  if (!url || typeof url !== 'string') {
    throw new Error('url is required and must be a string');
  }

  const result = await auditUrl(url);
  const fixes = generateFixFiles(result);

  const output = {};
  for (const [key, file] of Object.entries(fixes)) {
    output[key] = {
      filename: file.filename,
      content: file.content,
    };
  }

  return {
    url: result.url,
    score: result.score,
    fixes: output,
  };
}

// --- MCP protocol handlers ---

function createToolsList() {
  return {
    tools: TOOLS.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  };
}

function createToolResult(content) {
  return {
    content: [
      {
        type: 'text',
        text: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
      },
    ],
  };
}

// --- Main loop ---

let initialized = false;
let pendingCalls = 0;

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

rl.on('line', (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch (e) {
    // Not valid JSON, ignore
    return;
  }

  const { jsonrpc, id, method, params } = msg;

  // Notifications (no id) — handle silently
  if (id === undefined || id === null) {
    if (method === 'notifications/initialized') {
      initialized = true;
    }
    return;
  }

  // Requests (have id)
  switch (method) {
    case 'initialize': {
      process.stdout.write(makeResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        serverInfo: SERVER_INFO,
      }) + '\n');
      break;
    }

    case 'tools/list': {
      process.stdout.write(makeResponse(id, createToolsList()) + '\n');
      break;
    }

    case 'tools/call': {
      const { name, arguments: args } = params || {};

      (async () => {
        pendingCalls++;
        try {
          let result;
          switch (name) {
            case 'audit_url':
              result = await handleAuditUrl(args);
              break;
            case 'generate_fixes':
              result = await handleGenerateFixes(args);
              break;
            default:
              process.stdout.write(makeError(id, -32601, 'Unknown tool: ' + name) + '\n');
              return;
          }
          process.stdout.write(makeResponse(id, createToolResult(result)) + '\n');
        } catch (err) {
          process.stdout.write(makeResponse(id, createToolResult({
            error: err.message || String(err),
          })) + '\n');
        } finally {
          pendingCalls--;
        }
      })();
      break;
    }

    case 'ping': {
      process.stdout.write(makeResponse(id, {}) + '\n');
      break;
    }

    default: {
      process.stdout.write(makeError(id, -32601, 'Method not found: ' + method) + '\n');
    }
  }
});

rl.on('close', () => {
  // Wait for pending async calls to finish before exiting
  if (pendingCalls === 0) {
    process.exit(0);
  }
  // Give async calls up to 30s to complete
  const timeout = setTimeout(() => process.exit(0), 30000);
  const checkInterval = setInterval(() => {
    if (pendingCalls === 0) {
      clearInterval(checkInterval);
      clearTimeout(timeout);
      process.exit(0);
    }
  }, 100);
});

// Signal ready
process.stderr.write('[geoscore-mcp] Server ready (stdio, MCP 2024-11-05)\n');
