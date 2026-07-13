import { createHmac, randomBytes } from "node:crypto";
import { prisma } from "@ai-radar/db";

export const MCP_READ_SCOPES = [
  "brands:read",
  "scans:read",
  "search_traces:read",
] as const;

export type McpScope = (typeof MCP_READ_SCOPES)[number];

export type McpAuthContext = {
  tokenId: string;
  scopes: McpScope[];
  user: {
    id: string;
    email: string;
    name: string | null;
    memberships: Array<{
      organizationId: string;
      role: string;
      organization: {
        id: string;
        name: string;
        plan: string;
      };
    }>;
  };
};

export async function createMcpApiToken(input: {
  userId: string;
  name: string;
  scopes?: McpScope[];
}) {
  const token = `air_mcp_${randomBytes(32).toString("base64url")}`;
  const scopes = input.scopes ?? [...MCP_READ_SCOPES];
  const record = await prisma.mcpApiToken.create({
    data: {
      userId: input.userId,
      name: input.name.trim() || "MCP client",
      tokenHash: hashMcpToken(token),
      tokenPrefix: displayTokenPrefix(token),
      scopes,
    },
  });

  return { token, record };
}

export async function revokeMcpApiToken(input: {
  tokenId: string;
  userId: string;
}) {
  await prisma.mcpApiToken.updateMany({
    where: {
      id: input.tokenId,
      userId: input.userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
}

export async function authenticateMcpBearerToken(
  authorization: string | null,
  requiredScopes: McpScope[] = [],
): Promise<McpAuthContext> {
  const token = bearerToken(authorization);
  if (!token) throw new Error("Unauthorized: MCP bearer token required");

  const record = await prisma.mcpApiToken.findUnique({
    where: { tokenHash: hashMcpToken(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          memberships: {
            select: {
              organizationId: true,
              role: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  plan: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!record || record.revokedAt) {
    throw new Error("Unauthorized: invalid MCP bearer token");
  }
  if (record.expiresAt && record.expiresAt <= new Date()) {
    throw new Error("Unauthorized: expired MCP bearer token");
  }

  const scopes = parseMcpScopes(record.scopes);
  for (const scope of requiredScopes) {
    if (!scopes.includes(scope)) {
      throw new Error(`Forbidden: MCP token missing ${scope}`);
    }
  }

  void prisma.mcpApiToken
    .update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    })
    .catch((error) => {
      console.warn("Could not update MCP token usage", error);
    });

  return {
    tokenId: record.id,
    scopes,
    user: record.user,
  };
}

export function parseMcpScopes(value: unknown): McpScope[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is McpScope =>
    (MCP_READ_SCOPES as readonly string[]).includes(String(item)),
  );
}

function bearerToken(authorization: string | null) {
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice("bearer ".length).trim();
  return token || null;
}

function displayTokenPrefix(token: string) {
  return `${token.slice(0, 14)}...${token.slice(-4)}`;
}

function hashMcpToken(token: string) {
  return createHmac("sha256", mcpTokenSecret()).update(token).digest("hex");
}

function mcpTokenSecret() {
  return (
    process.env.MCP_TOKEN_SECRET ??
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.DATABASE_URL ??
    "ai-radar-dev-secret"
  );
}
