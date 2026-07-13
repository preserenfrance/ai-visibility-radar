import { NextResponse } from "next/server";
import {
  MCP_TOOL_DEFINITIONS,
  callMcpTool,
  mcpToolByName,
} from "@/lib/mcp-tools";
import { authenticateMcpBearerToken, type McpScope } from "@/lib/mcp-tokens";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_PROTOCOL_VERSION = "2025-06-18";

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

export async function GET() {
  return NextResponse.json(
    {
      name: "AI Radar MCP",
      endpoint: "/mcp",
      authentication: "Bearer personal MCP token",
      tools: MCP_TOOL_DEFINITIONS.map((tool) => tool.name),
    },
    { headers: corsHeaders() },
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonRpcResponse(jsonRpcError(null, -32700, "Parse error"));
  }

  const responses = Array.isArray(payload)
    ? await Promise.all(
        payload.map((item) => handleJsonRpcRequest(item, request)),
      )
    : [await handleJsonRpcRequest(payload, request)];
  const filtered = responses.filter((response) => response !== null);

  if (Array.isArray(payload)) {
    return filtered.length
      ? jsonRpcResponse(filtered)
      : new Response(null, { status: 204, headers: corsHeaders() });
  }

  return filtered[0]
    ? jsonRpcResponse(filtered[0])
    : new Response(null, { status: 204, headers: corsHeaders() });
}

async function handleJsonRpcRequest(value: unknown, request: Request) {
  if (!value || typeof value !== "object") {
    return jsonRpcError(null, -32600, "Invalid Request");
  }
  const message = value as JsonRpcRequest;
  const id = "id" in message ? (message.id ?? null) : null;
  if (message.jsonrpc && message.jsonrpc !== "2.0") {
    return jsonRpcError(id, -32600, "Invalid JSON-RPC version");
  }
  if (!message.method) {
    return jsonRpcError(id, -32600, "Method is required");
  }
  if (!("id" in message) && message.method.startsWith("notifications/")) {
    return null;
  }

  try {
    const result = await handleMcpMethod(
      message.method,
      message.params,
      request,
    );
    return jsonRpcResult(id, result);
  } catch (error) {
    return jsonRpcErrorForException(id, error);
  }
}

async function handleMcpMethod(
  method: string,
  params: unknown,
  request: Request,
) {
  switch (method) {
    case "initialize":
      return initializeResult(params);
    case "ping":
      return {};
    case "tools/list":
      await authenticateMcpBearerToken(request.headers.get("authorization"), [
        "brands:read",
      ]);
      return {
        tools: MCP_TOOL_DEFINITIONS.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    case "tools/call":
      return callTool(params, request);
    case "resources/list":
      return { resources: [] };
    case "prompts/list":
      return { prompts: [] };
    default:
      throw new McpMethodNotFoundError(method);
  }
}

async function callTool(params: unknown, request: Request) {
  if (!params || typeof params !== "object") {
    throw new Error("Bad Request: tools/call params are required");
  }
  const toolName = (params as { name?: unknown }).name;
  if (typeof toolName !== "string") {
    throw new Error("Bad Request: tools/call name is required");
  }
  const tool = mcpToolByName(toolName);
  if (!tool) throw new Error(`Bad Request: unknown MCP tool ${toolName}`);

  const context = await authenticateMcpBearerToken(
    request.headers.get("authorization"),
    tool.requiredScopes,
  );
  const args =
    (params as { arguments?: unknown; args?: unknown }).arguments ??
    (params as { args?: unknown }).args ??
    {};
  const data = await callMcpTool(toolName, args, context);

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
    structuredContent: data,
  };
}

function initializeResult(params: unknown) {
  const requestedVersion =
    params && typeof params === "object"
      ? (params as { protocolVersion?: unknown }).protocolVersion
      : undefined;
  return {
    protocolVersion:
      typeof requestedVersion === "string"
        ? requestedVersion
        : DEFAULT_PROTOCOL_VERSION,
    capabilities: {
      tools: {
        listChanged: false,
      },
      resources: {},
      prompts: {},
    },
    serverInfo: {
      name: "AI Radar",
      version: "0.1.0",
    },
    instructions:
      "Use AI Radar tools to answer questions about the authenticated user's brands, AI visibility scans, prompt results, citations, mentions, and captured AI search traces.",
  };
}

function jsonRpcResponse(body: unknown) {
  return NextResponse.json(body, { headers: corsHeaders() });
}

function jsonRpcResult(id: JsonRpcId, result: unknown) {
  return {
    jsonrpc: "2.0",
    id,
    result,
  };
}

function jsonRpcError(id: JsonRpcId, code: number, message: string) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  };
}

function jsonRpcErrorForException(id: JsonRpcId, error: unknown) {
  if (error instanceof McpMethodNotFoundError) {
    return jsonRpcError(id, -32601, error.message);
  }
  if (error instanceof Error && error.message.startsWith("Unauthorized")) {
    return jsonRpcError(id, -32001, stripStatusPrefix(error.message));
  }
  if (error instanceof Error && error.message.startsWith("Forbidden")) {
    return jsonRpcError(id, -32003, stripStatusPrefix(error.message));
  }
  if (error instanceof Error && error.message.startsWith("Bad Request")) {
    return jsonRpcError(id, -32602, stripStatusPrefix(error.message));
  }
  return jsonRpcError(id, -32603, "Internal error");
}

function stripStatusPrefix(message: string) {
  return message.replace(/^[^:]+:\s*/, "");
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization,content-type,mcp-protocol-version",
  };
}

class McpMethodNotFoundError extends Error {
  constructor(method: string) {
    super(`Method not found: ${method}`);
  }
}
