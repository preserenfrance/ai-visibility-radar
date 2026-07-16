import { z } from "zod";
import { prisma } from "@ai-radar/db";
import { getCurrentUser, requireBrandAccess } from "@/lib/auth";
import {
  buildAccountChatContext,
  buildPublicSupportChatContext,
  chatSessionSummary,
  chatSessionTitle,
  classifyChatIntent,
  previousChatMessagesForPrompt,
  runAccountChatCompletion,
} from "@/lib/account-chat";
import { ok, parseBody, route } from "@/lib/http";

export const maxDuration = 60;

const schema = z.object({
  message: z.string().trim().min(1).max(4000),
  sessionId: z.string().trim().optional(),
  brandId: z.string().trim().optional(),
  anonymousId: z.string().trim().max(128).optional(),
  locale: z.string().trim().max(12).default("sl"),
});

export async function POST(request: Request) {
  let activeSessionId: string | null = null;

  return route(async () => {
    try {
      const user = await getCurrentUser();
      const input = await parseBody(request, schema);
      const anonymousId = input.anonymousId || null;
      if (!user && !anonymousId) {
        throw new Error("Bad Request: anonymous session key required");
      }

      let brandId = user ? input.brandId || null : null;
      let organizationId = user?.memberships[0]?.organizationId ?? null;

      if (user && brandId) {
        const access = await requireBrandAccess(brandId);
        organizationId = access.brand.organizationId;
      }

      let session =
        input.sessionId && user
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
            })
          : input.sessionId && anonymousId
            ? await prisma.aiChatSession.findFirst({
                where: {
                  id: input.sessionId,
                  userId: null,
                  metadata: {
                    path: ["anonymousId"],
                    equals: anonymousId,
                  },
                },
              })
            : null;

      if (user && session?.brandId && !brandId) {
        const access = await requireBrandAccess(session.brandId);
        brandId = access.brand.id;
        organizationId = access.brand.organizationId;
      }

      const previousMessages = session
        ? previousChatMessagesForPrompt(
            (
              await prisma.aiChatMessage.findMany({
                where: { sessionId: session.id },
                orderBy: { createdAt: "desc" },
                take: 8,
                select: { role: true, content: true },
              })
            ).reverse(),
          )
        : [];

      if (!session) {
        session = await prisma.aiChatSession.create({
          data: {
            userId: user?.id ?? null,
            organizationId,
            brandId,
            title: chatSessionTitle(input.message),
            locale: user?.preferredLocale ?? input.locale,
            intent: classifyChatIntent(input.message),
            summary: `Started with: ${chatSessionTitle(input.message)}`,
            metadata: {
              anonymousId,
              supportMode: user ? "account" : "public",
            },
          },
        });
      } else {
        session = await prisma.aiChatSession.update({
          where: { id: session.id },
          data: {
            userId: user?.id ?? session.userId,
            organizationId: organizationId ?? session.organizationId,
            brandId: brandId ?? session.brandId,
            status: "active",
            lastMessageAt: new Date(),
          },
        });
      }

      activeSessionId = session.id;

      const userMessage = await prisma.aiChatMessage.create({
        data: {
          sessionId: session.id,
          userId: user?.id ?? null,
          role: "user",
          content: input.message,
          metadata: {
            brandId,
            organizationId,
            source: "in_app_chat",
          },
        },
      });

      const { context, toolCall } = user
        ? await buildAccountChatContext({
            userId: user.id,
            brandId,
          })
        : await buildPublicSupportChatContext({
            locale: input.locale,
            anonymousId,
          });
      const completion = await runAccountChatCompletion({
        context,
        previousMessages,
        userMessage: input.message,
      });
      const answer =
        completion.text ||
        "Trenutno ne morem pripraviti odgovora iz razpolozljivega konteksta.";

      const assistantMessage = await prisma.aiChatMessage.create({
        data: {
          sessionId: session.id,
          role: "assistant",
          content: answer,
          model: completion.model,
          inputTokens: completion.inputTokens,
          outputTokens: completion.outputTokens,
          latencyMs: completion.latencyMs,
          metadata: {
            provider: "openai",
            userMessageId: userMessage.id,
          },
        },
      });

      await prisma.$transaction([
        prisma.aiChatToolCall.create({
          data: {
            sessionId: session.id,
            messageId: assistantMessage.id,
            toolName: toolCall.toolName,
            inputJson: toolCall.inputJson,
            outputJson: toolCall.outputJson,
            status: "completed",
            latencyMs: toolCall.latencyMs,
          },
        }),
        prisma.aiChatSession.update({
          where: { id: session.id },
          data: {
            status: "active",
            intent: classifyChatIntent(input.message),
            summary: chatSessionSummary(input.message, answer),
            lastMessageAt: new Date(),
          },
        }),
      ]);

      return ok({
        session: {
          id: session.id,
          title: session.title,
          intent: classifyChatIntent(input.message),
        },
        message: {
          id: assistantMessage.id,
          role: assistantMessage.role,
          content: assistantMessage.content,
          createdAt: assistantMessage.createdAt,
        },
        usage: {
          inputTokens: completion.inputTokens,
          outputTokens: completion.outputTokens,
          latencyMs: completion.latencyMs,
        },
      });
    } catch (error) {
      if (activeSessionId) {
        await prisma.aiChatSession
          .update({
            where: { id: activeSessionId },
            data: { status: "failed", lastMessageAt: new Date() },
          })
          .catch(() => null);
      }
      throw error;
    }
  });
}
