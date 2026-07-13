import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { requireCurrentUser } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";
import { createMcpApiToken, parseMcpScopes } from "@/lib/mcp-tokens";

export const dynamic = "force-dynamic";

const createTokenSchema = z.object({
  name: z.string().trim().min(1).max(80).default("MCP client"),
});

export async function GET() {
  return route(async () => {
    const user = await requireCurrentUser();
    const tokens = await prisma.mcpApiToken.findMany({
      where: {
        userId: user.id,
      },
      orderBy: { createdAt: "desc" },
    });
    return ok({
      tokens: tokens.map((token) => ({
        id: token.id,
        name: token.name,
        tokenPrefix: token.tokenPrefix,
        scopes: parseMcpScopes(token.scopes),
        createdAt: token.createdAt,
        lastUsedAt: token.lastUsedAt,
        revokedAt: token.revokedAt,
      })),
    });
  });
}

export async function POST(request: Request) {
  return route(async () => {
    const user = await requireCurrentUser();
    const input = await parseBody(request, createTokenSchema);
    const { token, record } = await createMcpApiToken({
      userId: user.id,
      name: input.name,
    });

    return ok(
      {
        token,
        record: {
          id: record.id,
          name: record.name,
          tokenPrefix: record.tokenPrefix,
          scopes: parseMcpScopes(record.scopes),
          createdAt: record.createdAt,
          lastUsedAt: record.lastUsedAt,
          revokedAt: record.revokedAt,
        },
      },
      201,
    );
  });
}
