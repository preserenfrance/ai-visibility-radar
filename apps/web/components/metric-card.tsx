import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const METRIC_DEFINITIONS = {
  visibility: {
    label: "Vidnost",
    description:
      "Skupna ocena AI prisotnosti znamke skozi omembe, rang, citate, delež glasu in točnost.",
  },
  mentions: {
    label: "Omembe",
    description:
      "Kako pogosto AI modeli v odgovorih sploh omenijo tvojo znamko.",
  },
  shareOfVoice: {
    label: "Delež glasu",
    description:
      "Kolikšen delež vseh zaznanih omemb pripada tvoji znamki v primerjavi s konkurenti.",
  },
  accuracy: {
    label: "Točnost",
    description:
      "Kako pravilne in zanesljive so navedbe o tvoji znamki, ko jo AI model omeni.",
  },
} as const;

export type MetricDefinitionKey = keyof typeof METRIC_DEFINITIONS;

export function MetricCard({
  metric,
  value,
}: {
  metric: MetricDefinitionKey;
  value: number;
}) {
  const definition = METRIC_DEFINITIONS[metric];
  const boundedValue = Math.max(0, Math.min(100, value));

  return (
    <Card title={definition.description}>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm">{definition.label}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 pt-0">
        <div className="flex items-end justify-between gap-3">
          <div className="text-2xl font-semibold">{boundedValue}/100</div>
          <div className="text-xs text-muted-foreground">
            {scoreBandLabel(boundedValue)}
          </div>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-secondary"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${boundedValue}%` }}
          />
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {definition.description}
        </p>
      </CardContent>
    </Card>
  );
}

function scoreBandLabel(value: number) {
  if (value >= 80) return "močno";
  if (value >= 50) return "srednje";
  if (value > 0) return "šibko";
  return "brez podatka";
}
