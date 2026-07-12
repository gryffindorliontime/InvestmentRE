"use client";

import { ConfidenceBadge } from "./ConfidenceBadge";
import { buildRealtorSearchUrl, buildZillowSearchUrl } from "@/lib/externalLinks";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { EnrichedListing } from "@/lib/searchEngine";
import type { SortKey, SortState } from "@/lib/types";

interface ResultsTableProps {
  listings: EnrichedListing[];
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  onSelect: (listing: EnrichedListing) => void;
  selectedId: string | null;
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "price", label: "Price" },
  { key: "monthlyRent", label: "Est. Rent" },
  { key: "capRatePct", label: "Cap Rate" },
  { key: "cashOnCashPct", label: "Cash-on-Cash" },
  { key: "monthlyCashFlow", label: "Cash Flow / mo" },
  { key: "rentToPricePct", label: "Rent/Price" },
  { key: "daysOnMarket", label: "DOM" },
];

function cashFlowColor(value: number): string {
  return value >= 0 ? "text-emerald-700" : "text-rose-700";
}

export function ResultsTable({ listings, sort, onSortChange, onSelect, selectedId }: ResultsTableProps) {
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
              <td className="px-3 py-2">
                <div className="font-medium text-slate-900">{property.address}</div>
                <div className="text-xs text-slate-500">
                  {property.city}, {property.state} {property.zip} · {property.homeType} ·{" "}
                  {property.beds > 0 ? `${property.beds}bd/${property.baths}ba` : "—"} ·{" "}
                  {property.sqft > 0 ? `${property.sqft.toLocaleString()} sqft` : "—"}
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
                  <a
                    href={buildRealtorSearchUrl(property)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-blue-600 hover:underline"
                  >
                    Realtor.com ↗
                  </a>
                </div>
              </td>
              <td className="px-3 py-2 font-medium text-slate-900">{formatCurrency(property.price)}</td>
              <td className="px-3 py-2">
                <div className="text-slate-900">{formatCurrency(rentEstimate.monthlyRent)}/mo</div>
                <ConfidenceBadge estimate={rentEstimate} />
              </td>
              <td className="px-3 py-2 font-medium text-slate-900">{formatPercent(roi.capRatePct)}</td>
              <td className="px-3 py-2 font-medium text-slate-900">{formatPercent(roi.cashOnCashPct)}</td>
              <td className={`px-3 py-2 font-medium ${cashFlowColor(roi.monthlyCashFlow)}`}>
                {formatCurrency(roi.monthlyCashFlow)}
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
