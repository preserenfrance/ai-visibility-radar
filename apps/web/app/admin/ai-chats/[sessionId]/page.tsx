import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bot, Database, MessageSquare } from "lucide-react";
import { prisma } from "@ai-radar/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getCurrentUser, isAdminUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminAiChatDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/ai-chats");
  if (!isAdminUser(user)) {
    return (
      <main className="p-8">You do not have access to the admin area.</main>
    );
  }

  const { sessionId } = await params;
  const session = await prisma.aiChatSession.findUnique({
    where: { id: sessionId },
    include: {
      user: { select: { email: true, name: true } },
      organization: { select: { name: true, plan: true } },
      brand: { select: { name: true, domain: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          feedback: {
            orderBy: { createdAt: "desc" },
            select: { rating: true, comment: true, createdAt: true },
          },
        },
      },
      toolCalls: {
        orderBy: { createdAt: "asc" },
      },
      feedback: {
        orderBy: { createdAt: "desc" },
        include: {
          message: { select: { id: true, role: true } },
          user: { select: { email: true } },
        },
      },
    },
  });

  if (!session) notFound();

  const assistantMessages = session.messages.filter(
    (message) => message.role === "assistant",
  );
  const inputTokens = assistantMessages.reduce(
    (sum, message) => sum + (message.inputTokens ?? 0),
    0,
  );
  const outputTokens = assistantMessages.reduce(
    (sum, message) => sum + (message.outputTokens ?? 0),
    0,
  );
  const averageLatency =
    assistantMessages.length === 0
      ? 0
      : Math.round(
          assistantMessages.reduce(
            (sum, message) => sum + (message.latencyMs ?? 0),
            0,
          ) / assistantMessages.length,
        );

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <Bot className="h-5 w-5" />
            AI chat detail
          </div>
          <h1 className="text-3xl font-semibold">
            {session.title || "Untitled chat"}
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            {session.user?.email ?? "Public visitor"} -{" "}
            {session.createdAt.toLocaleString("en-US")}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/ai-chats">Back to AI chats</Link>
        </Button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Messages" value={session.messages.length} />
        <MetricCard label="Tool calls" value={session.toolCalls.length} />
        <MetricCard label="Input tokens" value={inputTokens} />
        <MetricCard label="Output tokens" value={outputTokens} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Session context</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm md:grid-cols-4">
          <InlineFact label="Status" value={session.status} />
          <InlineFact label="Intent" value={session.intent || "general"} />
          <InlineFact
            label="Organization"
            value={
              session.organization
                ? `${session.organization.name} (${session.organization.plan})`
                : "-"
            }
          />
          <InlineFact
            label="Brand"
            value={
              session.brand
                ? `${session.brand.name} (${session.brand.domain})`
                : "-"
            }
          />
          <InlineFact label="Locale" value={session.locale} />
          <InlineFact
            label="Avg. latency"
            value={averageLatency ? `${averageLatency} ms` : "-"}
          />
          <InlineFact
            label="Last activity"
            value={session.lastMessageAt.toLocaleString("en-US")}
          />
          <InlineFact
            label="Feedback"
            value={session.feedback.length.toLocaleString("en-US")}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(22rem,0.7fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Transcript
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {session.messages.map((message) => (
              <article
                key={message.id}
                className={[
                  "rounded-md border p-4",
                  message.role === "assistant" ? "bg-secondary/20" : "bg-white",
                ].join(" ")}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        message.role === "assistant" ? "default" : "secondary"
                      }
                    >
                      {message.role}
                    </Badge>
                    {message.model && (
                      <span className="text-xs text-muted-foreground">
                        {message.model}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {message.createdAt.toLocaleString("en-US")}
                  </span>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-7">
                  {message.content}
                </div>
                {message.feedback.length > 0 && (
                  <div className="mt-3 grid gap-2">
                    {message.feedback.map((feedback) => (
                      <div
                        key={`${message.id}-${feedback.createdAt.toISOString()}`}
                        className="rounded-md border bg-white px-3 py-2 text-xs"
                      >
                        <Badge
                          variant={feedback.rating > 0 ? "success" : "danger"}
                        >
                          {feedback.rating > 0 ? "helpful" : "not helpful"}
                        </Badge>
                        {feedback.comment && (
                          <div className="mt-1 text-muted-foreground">
                            {feedback.comment}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Data access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <THead>
                  <TR>
                    <TH>Tool</TH>
                    <TH>Status</TH>
                    <TH>Latency</TH>
                  </TR>
                </THead>
                <TBody>
                  {session.toolCalls.map((toolCall) => (
                    <TR key={toolCall.id}>
                      <TD>
                        <details>
                          <summary className="cursor-pointer font-medium text-primary">
                            {toolCall.toolName}
                          </summary>
                          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded bg-slate-950 p-3 text-xs text-white">
                            {JSON.stringify(
                              {
                                input: toolCall.inputJson,
                                output: toolCall.outputJson,
                              },
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      </TD>
                      <TD>
                        <Badge variant="secondary">{toolCall.status}</Badge>
                      </TD>
                      <TD>
                        {toolCall.latencyMs ? `${toolCall.latencyMs} ms` : "-"}
                      </TD>
                    </TR>
                  ))}
                  {session.toolCalls.length === 0 && (
                    <TR>
                      <TD colSpan={3} className="text-muted-foreground">
                        No data access was recorded.
                      </TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap rounded-md border bg-secondary/20 p-3 text-sm leading-7">
                {session.summary || "No summary yet."}
              </pre>
            </CardContent>
          </Card>
        </div>
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

function InlineFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
