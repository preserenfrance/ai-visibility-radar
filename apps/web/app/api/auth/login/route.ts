import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { setUserSession } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  email: z.string().email()
});

export async function POST(request: Request) {
  return route(async () => {
    const input = await parseBody(request, schema);
    const user = await prisma.user.upsert({
      where: { email: input.email.toLowerCase() },
      update: {},
      create: { email: input.email.toLowerCase() }
    });
    await setUserSession(user.id);
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "login"
      }
    });
    return ok({ user });
  });
}
