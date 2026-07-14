"use client";

import { buildZillowSearchUrl } from "@/lib/externalLinks";
import { formatCurrency, formatPercent } from "@/lib/format";
import { buildProjection } from "@/lib/projection";
import type { EnrichedListing } from "@/lib/searchEngine";
import type { FinancingAssumptions } from "@/lib/types";

interface CompareModalProps {
  listings: EnrichedListing[];
  assumptions: FinancingAssumptions;
  onClose: () => void;
  onRemove: (id: string) => void;
}

export function CompareModal({ listings, assumptions, onClose, onRemove }: CompareModalProps) {
  if (listings.length === 0) return null;

  const projections = listings.map((l) =>
    l.property.homeType === "Land" ? null : buildProjection(l.property, l.roi, assumptions)
  );
  const irrAt = (index: number, year: number): string => {
    const p = projections[index];
    if (!p) return "—";
    const row = p.years.find((y) => y.year === year);
    return row?.irrIfSoldPct == null ? "—" : formatPercent(row.irrIfSoldPct);
  };

  const metricRows: { label: string; render: (l: EnrichedListing, i: number) => React.ReactNode }[] = [
    { label: "Price", render: (l) => formatCurrency(l.property.price) },
    {
      label: "Est. rent (total)",
      render: (l) => `${formatCurrency(l.rentEstimate.monthlyRent)}/mo`,
    },
    { label: "Cap rate", render: (l) => formatPercent(l.roi.capRatePct) },
    { label: "Cash-on-cash", render: (l) => formatPercent(l.roi.cashOnCashPct) },
    {
      label: "Monthly cash flow",
      render: (l) => (
        <span className={l.roi.monthlyCashFlow >= 0 ? "text-emerald-700" : "text-rose-700"}>
          {formatCurrency(l.roi.monthlyCashFlow)}
        </span>
      ),
    },
    { label: "Rent-to-price", render: (l) => formatPercent(l.roi.rentToPricePct, 2) },
    { label: "Cash invested", render: (l) => formatCurrency(l.roi.totalCashInvested) },
    { label: "Monthly P&I", render: (l) => formatCurrency(l.roi.monthlyMortgagePI) },
    { label: "IRR if sold yr 5", render: (_, i) => irrAt(i, 5) },
    { label: "IRR if sold yr 10", render: (_, i) => irrAt(i, 10) },
    {
      label: "Appreciation (blended)",
      render: (_, i) => {
        const p = projections[i];
        return p ? `${formatPercent(p.appreciation.blendedPct * 100)}/yr` : "—";
      },
    },
    { label: "Days on market", render: (l) => `${l.property.daysOnMarket}d` },
  ];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      <div
        className="max-h-full w-full max-w-4xl overflow-auto rounded-lg bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Compare properties</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <table className="mt-4 w-full text-sm">
          <thead>
            <tr>
              <th className="w-40 px-2 py-2 text-left text-xs font-medium text-slate-500">Metric</th>
              {listings.map((l) => (
                <th key={l.property.id} className="px-2 py-2 text-left align-top">
                  <div className="font-semibold text-slate-900">{l.property.address}</div>
                  <div className="text-xs font-normal text-slate-500">
                    {l.property.city}, {l.property.state} · {l.property.homeType}
                  </div>
                  <div className="mt-1 flex gap-2 text-xs font-normal">
                    <a
                      href={buildZillowSearchUrl(l.property)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      Zillow ↗
                    </a>
                    <button
                      onClick={() => onRemove(l.property.id)}
                      className="font-medium text-rose-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metricRows.map((row) => (
              <tr key={row.label} className="border-t border-slate-100">
                <td className="px-2 py-1.5 text-xs text-slate-500">{row.label}</td>
                {listings.map((l, i) => (
                  <td key={l.property.id} className="px-2 py-1.5 font-medium text-slate-900">
                    {row.render(l, i)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
