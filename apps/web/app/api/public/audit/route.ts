import { z } from "zod";
import { createFreeAudit } from "@/lib/services";
import { ok, parseBody, route } from "@/lib/http";

export const maxDuration = 60;

const schema = z.object({
  email: z.string().email(),
  domain: z.string().min(3),
  brandName: z.string().min(1),
  country: z.string().default("Slovenia"),
  language: z.string().default("sl"),
  locale: z.string().default("sl"),
  prompts: z.array(z.string().min(3)).min(3).max(5),
  providers: z
    .array(z.enum(["openai", "google", "anthropic"]))
    .default(["openai"]),
  competitors: z.string().optional(),
  utmSource: z.string().optional(),
  utmCampaign: z.string().optional(),
});

export async function POST(request: Request) {
  return route(async () => {
    const input = await parseBody(request, schema);
    const lead = await createFreeAudit({ ...input, providers: ["openai"] });
    return ok({ lead }, 201);
  });
}
