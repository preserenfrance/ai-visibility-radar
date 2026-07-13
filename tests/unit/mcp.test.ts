import { describe, expect, it } from "vitest";
import { MCP_TOOL_DEFINITIONS } from "@/lib/mcp-tools";
import { parseMcpScopes } from "@/lib/mcp-tokens";

describe("MCP token scopes", () => {
  it("keeps only supported read scopes", () => {
    expect(
      parseMcpScopes([
        "brands:read",
        "scans:read",
        "search_traces:read",
        "scans:write",
        42,
      ]),
    ).toEqual(["brands:read", "scans:read", "search_traces:read"]);
  });
});

describe("MCP tool definitions", () => {
  it("exposes read-only tools with JSON schemas and scopes", () => {
    expect(MCP_TOOL_DEFINITIONS.map((tool) => tool.name)).toEqual([
      "get_account_context",
      "list_brands",
      "get_brand_overview",
      "get_latest_scan",
      "get_prompt_results",
      "get_search_traces",
    ]);
    expect(
      MCP_TOOL_DEFINITIONS.every(
        (tool) =>
          tool.inputSchema.type === "object" && tool.requiredScopes.length > 0,
      ),
    ).toBe(true);
  });
});
