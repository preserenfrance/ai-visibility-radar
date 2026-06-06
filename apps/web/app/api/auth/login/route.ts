import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { authenticateUser } from "@/lib/accounts";
import { setUserSession } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  return route(async () => {
    const input = await parseBody(request, schema);
    const user = await authenticateUser(input.email, input.password);
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
