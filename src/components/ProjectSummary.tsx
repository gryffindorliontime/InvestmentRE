"use client";

import { formatCurrency, formatPercent } from "@/lib/format";
import type { EnrichedListing } from "@/lib/searchEngine";

interface ProjectSummaryProps {
  projectName: string;
  listings: EnrichedListing[];
  onSelect: (listing: EnrichedListing) => void;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-slate-200 bg-white px-4 py-3">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

// One listing per row: label left, a track with a fill anchored at zero (so
// negative cash flow reads as "left of center" rather than a bare shrunken
// bar), and the exact value direct-labeled at the end — no hover needed to
// read the number.
function BarRow({
  label,
  sublabel,
  displayValue,
  value,
  min,
  max,
  colorClass,
  onClick,
}: {
  label: string;
  sublabel: string;
  displayValue: string;
  value: number;
  min: number;
  max: number;
  colorClass: string;
  onClick: () => void;
}) {
  const span = max - min || 1;
  const zeroPct = ((0 - min) / span) * 100;
  const valuePct = ((value - min) / span) * 100;
  const barLeft = Math.min(zeroPct, valuePct);
  const barWidth = Math.max(Math.abs(valuePct - zeroPct), 1.5);

  return (
    <button
      onClick={onClick}
      title={`${label} — ${displayValue}`}
      className="flex w-full items-center gap-3 rounded px-1 py-1 text-left hover:bg-slate-50"
    >
      <div className="w-36 shrink-0">
        <div className="truncate text-xs font-medium text-slate-700">{label}</div>
        <div className="truncate text-[10px] text-slate-400">{sublabel}</div>
      </div>
      <div className="relative h-3 flex-1 rounded-full bg-slate-100">
        {min < 0 && <div className="absolute inset-y-0 w-px bg-slate-300" style={{ left: `${zeroPct}%` }} />}
        <div
          className={`absolute inset-y-0 rounded-full ${colorClass}`}
          style={{ left: `${barLeft}%`, width: `${barWidth}%` }}
        />
      </div>
      <div className="w-20 shrink-0 text-right text-xs font-medium text-slate-700">{displayValue}</div>
    </button>
  );
}

export function ProjectSummary({ projectName, listings, onSelect }: ProjectSummaryProps) {
  if (listings.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-sm text-slate-500">
        No listings saved to &quot;{projectName}&quot; yet — save some from the Table or Map view to see a
        summary here.
      </div>
    );
  }

  const prices = listings.map((l) => l.property.price);
  const capRates = listings.map((l) => l.roi.capRatePct);
  const cashOnCash = listings.map((l) => l.roi.cashOnCashPct);
  const cashFlows = listings.map((l) => l.roi.monthlyCashFlow);

  const capRateMin = Math.min(0, ...capRates);
  const capRateMax = Math.max(0, ...capRates);
  const cashFlowMin = Math.min(0, ...cashFlows);
  const cashFlowMax = Math.max(0, ...cashFlows);

  const byCapRateDesc = [...listings].sort((a, b) => b.roi.capRatePct - a.roi.capRatePct);
  const byCashFlowDesc = [...listings].sort((a, b) => b.roi.monthlyCashFlow - a.roi.monthlyCashFlow);

  return (
    <div className="flex-1 overflow-auto p-4">
      <h2 className="text-sm font-semibold text-slate-900">
        {listings.length} listing{listings.length === 1 ? "" : "s"} saved to &quot;{projectName}&quot;
      </h2>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Median price" value={formatCurrency(median(prices))} />
        <StatTile label="Median cap rate" value={formatPercent(median(capRates))} />
        <StatTile label="Median cash-on-cash" value={formatPercent(median(cashOnCash))} />
        <StatTile label="Median cash flow / mo" value={formatCurrency(median(cashFlows))} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded border border-slate-200 bg-white p-3">
          <h3 className="text-xs font-semibold text-slate-700">Cap rate by listing</h3>
          <div className="mt-2 flex flex-col gap-1">
            {byCapRateDesc.map(({ property, roi }) => (
              <BarRow
                key={property.id}
                label={property.address}
                sublabel={`${property.city}, ${property.state}`}
                value={roi.capRatePct}
                displayValue={formatPercent(roi.capRatePct)}
                min={capRateMin}
                max={capRateMax}
                colorClass="bg-blue-500"
                onClick={() => onSelect(listings.find((l) => l.property.id === property.id)!)}
              />
            ))}
          </div>
        </div>

        <div className="rounded border border-slate-200 bg-white p-3">
          <h3 className="text-xs font-semibold text-slate-700">Cash flow by listing</h3>
          <div className="mt-2 flex flex-col gap-1">
            {byCashFlowDesc.map(({ property, roi }) => (
              <BarRow
                key={property.id}
                label={property.address}
                sublabel={`${property.city}, ${property.state}`}
                value={roi.monthlyCashFlow}
                displayValue={formatCurrency(roi.monthlyCashFlow)}
                min={cashFlowMin}
                max={cashFlowMax}
                colorClass={roi.monthlyCashFlow >= 0 ? "bg-emerald-500" : "bg-rose-500"}
                onClick={() => onSelect(listings.find((l) => l.property.id === property.id)!)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
