# GeoScore MCP Server

GeoScore ships with a zero-dependency MCP (Model Context Protocol) server for AI agent integration.

## Installation

### Option 1: npx (recommended)

```json
{
  "mcpServers": {
    "geoscore": {
      "command": "npx",
      "args": ["geoscore-mcp"]
    }
  }
}
```

### Option 2: Direct node

```json
{
  "mcpServers": {
    "geoscore": {
      "command": "node",
      "args": ["/path/to/geo-score/bin/geoscore-mcp.mjs"]
    }
  }
}
```

## Tools

### `audit_url`

Audit a website's GEO score (0-100) across 11 dimensions.

**Parameters:**
- `url` (required): The URL to audit
- `format` (optional): `"json"` | `"summary"` | `"full"` (default: `"full"`)

**Returns:**
- Score, level (Excellent/Good/Basic/Critical)
- 11 dimension breakdowns with percentages and weighted scores
- Negative signals (8 checks)
- Prompt injection flags (6 checks)
- Actionable recommendations

### `generate_fixes`

Generate fix files (llms.txt, robots.txt, JSON-LD schema) based on audit results.

**Parameters:**
- `url` (required): The URL to generate fixes for

**Returns:**
- Audit score
- Fix file contents (ready to deploy)

## Protocol

- MCP 2024-11-05
- Transport: stdio (JSON-RPC 2.0)
- Zero external dependencies

## CLI

GeoScore also includes a CLI tool:

```bash
npx geoscore https://example.com           # Human-readable report
npx geoscore https://example.com --json    # JSON output
npx geoscore https://example.com --html    # HTML report
npx geoscore https://example.com --fix     # Generate fix files
npx geoscore https://example.com --quiet   # Score only (for scripting)
```
