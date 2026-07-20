"use client";

import { useEffect, useState } from "react";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { EnrichedListing } from "@/lib/searchEngine";

interface ProjectSummaryProps {
  projectName: string;
  listings: EnrichedListing[];
  onSelect: (listing: EnrichedListing) => void;
}

const STORAGE_KEY = "roi-dashboard:project-summary-config";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// --- Stat tiles --------------------------------------------------------
// A superset of headline numbers; which ones render is user-picked (see
// Customize panel below) and remembered in localStorage — a display
// preference, not project data, so it doesn't need a database round trip.

type StatKey =
  | "count"
  | "medianPrice"
  | "priceRange"
  | "medianCapRate"
  | "medianCashOnCash"
  | "medianCashFlow"
  | "medianRentToPrice"
  | "medianPricePerSqft"
  | "medianDom"
  | "meetsTarget"
  | "bestCapRate"
  | "worstCashFlow";

const STAT_DEFS: { key: StatKey; label: string; compute: (listings: EnrichedListing[]) => string }[] = [
  { key: "count", label: "Listings", compute: (l) => String(l.length) },
  {
    key: "medianPrice",
    label: "Median price",
    compute: (l) => formatCurrency(median(l.map((x) => x.property.price))),
  },
  {
    key: "priceRange",
    label: "Price range",
    compute: (l) => {
      const prices = l.map((x) => x.property.price);
      return `${formatCurrency(Math.min(...prices))} – ${formatCurrency(Math.max(...prices))}`;
    },
  },
  {
    key: "medianCapRate",
    label: "Median cap rate",
    compute: (l) => formatPercent(median(l.map((x) => x.roi.capRatePct))),
  },
  {
    key: "medianCashOnCash",
    label: "Median cash-on-cash",
    compute: (l) => formatPercent(median(l.map((x) => x.roi.cashOnCashPct))),
  },
  {
    key: "medianCashFlow",
    label: "Median cash flow / mo",
    compute: (l) => formatCurrency(median(l.map((x) => x.roi.monthlyCashFlow))),
  },
  {
    key: "medianRentToPrice",
    label: "Median rent/price",
    compute: (l) => formatPercent(median(l.map((x) => x.roi.rentToPricePct)), 2),
  },
  {
    key: "medianPricePerSqft",
    label: "Median $/sqft",
    compute: (l) => formatCurrency(median(l.map((x) => x.property.pricePerSqft))),
  },
  {
    key: "medianDom",
    label: "Median days on market",
    compute: (l) => `${Math.round(median(l.map((x) => x.property.daysOnMarket)))}d`,
  },
  {
    key: "meetsTarget",
    label: "Meet target return",
    compute: (l) => `${l.filter((x) => x.roi.meetsRequiredReturn).length}/${l.length}`,
  },
  {
    key: "bestCapRate",
    label: "Best cap rate",
    compute: (l) => {
      const best = l.reduce((a, b) => (b.roi.capRatePct > a.roi.capRatePct ? b : a));
      return `${best.property.address} · ${formatPercent(best.roi.capRatePct)}`;
    },
  },
  {
    key: "worstCashFlow",
    label: "Worst cash flow",
    compute: (l) => {
      const worst = l.reduce((a, b) => (b.roi.monthlyCashFlow < a.roi.monthlyCashFlow ? b : a));
      return `${worst.property.address} · ${formatCurrency(worst.roi.monthlyCashFlow)}`;
    },
  },
];

const DEFAULT_STAT_KEYS: StatKey[] = ["medianPrice", "medianCapRate", "medianCashOnCash", "medianCashFlow"];

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 truncate text-xl font-semibold text-slate-900" title={value}>
        {value}
      </div>
    </div>
  );
}

// --- Bar charts ----------------------------------------------------------
// Magnitude comparisons (price, cap rate, cash-on-cash, rent/price, home
// type counts) share one hue — they're the same "compare magnitude" job,
// not distinct series, so a rainbow would be a misuse of categorical color.
// Cash flow is the one diverging case: it has a real zero baseline (profit
// vs loss), so it gets the emerald/rose split already used in the table.

type ChartKey = "capRate" | "cashFlow" | "price" | "cashOnCash" | "rentToPrice" | "homeType";

interface ChartRow {
  key: string;
  label: string;
  sublabel: string;
  value: number;
  displayValue: string;
  onClick?: () => void;
}

