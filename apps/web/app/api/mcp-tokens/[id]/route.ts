import { requireCurrentUser } from "@/lib/auth";
import { ok, route } from "@/lib/http";
import { revokeMcpApiToken } from "@/lib/mcp-tokens";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return route(async () => {
    const user = await requireCurrentUser();
    const { id } = await params;
    await revokeMcpApiToken({ tokenId: id, userId: user.id });
    return ok({ revoked: true });
  });
}
