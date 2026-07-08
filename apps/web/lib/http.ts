import { NextResponse } from "next/server";
import { z } from "zod";
import { getI18n } from "@/lib/i18n";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function parseBody<TSchema extends z.ZodTypeAny>(
  request: Request,
  schema: TSchema,
): Promise<z.output<TSchema>> {
  const body = await request.json().catch(() => ({}));
  return schema.parse(body);
}

export function route(handler: () => Promise<Response>) {
  return handler().catch(async (error) => {
    const { dictionary } = await getI18n();
    const messages = dictionary.backend;
    if (error instanceof z.ZodError)
      return fail(messages.invalidRequest, 422, error.flatten());
    if (error instanceof Error && error.message.startsWith("Forbidden"))
      return fail(messages.forbidden, 403);
    if (error instanceof Error && error.message.startsWith("Unauthorized"))
      return fail(messages.unauthorized, 401);
    if (error instanceof Error && error.message.startsWith("Conflict"))
      return fail(stripStatusPrefix(error.message), 409);
    if (error instanceof Error && error.message.startsWith("Bad Request"))
      return fail(stripStatusPrefix(error.message), 400);
    return fail(messages.unexpected, 500);
  });
}

function stripStatusPrefix(message: string) {
  return message.replace(/^[^:]+:\s*/, "");
}
