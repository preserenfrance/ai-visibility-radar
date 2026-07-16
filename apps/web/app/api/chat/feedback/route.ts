import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { getCurrentUser } from "@/lib/auth";
import { ok, parseBody, route } from "@/lib/http";

const schema = z.object({
  sessionId: z.string().trim().min(1),
  messageId: z.string().trim().optional(),
  anonymousId: z.string().trim().max(128).optional(),
  rating: z
    .number()
    .int()
    .min(-1)
    .max(1)
    .refine((value) => value !== 0),
  comment: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request) {
  return route(async () => {
    const user = await getCurrentUser();
    const input = await parseBody(request, schema);
    const anonymousId = input.anonymousId || null;
    if (!user && !anonymousId) {
      throw new Error("Bad Request: anonymous session key required");
    }
    const publicAnonymousId = anonymousId ?? "";

    const session = user
      ? await prisma.aiChatSession.findFirst({
          where: {
            id: input.sessionId,
            OR: [
              { userId: user.id },
              ...(anonymousId
                ? [
                    {
                      userId: null,
                      metadata: {
                        path: ["anonymousId"],
                        equals: anonymousId,
                      },
                    },
                  ]
                : []),
            ],
          },
          select: { id: true },
        })
      : await prisma.aiChatSession.findFirst({
          where: {
            id: input.sessionId,
            userId: null,
            metadata: { path: ["anonymousId"], equals: publicAnonymousId },
          },
          select: { id: true },
        });

    if (!session) throw new Error("Forbidden: chat session access required");

    if (input.messageId) {
      const message = await prisma.aiChatMessage.findFirst({
        where: { id: input.messageId, sessionId: session.id },
        select: { id: true },
      });
      if (!message) throw new Error("Forbidden: chat message access required");
    }

    const feedback = await prisma.aiChatFeedback.create({
      data: {
        sessionId: session.id,
        messageId: input.messageId,
        userId: user?.id ?? null,
        rating: input.rating,
        comment: input.comment || null,
      },
    });

    return ok({ feedback: { id: feedback.id, rating: feedback.rating } }, 201);
  });
}
