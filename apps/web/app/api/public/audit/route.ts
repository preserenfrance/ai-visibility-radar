import { z } from "zod";
import { createFreeAudit } from "@/lib/services";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  email: z.string().email(),
  domain: z.string().min(3),
  brandName: z.string().min(1),
  country: z.string().default("Slovenia"),
  language: z.string().default("sl"),
  competitors: z.string().optional(),
  utmSource: z.string().optional(),
  utmCampaign: z.string().optional()
});

export async function POST(request: Request) {
  return route(async () => {
    const input = await parseBody(request, schema);
    const lead = await createFreeAudit(input);
    return ok({ lead }, 201);
  });
}
