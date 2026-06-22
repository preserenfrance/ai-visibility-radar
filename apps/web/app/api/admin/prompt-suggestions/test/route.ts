import { z } from "zod";
import { requireAdminUser } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";
import { suggestAuditPrompts } from "@/lib/prompt-suggestions";

export const maxDuration = 60;

const schema = z.object({
  domain: z.string().min(3),
  brandName: z.string().min(1),
  country: z.string().default("Slovenija"),
  language: z.string().default("sl"),
  competitors: z.string().optional(),
});

export async function POST(request: Request) {
  return route(async () => {
    await requireAdminUser();
    const input = await parseBody(request, schema);
    const prompts = await suggestAuditPrompts(input);
    return ok({ prompts });
  });
}
