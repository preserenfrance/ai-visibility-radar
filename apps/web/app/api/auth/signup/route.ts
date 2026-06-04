import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { clearUserSession, setUserSession } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  organizationName: z.string().optional()
});

export async function POST(request: Request) {
  return route(async () => {
    const input = await parseBody(request, schema);
    const user = await prisma.user.upsert({
      where: { email: input.email.toLowerCase() },
      update: { name: input.name },
      create: {
        email: input.email.toLowerCase(),
        name: input.name
      }
    });

    const hasMembership = await prisma.membership.findFirst({ where: { userId: user.id } });
    if (!hasMembership) {
      const organization = await prisma.organization.create({
        data: {
          name: input.organizationName ?? input.name ?? input.email.split("@")[0]!,
          memberships: {
            create: {
              userId: user.id,
              role: "owner"
            }
          }
        }
      });
      await prisma.auditLog.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          action: "login"
        }
      });
    }

    await setUserSession(user.id);
    return ok({ user }, 201);
  });
}

export async function DELETE() {
  await clearUserSession();
  return ok({ ok: true });
}
