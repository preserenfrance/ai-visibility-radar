import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, MessageSquare, MousePointer2 } from "lucide-react";
import { prisma } from "@ai-radar/db";
import { MentionsTrendChart } from "@/components/mentions-trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getCurrentUser, isAdminUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

export default async function AdminAiChatsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/ai-chats");
  if (!isAdminUser(user)) {
    return (
      <main className="p-8">You do not have access to the admin area.</main>
    );
  }

  const days = lastDays(WINDOW_DAYS, new Date());
  const start = days[0]?.date ?? new Date();
  const [recentSessions, sessions, messages, feedbackCount, toolCallCount] =
    await Promise.all([
      prisma.aiChatSession.findMany({
        orderBy: { lastMessageAt: "desc" },
        take: 50,
        include: {
          user: { select: { email: true, name: true } },
          organization: { select: { name: true, plan: true } },
          brand: { select: { name: true, domain: true } },
          _count: {
            select: { messages: true, toolCalls: true, feedback: true },
          },
        },
      }),
      prisma.aiChatSession.findMany({
        where: { createdAt: { gte: start } },
        select: {
          createdAt: true,
          userId: true,
          status: true,
          intent: true,
        },
      }),
      prisma.aiChatMessage.findMany({
        where: { createdAt: { gte: start } },
        select: { createdAt: true, role: true },
      }),
      prisma.aiChatFeedback.count({ where: { createdAt: { gte: start } } }),
      prisma.aiChatToolCall.count({ where: { createdAt: { gte: start } } }),
    ]);

  const publicSessions = sessions.filter((session) => !session.userId).length;
  const accountSessions = sessions.length - publicSessions;
  const assistantMessages = messages.filter(
    (message) => message.role === "assistant",
  ).length;
  const failedSessions = sessions.filter(
    (session) => session.status === "failed",
  ).length;
  const points = buildDailyChatPoints(days, sessions, messages);
  const topIntents = Object.entries(
    sessions.reduce<Record<string, number>>((counts, session) => {
      const key = session.intent || "general";
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <Bot className="h-5 w-5" />
            AI support analytics
          </div>
          <h1 className="text-3xl font-semibold">AI chats</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Customer support conversations, account-aware assistant usage and
            data-access audit for the last {WINDOW_DAYS} days.
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Chat sessions" value={sessions.length} />
        <MetricCard label="Messages" value={messages.length} />
        <MetricCard label="Assistant replies" value={assistantMessages} />
        <MetricCard label="Feedback" value={feedbackCount} />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Public chats" value={publicSessions} />
        <MetricCard label="Account chats" value={accountSessions} />
        <MetricCard label="Data tool calls" value={toolCallCount} />
        <MetricCard label="Failed sessions" value={failedSessions} />
      </div>

      <MentionsTrendChart
        title="AI chat activity"
        description={`Daily sessions and messages over the last ${WINDOW_DAYS} days.`}
        series={[
          {
            key: "sessions",
            label: `Sessions (${sessions.length.toLocaleString("en-US")})`,
            color: "#2563eb",
          },
          {
            key: "messages",
            label: `Messages (${messages.length.toLocaleString("en-US")})`,
            color: "#0f766e",
          },
        ]}
        points={points}
        promptMarkers={[]}
        emptyMessage="No AI chat activity in this period."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MousePointer2 className="h-5 w-5 text-primary" />
              Top intents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {topIntents.map(([intent, count]) => (
                <div
                  key={intent}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{intent}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
              {topIntents.length === 0 && (
                <p className="text-sm text-muted-foreground">No intents yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Recent sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <THead>
                <TR>
                  <TH>Session</TH>
                  <TH>User</TH>
                  <TH>Brand</TH>
                  <TH>Intent</TH>
                  <TH>Messages</TH>
                  <TH>Status</TH>
                  <TH>Last activity</TH>
                </TR>
              </THead>
              <TBody>
                {recentSessions.map((session) => (
                  <TR key={session.id}>
                    <TD>
                      <Link
                        href={`/admin/ai-chats/${session.id}`}
                        className="font-medium text-primary"
                      >
                        {session.title || "Untitled chat"}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {session._count.toolCalls} tool calls -{" "}
                        {session._count.feedback} feedback
                      </div>
                    </TD>
                    <TD>
                      {session.user ? (
                        <>
                          <div>{session.user.email}</div>
                          {session.organization && (
                            <div className="text-xs text-muted-foreground">
                              {session.organization.name} -{" "}
                              {session.organization.plan}
                            </div>
                          )}
                        </>
                      ) : (
                        <Badge variant="secondary">public visitor</Badge>
                      )}
                    </TD>
                    <TD>
                      {session.brand ? (
                        <>
                          <div>{session.brand.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {session.brand.domain}
                          </div>
                        </>
                      ) : (
                        "-"
                      )}
                    </TD>
                    <TD>{session.intent || "general"}</TD>
                    <TD>{session._count.messages}</TD>
                    <TD>
                      <Badge
                        variant={
                          session.status === "failed" ? "danger" : "secondary"
                        }
                      >
                        {session.status}
                      </Badge>
                    </TD>
                    <TD>{session.lastMessageAt.toLocaleString("en-US")}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-semibold">
          {value.toLocaleString("en-US")}
        </div>
      </CardContent>
    </Card>
  );
}

function buildDailyChatPoints(
  days: Array<{ date: Date; key: string; label: string }>,
  sessions: Array<{ createdAt: Date }>,
  messages: Array<{ createdAt: Date }>,
) {
  return days.map((day) => ({
    date: day.key,
    label: day.label,
    values: {
      sessions: countOnDay(sessions, day.date),
      messages: countOnDay(messages, day.date),
    },
  }));
}

function countOnDay(items: Array<{ createdAt: Date }>, day: Date) {
  const start = startOfDay(day);
  const end = endOfDay(day);
  return items.filter(
    (item) => item.createdAt >= start && item.createdAt <= end,
  ).length;
}

function lastDays(count: number, now: Date) {
  const end = startOfDay(now);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (count - index - 1));
    return {
      date,
      key: dayKey(date),
      label: `${date.getDate()}.${date.getMonth() + 1}.`,
    };
  });
}

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