function perListingRows(
  listings: EnrichedListing[],
  valueOf: (l: EnrichedListing) => number,
  formatValue: (v: number) => string,
  onSelect: (listing: EnrichedListing) => void
): ChartRow[] {
  return [...listings]
    .sort((a, b) => valueOf(b) - valueOf(a))
    .map((l) => ({
      key: l.property.id,
      label: l.property.address,
      sublabel: `${l.property.city}, ${l.property.state}`,
      value: valueOf(l),
      displayValue: formatValue(valueOf(l)),
      onClick: () => onSelect(l),
    }));
}

function homeTypeRows(listings: EnrichedListing[]): ChartRow[] {
  const counts = new Map<string, number>();
  for (const l of listings) counts.set(l.property.homeType, (counts.get(l.property.homeType) ?? 0) + 1);
  const total = listings.length;
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([homeType, count]) => ({
      key: homeType,
      label: homeType,
      sublabel: `${Math.round((count / total) * 100)}% of ${total}`,
      value: count,
      displayValue: String(count),
    }));
}

const CHART_DEFS: {
  key: ChartKey;
  title: string;
  diverging: boolean;
  rows: (listings: EnrichedListing[], onSelect: (l: EnrichedListing) => void) => ChartRow[];
}[] = [
  {
    key: "capRate",
    title: "Cap rate by listing",
    diverging: false,
    rows: (l, s) => perListingRows(l, (x) => x.roi.capRatePct, (v) => formatPercent(v), s),
  },
  {
    key: "cashFlow",
    title: "Cash flow by listing",
    diverging: true,
    rows: (l, s) => perListingRows(l, (x) => x.roi.monthlyCashFlow, (v) => formatCurrency(v), s),
  },
  {
    key: "price",
    title: "Price by listing",
    diverging: false,
    rows: (l, s) => perListingRows(l, (x) => x.property.price, (v) => formatCurrency(v), s),
  },
  {
    key: "cashOnCash",
    title: "Cash-on-cash by listing",
    diverging: false,
    rows: (l, s) => perListingRows(l, (x) => x.roi.cashOnCashPct, (v) => formatPercent(v), s),
  },
  {
    key: "rentToPrice",
    title: "Rent/price by listing",
    diverging: false,
    rows: (l, s) => perListingRows(l, (x) => x.roi.rentToPricePct, (v) => formatPercent(v, 2), s),
  },
  {
    key: "homeType",
    title: "Home type mix",
    diverging: false,
    rows: (l) => homeTypeRows(l),
  },
];

const DEFAULT_CHART_KEYS: ChartKey[] = ["capRate", "cashFlow"];

function loadConfig(): { stats: StatKey[] | null; charts: ChartKey[] | null } {
  if (typeof window === "undefined") return { stats: null, charts: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { stats: null, charts: null };
    const parsed = JSON.parse(raw);
    const stats = Array.isArray(parsed.stats)
      ? parsed.stats.filter((k: string) => STAT_DEFS.some((d) => d.key === k))
      : null;
    const charts = Array.isArray(parsed.charts)
      ? parsed.charts.filter((k: string) => CHART_DEFS.some((d) => d.key === k))
      : null;
    return { stats: stats && stats.length > 0 ? stats : null, charts };
  } catch {
    return { stats: null, charts: null };
  }
}

// A row's label left, a track with a fill anchored at zero (so negative
// values read as "left of center" rather than a bare shrunken bar), and the
// exact value direct-labeled at the end — no hover needed to read a number.
function BarRow({ row, min, max, colorClass }: { row: ChartRow; min: number; max: number; colorClass: string }) {
  const span = max - min || 1;
  const zeroPct = ((0 - min) / span) * 100;
  const valuePct = ((row.value - min) / span) * 100;
  const barLeft = Math.min(zeroPct, valuePct);
  const barWidth = Math.max(Math.abs(valuePct - zeroPct), 1.5);

  const content = (
    <>
      <div className="w-36 shrink-0">
        <div className="truncate text-xs font-medium text-slate-700">{row.label}</div>
        <div className="truncate text-[10px] text-slate-400">{row.sublabel}</div>
      </div>
      <div className="relative h-3 flex-1 rounded-full bg-slate-100">
        {min < 0 && <div className="absolute inset-y-0 w-px bg-slate-300" style={{ left: `${zeroPct}%` }} />}
        <div
          className={`absolute inset-y-0 rounded-full ${colorClass}`}
          style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
        />
      </div>
      <div className="w-20 shrink-0 text-right text-xs font-medium text-slate-700">{row.displayValue}</div>
    </>
  );

  if (!row.onClick) {
    return (
      <div title={`${row.label} — ${row.displayValue}`} className="flex w-full items-center gap-3 px-1 py-1">
        {content}
      </div>
    );
  }
  return (
    <button
      onClick={row.onClick}
      title={`${row.label} — ${row.displayValue}`}
      className="flex w-full items-center gap-3 rounded px-1 py-1 text-left hover:bg-slate-50"
    >
      {content}
    </button>
  );
}

