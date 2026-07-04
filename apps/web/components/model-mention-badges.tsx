import { Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ModelMentionSummary = {
  id: string;
  engineName: string;
  status: string;
  provider?: string;
  searchEnabled?: boolean;
  brandMentioned?: boolean | null;
  brandRank?: number | null;
};

export function ModelMentionBadges({ runs }: { runs: ModelMentionSummary[] }) {
  if (runs.length === 0)
    return <span className="text-muted-foreground">-</span>;

  const columns = modelMentionColumns(runs);

  return (
    <div className="inline-block max-w-full overflow-x-auto rounded-md border bg-background align-middle">
      <table className="border-collapse text-xs">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="h-8 w-9 border-r border-b bg-secondary/40 p-1 last:border-r-0"
                title={column.label}
                aria-label={column.label}
              >
                <EngineIcon column={column} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {columns.map((column) => (
              <td
                key={column.key}
                className="h-8 w-9 border-r p-1 text-center last:border-r-0"
              >
                <MentionIndicator
                  runs={runs.filter(
                    (run) => modelMentionColumnForRun(run).key === column.key,
                  )}
                />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function CompetitorMentionCount({ names }: { names: string[] }) {
  const uniqueNames = Array.from(new Set(names.filter(Boolean)));
  const label =
    uniqueNames.length === 1
      ? "1 konkurent"
      : `${uniqueNames.length} konkurentov`;

  return (
    <Badge
      variant={uniqueNames.length ? "secondary" : "secondary"}
      title={
        uniqueNames.length ? uniqueNames.join(", ") : "Ni omenjenih konkurentov"
      }
    >
      {label}
    </Badge>
  );
}

export type ModelMentionColumn = {
  key: string;
  provider: string;
  searchEnabled: boolean;
  label: string;
  sortIndex: number;
};

export function modelMentionColumns(runs: ModelMentionSummary[]) {
  const columns = new Map<string, ModelMentionColumn>();
  for (const run of runs) {
    const column = modelMentionColumnForRun(run);
    if (!columns.has(column.key)) columns.set(column.key, column);
  }

  return [...columns.values()].sort(
    (left, right) =>
      left.sortIndex - right.sortIndex || left.label.localeCompare(right.label),
  );
}

export function modelMentionColumnForRun(
  run: ModelMentionSummary,
): ModelMentionColumn {
  const provider = run.provider ?? providerFromEngineName(run.engineName);
  const searchEnabled =
    run.searchEnabled ?? /\bsearch\b|\+\s*search/i.test(run.engineName);
  const providerOrder = providerSortIndex(provider);
  const key = `${provider}:${searchEnabled ? "search" : "base"}`;

  return {
    key,
    provider,
    searchEnabled,
    label: engineLabel(provider, searchEnabled, run.engineName),
    sortIndex: providerOrder * 10 + (searchEnabled ? 1 : 0),
  };
}

export function MentionIndicator({ runs }: { runs: ModelMentionSummary[] }) {
  const state = mentionState(runs);
  return (
    <span
      className={cn(
        "mx-auto block h-3.5 w-3.5 rounded-full border shadow-sm",
        state === "success" && "border-emerald-700 bg-emerald-500",
        state === "danger" && "border-rose-700 bg-rose-500",
        state === "warning" && "border-amber-700 bg-amber-400",
      )}
      title={mentionTitle(runs)}
      aria-label={mentionTitle(runs)}
    />
  );
}

function mentionState(runs: ModelMentionSummary[]) {
  const readyRuns = runs.filter(
    (run) => typeof run.brandMentioned === "boolean",
  );
  if (readyRuns.some((run) => run.brandMentioned)) return "success";
  if (readyRuns.length > 0) return "danger";
  return "warning";
}

function mentionTitle(runs: ModelMentionSummary[]) {
  const readyRuns = runs.filter(
    (run) => typeof run.brandMentioned === "boolean",
  );
  const mentioned = readyRuns.filter((run) => run.brandMentioned);
  if (mentioned.length > 0) {
    const bestRank = bestRankForRuns(mentioned);
    return bestRank ? `Omenjena, najboljši rang #${bestRank}` : "Omenjena";
  }
  if (readyRuns.length > 0) return "Ni omenjena";
  if (runs.some((run) => run.status === "failed")) return "Napaka pri izvedbi";
  if (runs.some((run) => run.status === "canceled"))
    return "Izvedba preklicana";
  if (runs.some((run) => run.status === "queued" || run.status === "running"))
    return "V delu";
  return "Ni rezultata";
}

function bestRankForRuns(runs: ModelMentionSummary[]) {
  const ranks = runs
    .map((run) => run.brandRank)
    .filter((rank): rank is number => typeof rank === "number");
  return ranks.length ? Math.min(...ranks) : null;
}

export function EngineIcon({ column }: { column: ModelMentionColumn }) {
  return (
    <span className="relative mx-auto flex h-6 w-6 items-center justify-center">
      {column.provider === "openai" ? (
        <OpenAiMark />
      ) : column.provider === "google" ? (
        <Sparkles className="h-4 w-4 text-[#4285f4]" />
      ) : column.provider === "anthropic" ? (
        <span className="font-serif text-[15px] font-semibold leading-none text-[#b45309]">
          C
        </span>
      ) : (
        <span className="text-[10px] font-semibold uppercase text-muted-foreground">
          AI
        </span>
      )}
      {column.searchEnabled && (
        <span className="absolute -right-1 -bottom-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border bg-white">
          <Search className="h-2.5 w-2.5 text-slate-700" />
        </span>
      )}
    </span>
  );
}

function OpenAiMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 text-slate-900"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      >
        <path d="M12 3.4a4.1 4.1 0 0 1 3.9 2.8l2.2 1.3a4.1 4.1 0 0 1 .1 7.1 4.1 4.1 0 0 1-4 5.9 4.1 4.1 0 0 1-7.1-1.8l-2.2-1.3a4.1 4.1 0 0 1-.1-7.1 4.1 4.1 0 0 1 4-5.9A4 4 0 0 1 12 3.4Z" />
        <path d="m8.1 6.2 7.8 4.5v6.9" />
        <path d="m15.9 6.3-7.8 4.5v6.9" />
        <path d="m4.8 10.3 7.2 4.1 7.1-4" />
      </g>
    </svg>
  );
}

function providerFromEngineName(engineName: string) {
  const normalized = engineName.toLowerCase();
  if (normalized.includes("chatgpt") || normalized.includes("openai"))
    return "openai";
  if (normalized.includes("gemini") || normalized.includes("google"))
    return "google";
  if (normalized.includes("claude") || normalized.includes("anthropic"))
    return "anthropic";
  return normalized.replace(/\s+/g, "-") || "unknown";
}

function providerSortIndex(provider: string) {
  if (provider === "openai") return 0;
  if (provider === "google") return 1;
  if (provider === "anthropic") return 2;
  if (provider === "mock") return 3;
  return 9;
}

function engineLabel(
  provider: string,
  searchEnabled: boolean,
  fallback: string,
) {
  const suffix = searchEnabled ? " + search" : "";
  if (provider === "openai") return `ChatGPT${suffix}`;
  if (provider === "google") return `Gemini${suffix}`;
  if (provider === "anthropic") return `Claude${suffix}`;
  return fallback;
}
