import { Badge } from "@/components/ui/badge";

export type ModelMentionSummary = {
  id: string;
  engineName: string;
  status: string;
  brandMentioned?: boolean | null;
  brandRank?: number | null;
};

export function ModelMentionBadges({ runs }: { runs: ModelMentionSummary[] }) {
  if (runs.length === 0)
    return <span className="text-muted-foreground">-</span>;

  return (
    <div className="flex flex-wrap gap-2">
      {runs.map((run) => {
        const resultReady = typeof run.brandMentioned === "boolean";
        const variant = resultReady
          ? run.brandMentioned
            ? "success"
            : "danger"
          : run.status === "failed"
            ? "danger"
            : run.status === "running" || run.status === "queued"
              ? "warning"
              : "secondary";
        const label = resultReady
          ? run.brandMentioned
            ? `${run.engineName}: omenjena${typeof run.brandRank === "number" ? ` #${run.brandRank}` : ""}`
            : `${run.engineName}: ni omenjena`
          : `${run.engineName}: ${statusLabel(run.status)}`;

        return (
          <Badge key={run.id} variant={variant}>
            {label}
          </Badge>
        );
      })}
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

function statusLabel(status: string) {
  switch (status) {
    case "queued":
    case "running":
      return "v delu";
    case "completed":
      return "končano";
    case "failed":
      return "napaka";
    case "canceled":
      return "preklicano";
    default:
      return status;
  }
}
