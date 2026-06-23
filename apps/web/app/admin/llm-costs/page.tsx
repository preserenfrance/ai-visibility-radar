import { redirect } from "next/navigation";
import { prisma } from "@ai-radar/db";
import { BarChart3, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getCurrentUser, isAdminUser, requireAdminUser } from "@/lib/auth";
import {
  availableAiModels,
  saveAiModelSettings,
  type AiModelOptionGroup,
} from "@/lib/ai-model-settings";
import {
  estimatedAiCostUsd,
  formatMoney,
  LLM_COST_PROVIDER_LABELS,
  LLM_COST_PROVIDERS,
  providerRateLabel,
  type LlmCostProvider,
} from "@/lib/llm-costs";

export const dynamic = "force-dynamic";

async function saveModelSettings(formData: FormData) {
  "use server";
  const user = await requireAdminUser();
  await saveAiModelSettings(
    {
      classic: {
        openai: String(formData.get("classic_openai") ?? "").trim(),
        google: String(formData.get("classic_google") ?? "").trim(),
        anthropic: String(formData.get("classic_anthropic") ?? "").trim(),
      },
      search: {
        openai: String(formData.get("search_openai") ?? "").trim(),
        google: String(formData.get("search_google") ?? "").trim(),
        anthropic: String(formData.get("search_anthropic") ?? "").trim(),
      },
    },
    user.email,
  );
  redirect("/admin/llm-costs?models=saved");
}

type ProviderSummary = {
  provider: LlmCostProvider;
  label: string;
  totalUsd: number;
  storedUsd: number;
  estimatedUsd: number;
  inputTokens: number;
  outputTokens: number;
  responseCount: number;
  storedResponseCount: number;
  estimatedResponseCount: number;
  models: Set<string>;
  daily: Array<{ key: string; label: string; value: number }>;
};

