import { z } from "zod";
import { resetPasswordWithToken } from "@/lib/accounts";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  token: z.string().min(20),
  password: z.string().min(8)
});

export async function POST(request: Request) {
  return route(async () => {
    const input = await parseBody(request, schema);
    await resetPasswordWithToken(input.token, input.password);
    return ok({ ok: true });
  });
}