function ChartCard({
  title,
  rows,
  diverging,
}: {
  title: string;
  rows: ChartRow[];
  diverging: boolean;
}) {
  if (rows.length === 0) return null;
  const values = rows.map((r) => r.value);
  const min = diverging ? Math.min(0, ...values) : 0;
  const max = Math.max(0, ...values);

  return (
    <div className="rounded border border-slate-200 bg-white p-3">
      <h3 className="text-xs font-semibold text-slate-700">{title}</h3>
      <div className="mt-2 flex flex-col gap-1">
        {rows.map((row) => (
          <BarRow
            key={row.key}
            row={row}
            min={min}
            max={max}
            colorClass={diverging ? (row.value >= 0 ? "bg-emerald-500" : "bg-rose-500") : "bg-blue-500"}
          />
        ))}
      </div>
    </div>
  );
}

// --- Customize panel -------------------------------------------------------

function CustomizePanel({
  statKeys,
  chartKeys,
  onToggleStat,
  onToggleChart,
}: {
  statKeys: StatKey[];
  chartKeys: ChartKey[];
  onToggleStat: (key: StatKey) => void;
  onToggleChart: (key: ChartKey) => void;
}) {
  return (
    <details className="relative">
      <summary className="flex cursor-pointer select-none items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        Customize
        <span className="text-slate-400">▾</span>
      </summary>
      <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded border border-slate-200 bg-white p-3 shadow-lg">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Stat tiles</p>
        <div className="mt-1 flex flex-col gap-1">
          {STAT_DEFS.map((def) => (
            <label key={def.key} className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={statKeys.includes(def.key)}
                onChange={() => onToggleStat(def.key)}
              />
              {def.label}
            </label>
          ))}
        </div>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Charts</p>
        <div className="mt-1 flex flex-col gap-1">
          {CHART_DEFS.map((def) => (
            <label key={def.key} className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={chartKeys.includes(def.key)}
                onChange={() => onToggleChart(def.key)}
              />
              {def.title}
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}

export function ProjectSummary({ projectName, listings, onSelect }: ProjectSummaryProps) {
  // Lazy-init from localStorage rather than an effect: this component only
  // ever mounts client-side after the user clicks the Summary tab (never
  // part of the server-rendered HTML), so there's no hydration mismatch to
  // guard against — reading synchronously here just avoids a defaults-then-
  // loaded flash.
  const [statKeys, setStatKeys] = useState<StatKey[]>(() => loadConfig().stats ?? DEFAULT_STAT_KEYS);
  const [chartKeys, setChartKeys] = useState<ChartKey[]>(() => loadConfig().charts ?? DEFAULT_CHART_KEYS);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ stats: statKeys, charts: chartKeys }));
  }, [statKeys, chartKeys]);

  function toggleStat(key: StatKey) {
    setStatKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }
  function toggleChart(key: ChartKey) {
    setChartKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  if (listings.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-sm text-slate-500">
        No listings saved to &quot;{projectName}&quot; yet — save some from the Table or Map view to see a
        summary here.
      </div>
    );
  }

  const activeStats = STAT_DEFS.filter((d) => statKeys.includes(d.key));
  const activeCharts = CHART_DEFS.filter((d) => chartKeys.includes(d.key));

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">
          {listings.length} listing{listings.length === 1 ? "" : "s"} saved to &quot;{projectName}&quot;
        </h2>
        <CustomizePanel
          statKeys={statKeys}
          chartKeys={chartKeys}
          onToggleStat={toggleStat}
          onToggleChart={toggleChart}
        />
      </div>

      {activeStats.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {activeStats.map((def) => (
            <StatTile key={def.key} label={def.label} value={def.compute(listings)} />
          ))}
        </div>
      )}

      {activeCharts.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {activeCharts.map((def) => (
            <ChartCard
              key={def.key}
              title={def.title}
              diverging={def.diverging}
              rows={def.rows(listings, onSelect)}
            />
          ))}
        </div>
      )}

      {activeStats.length === 0 && activeCharts.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">
          Nothing selected — click Customize above to add stat tiles or charts.
        </p>
      )}
    </div>
  );
}