export default async function AdminLlmCostsPage({
  searchParams,
}: {
  searchParams?: Promise<{ models?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin/llm-costs");
  if (!isAdminUser(user))
    return <main className="p-8">Nimate dostopa do admin strani.</main>;

  const params = await searchParams;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const days = daysInMonthToDate(now);
  const responses = await prisma.aiResponse.findMany({
    where: {
      createdAt: {
        gte: monthStart,
        lt: nextMonthStart,
      },
      provider: { in: LLM_COST_PROVIDERS },
    },
    select: {
      provider: true,
      model: true,
      cost: true,
      inputTokens: true,
      outputTokens: true,
      createdAt: true,
    },
  });

  const [summaries, modelOptions] = await Promise.all([
    Promise.resolve(buildProviderSummaries(days, responses)),
    availableAiModels(),
  ]);
  const monthTotal = summaries.reduce((sum, item) => sum + item.totalUsd, 0);
  const storedTotal = summaries.reduce((sum, item) => sum + item.storedUsd, 0);
  const estimatedTotal = summaries.reduce(
    (sum, item) => sum + item.estimatedUsd,
    0,
  );
  const responseTotal = summaries.reduce(
    (sum, item) => sum + item.responseCount,
    0,
  );
  const estimatedResponseTotal = summaries.reduce(
    (sum, item) => sum + item.estimatedResponseCount,
    0,
  );
  const inputTokenTotal = summaries.reduce(
    (sum, item) => sum + item.inputTokens,
    0,
  );
  const outputTokenTotal = summaries.reduce(
    (sum, item) => sum + item.outputTokens,
    0,
  );

  return (
    <section className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-primary">
            <DollarSign className="h-5 w-5" />
            Admin analitika
          </div>
          <h1 className="text-3xl font-semibold">
            LLM poraba in ocena stroškov
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Dnevna poraba po providerju in skupna ocena v tekočem mesecu. Zneski
            niso račun providerjev; temeljijo na shranjenih AI odgovorih in
            tokenih v aplikaciji.
          </p>
        </div>
        <div className="rounded-lg border bg-white px-5 py-4 text-right">
          <div className="text-xs font-semibold uppercase text-muted-foreground">
            Ocenjeno skupaj ta mesec
          </div>
          <div className="mt-1 text-3xl font-semibold">
            ${formatMoney(monthTotal)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            {responseTotal} AI odgovorov
          </div>
        </div>
      </div>

      <Card className="mb-6 border-amber-300 bg-amber-50">
        <CardContent className="p-4 text-sm text-amber-950">
          Ta stran ni natančen obračun dobaviteljev. Natančna je samo toliko,
          kolikor so v bazi shranjeni provider stroški. Če `AiResponse.cost` ni
          shranjen, uporabimo oceno iz input/output tokenov. Pomožni klici, ki
          se ne shranijo kot `AiResponse` (na primer predlaganje promptov), v
          tem prikazu niso zajeti.
        </CardContent>
      </Card>

      <ModelSettingsCard
        options={modelOptions}
        saved={params?.models === "saved"}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <MetricCard
          label="Zabeleženo iz providerja"
          value={`$${formatMoney(storedTotal)}`}
        />
        <MetricCard
          label="Ocenjeno iz tokenov"
          value={`$${formatMoney(estimatedTotal)}`}
        />
        <MetricCard
          label="Odgovori brez shranjenega cost"
          value={estimatedResponseTotal.toLocaleString("sl-SI")}
        />
        <MetricCard
          label="Povprečna ocena na odgovor"
          value={`$${formatMoney(responseTotal ? monthTotal / responseTotal : 0)}`}
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <MetricCard
          label="Input tokeni"
          value={inputTokenTotal.toLocaleString("sl-SI")}
        />
        <MetricCard
          label="Output tokeni"
          value={outputTokenTotal.toLocaleString("sl-SI")}
        />
      </div>

      <div className="grid gap-4">
        {summaries.map((summary) => (
          <ProviderCostCard key={summary.provider} summary={summary} />
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Povzetek po providerjih</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Provider</TH>
                <TH>Poraba ta mesec</TH>
                <TH>Odgovori</TH>
                <TH>Input tokeni</TH>
                <TH>Output tokeni</TH>
                <TH>Vir stroška</TH>
                <TH>Modeli</TH>
              </TR>
            </THead>
            <TBody>
              {summaries.map((summary) => (
                <TR key={summary.provider}>
                  <TD>{summary.label}</TD>
                  <TD>${formatMoney(summary.totalUsd)}</TD>
                  <TD>{summary.responseCount}</TD>
                  <TD>{summary.inputTokens.toLocaleString("sl-SI")}</TD>
                  <TD>{summary.outputTokens.toLocaleString("sl-SI")}</TD>
                  <TD>
                    {summary.storedResponseCount} zabeleženih,{" "}
                    {summary.estimatedResponseCount} ocenjenih
                  </TD>
                  <TD>{Array.from(summary.models).join(", ") || "-"}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}

function ModelSettingsCard({
  options,
  saved,
}: {
  options: AiModelOptionGroup[];
  saved: boolean;
}) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Globalni AI modeli</CardTitle>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Izbira velja za nove scane vseh uporabnikov. Seznam modelov se
              prebere iz API-jev ponudnikov; če ponudnik ni dosegljiv, ostane
              trenutni model ročno izbran.
            </p>
          </div>
          {saved && (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
              Modeli so shranjeni.
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <form action={saveModelSettings} className="grid gap-4">
          {options.map((group) => (
            <div key={group.mode} className="rounded-lg border p-4">
              <div className="mb-3">
                <h3 className="font-medium">{group.label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {group.description}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {group.options.map((option) => (
                  <label key={option.fieldName} className="grid gap-2 text-sm">
                    <span className="font-medium">{option.label}</span>
                    <select
                      name={option.fieldName}
                      defaultValue={option.currentModel}
                      className="h-10 rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      {option.models.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                    {option.error && (
                      <span className="text-xs text-amber-700">
                        {option.error}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
          <Button type="submit" className="w-fit">
            Shrani globalne modele
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProviderCostCard({ summary }: { summary: ProviderSummary }) {
  const maxDaily = Math.max(...summary.daily.map((day) => day.value), 0);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {summary.label}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {providerRateLabel(
                summary.provider,
                Array.from(summary.models)[0],
              )}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Ocenjeno ta mesec
            </div>
            <div className="text-2xl font-semibold">
              ${formatMoney(summary.totalUsd)}
            </div>
            <div className="text-xs text-muted-foreground">
              ${formatMoney(summary.storedUsd)} zabeleženo · $
              {formatMoney(summary.estimatedUsd)} ocenjeno
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DailyBarChart days={summary.daily} maxDaily={maxDaily} />
      </CardContent>
    </Card>
  );
}

function DailyBarChart({
  days,
  maxDaily,
}: {
  days: Array<{ key: string; label: string; value: number }>;
  maxDaily: number;
}) {
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-[720px] items-end gap-1 border-b border-l px-3 pt-4">
        {days.map((day, index) => {
          const height =
            maxDaily > 0 ? Math.max(3, (day.value / maxDaily) * 100) : 0;
          const showLabel =
            index === 0 ||
            index === days.length - 1 ||
            Number(day.label) % 5 === 0;

          return (
            <div
              key={day.key}
              className="flex flex-1 flex-col items-center gap-2"
            >
              <div className="flex h-36 w-full items-end">
                <div
                  className="w-full rounded-t bg-primary/80"
                  style={{ height: `${height}%` }}
                  title={`${day.key}: $${formatMoney(day.value)}`}
                />
              </div>
              <div className="h-4 text-[10px] text-muted-foreground">
                {showLabel ? day.label : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function buildProviderSummaries(
  days: Array<{ key: string; label: string }>,
  responses: Array<{
    provider: string;
    model: string;
    cost: unknown;
    inputTokens: number | null;
    outputTokens: number | null;
    createdAt: Date;
  }>,
) {
  const summaries = Object.fromEntries(
    LLM_COST_PROVIDERS.map((provider) => [
      provider,
      {
        provider,
        label: LLM_COST_PROVIDER_LABELS[provider],
        totalUsd: 0,
        storedUsd: 0,
        estimatedUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
        responseCount: 0,
        storedResponseCount: 0,
        estimatedResponseCount: 0,
        models: new Set<string>(),
        daily: days.map((day) => ({ ...day, value: 0 })),
      } satisfies ProviderSummary,
    ]),
  ) as Record<LlmCostProvider, ProviderSummary>;

  for (const response of responses) {
    if (!isCostProvider(response.provider)) continue;
    const summary = summaries[response.provider];
    const storedCost =
      response.cost === null || response.cost === undefined
        ? null
        : Number(response.cost);
    const estimatedCost = estimatedAiCostUsd({
      provider: response.provider,
      model: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
    });
    const cost = Number.isFinite(storedCost ?? NaN)
      ? storedCost!
      : estimatedCost;
    const day = summary.daily.find(
      (item) => item.key === dayKey(response.createdAt),
    );

    summary.totalUsd += cost;
    summary.inputTokens += response.inputTokens ?? 0;
    summary.outputTokens += response.outputTokens ?? 0;
    summary.responseCount += 1;
    summary.models.add(response.model);
    if (Number.isFinite(storedCost ?? NaN)) {
      summary.storedUsd += storedCost!;
      summary.storedResponseCount += 1;
    } else {
      summary.estimatedUsd += cost;
      summary.estimatedResponseCount += 1;
    }
    if (day) day.value += cost;
  }

  return LLM_COST_PROVIDERS.map((provider) => summaries[provider]);
}

function daysInMonthToDate(now: Date) {
  return Array.from({ length: now.getDate() }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), index + 1);
    return {
      key: dayKey(date),
      label: String(index + 1),
    };
  });
}

function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isCostProvider(value: string): value is LlmCostProvider {
  return LLM_COST_PROVIDERS.includes(value as LlmCostProvider);
}
