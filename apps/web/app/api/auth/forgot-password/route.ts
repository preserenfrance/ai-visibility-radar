import { z } from "zod";
import { requestPasswordReset } from "@/lib/accounts";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  email: z.string().email()
});

export async function POST(request: Request) {
  return route(async () => {
    const input = await parseBody(request, schema);
    const result = await requestPasswordReset(input.email);
    return ok({ sent: true, emailSkipped: result.skipped });
  });
}
