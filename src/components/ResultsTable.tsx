"use client";

import { ConfidenceBadge } from "./ConfidenceBadge";
import { buildZillowSearchUrl } from "@/lib/externalLinks";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { EnrichedListing } from "@/lib/searchEngine";
import type { SortKey, SortState } from "@/lib/types";

interface ResultsTableProps {
  listings: EnrichedListing[];
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  onSelect: (listing: EnrichedListing) => void;
  selectedId: string | null;
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  compareLimitReached: boolean;
  onExportPdf: (listing: EnrichedListing) => void;
  savedIds: Set<string>;
  onToggleSave: (listing: EnrichedListing) => void;
  canSave: boolean;
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "price", label: "Price" },
  { key: "monthlyRent", label: "Est. Rent" },
  { key: "capRatePct", label: "Cap Rate" },
  { key: "cashOnCashPct", label: "Cash-on-Cash" },
  { key: "monthlyCashFlow", label: "Cash Flow / mo" },
  { key: "targetPrice", label: "Price @ Target" },
  { key: "rentToPricePct", label: "Rent/Price" },
  { key: "daysOnMarket", label: "DOM" },
];

const NEW_LISTING_MAX_DOM = 7;

function cashFlowColor(value: number): string {
  return value >= 0 ? "text-emerald-700" : "text-rose-700";
}

export function ResultsTable({
  listings,
  sort,
  onSortChange,
  onSelect,
  selectedId,
  compareIds,
  onToggleCompare,
  compareLimitReached,
  onExportPdf,
  savedIds,
  onToggleSave,
  canSave,
}: ResultsTableProps) {
  function handleSort(key: SortKey) {
    if (sort.key === key) {
      onSortChange({ key, direction: sort.direction === "asc" ? "desc" : "asc" });
    } else {
      onSortChange({ key, direction: "desc" });
    }
  }

  if (listings.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-sm text-slate-500">
        No properties match the current filters. Try widening your price range or clearing a filter.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 bg-white shadow-sm">
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="px-2 py-2 font-medium" title="Select up to 4 to compare">
              ⇄
            </th>
            <th className="px-3 py-2 font-medium">Property</th>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="cursor-pointer select-none px-3 py-2 font-medium hover:text-slate-900"
              >
                {col.label} {sort.key === col.key ? (sort.direction === "asc" ? "↑" : "↓") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {listings.map(({ property, rentEstimate, roi }) => (
            <tr
              key={property.id}
              onClick={() => onSelect({ property, rentEstimate, roi })}
              className={`cursor-pointer border-b border-slate-100 hover:bg-blue-50 ${
                selectedId === property.id ? "bg-blue-50" : ""
              }`}
            >
              <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={compareIds.includes(property.id)}
                  disabled={compareLimitReached && !compareIds.includes(property.id)}
                  onChange={() => onToggleCompare(property.id)}
                  title="Compare"
                />
              </td>
              <td className="px-3 py-2">
                <div className="font-medium text-slate-900">
                  {property.address}
                  {property.daysOnMarket <= NEW_LISTING_MAX_DOM && (
                    <span className="ml-1.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                      NEW
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">
                  {property.city}, {property.state} {property.zip} · {property.homeType} ·{" "}
                  {property.beds > 0 ? `${property.beds}bd/${property.baths}ba` : "—"} ·{" "}
                  {property.sqft > 0 ? `${property.sqft.toLocaleString()} sqft` : "—"}
                  {property.floodZone &&
                    (property.floodZone.riskLevel === "High" ||
                      property.floodZone.riskLevel === "Moderate") && (
                      <span
                        className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          property.floodZone.riskLevel === "High"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                        title={`FEMA flood zone ${property.floodZone.zone} — ${property.floodZone.riskLevel.toLowerCase()} risk`}
                      >
                        ⚠ Flood {property.floodZone.zone}
                      </span>
                    )}
                </div>
                <div className="mt-1 flex gap-2 text-xs">
                  <a
                    href={buildZillowSearchUrl(property)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-600 hover:underline"
                  >
                    Zillow ↗
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onExportPdf({ property, rentEstimate, roi });
                    }}
                    className="text-blue-600 hover:underline"
                    title="Download an investment report PDF for this listing"
                  >
                    PDF ⤓
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSave({ property, rentEstimate, roi });
                    }}
                    disabled={!canSave}
                    className={
                      savedIds.has(property.id)
                        ? "font-medium text-amber-600 hover:underline disabled:opacity-40"
                        : "text-blue-600 hover:underline disabled:opacity-40"
                    }
                    title={canSave ? "Save to the active project" : "Select or create a project to save listings"}
                  >
                    {savedIds.has(property.id) ? "★ Saved" : "☆ Save"}
                  </button>
                </div>
              </td>
              <td className="px-3 py-2 font-medium text-slate-900">{formatCurrency(property.price)}</td>
              <td className="px-3 py-2">
                <div className="text-slate-900">
                  {formatCurrency(rentEstimate.monthlyRent)}/mo{" "}
                  {property.unitCount > 1 && (
                    <span className="text-xs text-slate-500">
                      total ({formatCurrency(rentEstimate.perUnitMonthlyRent)}/unit)
                    </span>
                  )}
                </div>
                <ConfidenceBadge estimate={rentEstimate} />
              </td>
              <td className="px-3 py-2 font-medium text-slate-900">{formatPercent(roi.capRatePct)}</td>
              <td className="px-3 py-2 font-medium text-slate-900">{formatPercent(roi.cashOnCashPct)}</td>
              <td className={`px-3 py-2 font-medium ${cashFlowColor(roi.monthlyCashFlow)}`}>
                {formatCurrency(roi.monthlyCashFlow)}
              </td>
              <td className="px-3 py-2">
                {roi.targetPrice === null ? (
                  <span className="text-slate-400">—</span>
                ) : (
                  <div>
                    <span className={`font-medium ${roi.meetsRequiredReturn ? "text-emerald-700" : "text-slate-900"}`}>
                      {formatCurrency(roi.targetPrice)}
                    </span>
                    <div className={`text-xs ${roi.meetsRequiredReturn ? "text-emerald-700" : "text-slate-500"}`}>
                      {roi.meetsRequiredReturn
                        ? "meets target"
                        : property.price > 0
                          ? `${formatPercent(((roi.targetPrice - property.price) / property.price) * 100, 0)} vs ask`
                          : ""}
                    </div>
                  </div>
                )}
              </td>
              <td className="px-3 py-2 text-slate-700">{formatPercent(roi.rentToPricePct, 2)}</td>
              <td className="px-3 py-2 text-slate-700">{property.daysOnMarket}d</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
