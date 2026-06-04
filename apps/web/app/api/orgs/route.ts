import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { requireCurrentUser } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  name: z.string().min(2)
});

export async function GET() {
  return route(async () => {
    const user = await requireCurrentUser();
    const organizations = await prisma.organization.findMany({
      where: { memberships: { some: { userId: user.id } } },
      include: { memberships: true, brands: true }
    });
    return ok({ organizations });
  });
}

export async function POST(request: Request) {
  return route(async () => {
    const user = await requireCurrentUser();
    const input = await parseBody(request, schema);
    const organization = await prisma.organization.create({
      data: {
        name: input.name,
        memberships: {
          create: {
            userId: user.id,
            role: "owner"
          }
        }
      }
    });
    return ok({ organization }, 201);
  });
}
