import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { createUserAccount } from "@/lib/accounts";
import { clearUserSession, setUserSession } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
  organizationName: z.string().optional()
});

export async function POST(request: Request) {
  return route(async () => {
    const input = await parseBody(request, schema);
    const user = await createUserAccount(input);
    await setUserSession(user.id);
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "login"
      }
    });
    return ok({ user }, 201);
  });
}

export async function DELETE() {
  await clearUserSession();
  return ok({ ok: true });
}
