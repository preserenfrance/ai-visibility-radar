"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { LineChart, MousePointer2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MentionTrendSeries = {
  key: string;
  label: string;
  color: string;
  total?: number;
};

export type MentionTrendPoint = {
  date: string;
  label: string;
  values: Record<string, number>;
};

export type PromptAdditionMarker = {
  date: string;
  label: string;
  count: number;
};

const VIEWBOX_WIDTH = 960;
const VIEWBOX_HEIGHT = 320;
const PLOT = {
  left: 52,
  right: 22,
  top: 34,
  bottom: 46,
};

export function MentionsTrendChart({
  series,
  domainSeries = [],
  points,
  promptMarkers,
  title = "Omembe skozi čas",
  description = "Zadnjih 30 dni po modelih in najpogosteje omenjenih domenah.",
  domainSeriesLabel = "Najpogosteje omenjene domene",
  emptyMessage = "V zadnjih 30 dneh še ni zabeleženih omemb.",
}: {
  series: MentionTrendSeries[];
  domainSeries?: MentionTrendSeries[];
  points: MentionTrendPoint[];
  promptMarkers: PromptAdditionMarker[];
  title?: string;
  description?: string;
  domainSeriesLabel?: string;
  emptyMessage?: string;
}) {
  const allSeries = useMemo(
    () => [...series, ...domainSeries],
    [domainSeries, series],
  );
  const allSeriesKeys = useMemo(
    () => allSeries.map((item) => item.key).join("|"),
    [allSeries],
  );
  const [visibleSeries, setVisibleSeries] = useState(
    () => new Set(allSeries.map((item) => item.key)),
  );
  const previousSeriesKeys = useRef<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const previousKeys = new Set(
      previousSeriesKeys.current?.split("|").filter(Boolean) ?? [],
    );
    setVisibleSeries((current) => {
      const allowed = new Set(allSeries.map((item) => item.key));
      const next = new Set<string>();

      for (const key of current) {
        if (allowed.has(key)) next.add(key);
      }
      for (const item of allSeries) {
        if (!previousKeys.has(item.key)) next.add(item.key);
      }

      return next;
    });
    previousSeriesKeys.current = allSeriesKeys;
  }, [allSeries, allSeriesKeys]);

  const activeSeries = allSeries.filter((item) => visibleSeries.has(item.key));
  const plotWidth = VIEWBOX_WIDTH - PLOT.left - PLOT.right;
  const plotHeight = VIEWBOX_HEIGHT - PLOT.top - PLOT.bottom;
  const maxValue = niceMax(
    Math.max(
      0,
      ...points.flatMap((point) =>
        activeSeries.map((item) => point.values[item.key] ?? 0),
      ),
    ),
  );
  const yTicks = yTickValues(maxValue);

  const markerByDate = useMemo(() => {
    const map = new Map<string, PromptAdditionMarker>();
    for (const marker of promptMarkers) map.set(marker.date, marker);
    return map;
  }, [promptMarkers]);

  function xForIndex(index: number) {
    if (points.length <= 1) return PLOT.left + plotWidth / 2;
    return PLOT.left + (index / (points.length - 1)) * plotWidth;
  }

  function yForValue(value: number) {
    return PLOT.top + plotHeight - (value / maxValue) * plotHeight;
  }

  function pathForSeries(key: string) {
    return points
      .map((point, index) => {
        const prefix = index === 0 ? "M" : "L";
        return `${prefix}${xForIndex(index).toFixed(2)},${yForValue(
          point.values[key] ?? 0,
        ).toFixed(2)}`;
      })
      .join(" ");
  }

  function handlePointerMove(event: PointerEvent<SVGRectElement>) {
    if (points.length === 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * VIEWBOX_WIDTH;
    const rawIndex =
      points.length <= 1
        ? 0
        : Math.round(((svgX - PLOT.left) / plotWidth) * (points.length - 1));
    setHoverIndex(Math.max(0, Math.min(points.length - 1, rawIndex)));
  }

  function toggleSeries(key: string) {
    setVisibleSeries((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const hoverPoint = hoverIndex === null ? null : points[hoverIndex];
  const hoverX = hoverIndex === null ? null : xForIndex(hoverIndex);
  const hoverMarker = hoverPoint ? markerByDate.get(hoverPoint.date) : null;
  const hasData = points.some((point) =>
    allSeries.some((item) => (point.values[item.key] ?? 0) > 0),
  );

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5 text-primary" />
              {title}
            </CardTitle>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <MousePointer2 className="h-4 w-4" />
            Premakni miško čez graf
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {series.length > 0 && (
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {series.map((item) => {
              const checked = visibleSeries.has(item.key);
              return (
                <label
                  key={item.key}
                  className={cn(
                    "flex min-h-10 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm transition-colors",
                    checked ? "border-primary/30" : "opacity-60",
                  )}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={checked}
                    onChange={() => toggleSeries(item.key)}
                  />
                  <span
                    className="h-2.5 w-5 rounded-full"
                    style={{ backgroundColor: item.color }}
                    aria-hidden="true"
                  />
                  <span className="font-medium">{item.label}</span>
                </label>
              );
            })}
          </div>
        )}

        <div className="relative overflow-x-auto pb-2">
          <div className="min-w-[760px]">
            <svg
              role="img"
              aria-label={title}
              viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
              className="h-auto w-full"
            >
              <rect
                x={PLOT.left}
                y={PLOT.top}
                width={plotWidth}
                height={plotHeight}
                fill="white"
                rx="4"
              />

              {yTicks.map((tick) => {
                const y = yForValue(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={PLOT.left}
                      y1={y}
                      x2={VIEWBOX_WIDTH - PLOT.right}
                      y2={y}
                      stroke="#e5e7eb"
                    />
                    <text
                      x={PLOT.left - 12}
                      y={y + 4}
                      textAnchor="end"
                      className="fill-slate-500 text-[11px]"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {points.map((point, index) => {
                const x = xForIndex(index);
                const showLabel =
                  index === 0 || index === points.length - 1 || index % 7 === 0;
                const marker = markerByDate.get(point.date);
                return (
                  <g key={point.date}>
                    {marker && (
                      <>
                        <line
                          x1={x}
                          y1={PLOT.top}
                          x2={x}
                          y2={PLOT.top + plotHeight}
                          stroke="#64748b"
                          strokeDasharray="4 5"
                          strokeWidth="1.5"
                        />
                        <circle
                          cx={x}
                          cy={PLOT.top - 12}
                          r="5"
                          fill="#64748b"
                        />
                        <text
                          x={x}
                          y={PLOT.top - 18}
                          textAnchor="middle"
                          className="fill-slate-600 text-[10px] font-semibold"
                        >
                          +{marker.count}
                        </text>
                      </>
                    )}
                    <line
                      x1={x}
                      y1={PLOT.top + plotHeight}
                      x2={x}
                      y2={PLOT.top + plotHeight + 5}
                      stroke="#cbd5e1"
                    />
                    {showLabel && (
                      <text
                        x={x}
                        y={PLOT.top + plotHeight + 24}
                        textAnchor="middle"
                        className="fill-slate-500 text-[11px]"
                      >
                        {point.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {activeSeries.map((item) => (
                <path
                  key={item.key}
                  d={pathForSeries(item.key)}
                  fill="none"
                  stroke={item.color}
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {hoverPoint && hoverX !== null && (
                <g>
                  <line
                    x1={hoverX}
                    y1={PLOT.top}
                    x2={hoverX}
                    y2={PLOT.top + plotHeight}
                    stroke="#0f172a"
                    strokeDasharray="3 4"
                    opacity="0.35"
                  />
                  {activeSeries.map((item) => (
                    <circle
                      key={item.key}
                      cx={hoverX}
                      cy={yForValue(hoverPoint.values[item.key] ?? 0)}
                      r="4.5"
                      fill="white"
                      stroke={item.color}
                      strokeWidth="2.4"
                    />
                  ))}
                </g>
              )}

              <rect
                x={PLOT.left}
                y={PLOT.top}
                width={plotWidth}
                height={plotHeight}
                fill="transparent"
                onPointerMove={handlePointerMove}
                onPointerLeave={() => setHoverIndex(null)}
              />
            </svg>
          </div>

          {hoverPoint && hoverX !== null && (
            <div
              className="pointer-events-none absolute top-12 z-10 w-56 rounded-md border bg-white p-3 text-xs shadow-lg"
              style={{
                left: `${Math.min(82, Math.max(6, (hoverX / VIEWBOX_WIDTH) * 100))}%`,
              }}
            >
              <div className="mb-2 font-semibold">{hoverPoint.label}</div>
              <div className="grid gap-1.5">
                {activeSeries.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className="font-semibold">
                      {hoverPoint.values[item.key] ?? 0}
                    </span>
                  </div>
                ))}
              </div>
              {hoverMarker && (
                <div className="mt-2 rounded bg-secondary px-2 py-1 text-muted-foreground">
                  Dodani prompti: {hoverMarker.count}
                </div>
              )}
            </div>
          )}
        </div>

        {domainSeries.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                {domainSeriesLabel}
              </div>
              <div className="text-xs text-muted-foreground">
                Top {domainSeries.length}
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {domainSeries.map((item) => {
                const checked = visibleSeries.has(item.key);
                return (
                  <label
                    key={item.key}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm transition-colors",
                      checked ? "border-primary/30" : "opacity-60",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0"
                      checked={checked}
                      onChange={() => toggleSeries(item.key)}
                    />
                    <span
                      className="h-2.5 w-5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {item.label}
                    </span>
                    {typeof item.total === "number" && (
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                        {item.total}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {!hasData && (
          <div className="mt-3 rounded-md border bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function niceMax(value: number) {
  if (value <= 4) return 4;
  if (value <= 10) return 10;
  if (value <= 20) return 20;
  return Math.ceil(value / 10) * 10;
}

function yTickValues(maxValue: number) {
  return Array.from({ length: 5 }, (_, index) =>
    Math.round((maxValue / 4) * index),
  ).filter((value, index, values) => values.indexOf(value) === index);
}
