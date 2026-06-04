import { NextResponse } from "next/server";
import { z } from "zod";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

export async function parseBody<T>(request: Request, schema: z.Schema<T>): Promise<T> {
  const body = await request.json().catch(() => ({}));
  return schema.parse(body);
}

export function route(handler: () => Promise<Response>) {
  return handler().catch((error) => {
    if (error instanceof z.ZodError) return fail("Invalid request body", 422, error.flatten());
    if (error instanceof Error && error.message.startsWith("Forbidden")) return fail(error.message, 403);
    if (error instanceof Error && error.message.startsWith("Unauthorized")) return fail(error.message, 401);
    return fail(error instanceof Error ? error.message : "Unexpected server error", 500);
  });
}
