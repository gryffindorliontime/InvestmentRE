"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { AssumptionsPanel } from "@/components/AssumptionsPanel";
import { FilterPanel } from "@/components/FilterPanel";
import { PropertyDetailDrawer } from "@/components/PropertyDetailDrawer";
import { ResultsTable } from "@/components/ResultsTable";
import { DEFAULT_FILTERS } from "@/lib/constants";
import { DEFAULT_ASSUMPTIONS } from "@/lib/roi";
import { applyFilters, buildEnrichedListings, sortListings } from "@/lib/searchEngine";
import type { FinancingAssumptions, SearchFilters, SortState } from "@/lib/types";

// Leaflet touches `window`, so the map must never render during SSR.
const PropertyMap = dynamic(() => import("@/components/PropertyMap").then((m) => m.PropertyMap), {
  ssr: false,
});

// Live RentCast integration is intentionally disabled — the dashboard runs
// entirely on the generated mock dataset (src/lib/mockData.ts, 1,000 listings
// across ~48 US metros). The live client, API routes, and LiveSearchBar
// component remain in the repo, dormant behind ENABLE_LIVE_API=false, for
// easy re-enabling later.
export default function Home() {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [assumptions, setAssumptions] = useState<FinancingAssumptions>(DEFAULT_ASSUMPTIONS);
  const [sort, setSort] = useState<SortState>({ key: "capRatePct", direction: "desc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "map">("table");

  const allListings = useMemo(() => buildEnrichedListings(assumptions), [assumptions]);
  const filtered = useMemo(() => applyFilters(allListings, filters), [allListings, filters]);
  const sorted = useMemo(() => sortListings(filtered, sort), [filtered, sort]);
  const selectedListing = useMemo(
    () => allListings.find((l) => l.property.id === selectedId) ?? null,
    [allListings, selectedId]
  );

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Real Estate ROI Dashboard</h1>
          <p className="text-xs text-slate-500">
            1,000 sample listings across the US — live API disabled.
          </p>
        </div>
      </header>

      <AssumptionsPanel
        assumptions={assumptions}
        onChange={setAssumptions}
        onReset={() => setAssumptions(DEFAULT_ASSUMPTIONS)}
      />

      <div className="flex flex-1 overflow-hidden">
        <FilterPanel
          filters={filters}
          onChange={setFilters}
          onReset={() => setFilters(DEFAULT_FILTERS)}
          resultCount={sorted.length}
        />

        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center gap-1 border-b border-slate-200 bg-white px-3 py-1.5">
            <button
              onClick={() => setView("table")}
              className={`rounded px-2 py-1 text-xs font-medium ${
                view === "table" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Table
            </button>
            <button
              onClick={() => setView("map")}
              className={`rounded px-2 py-1 text-xs font-medium ${
                view === "map" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Map
            </button>
          </div>

          {view === "table" ? (
            <ResultsTable
              listings={sorted}
              sort={sort}
              onSortChange={setSort}
              onSelect={(listing) => setSelectedId(listing.property.id)}
              selectedId={selectedId}
            />
          ) : (
            <PropertyMap listings={sorted} onSelect={(listing) => setSelectedId(listing.property.id)} />
          )}
        </div>
      </div>

      <PropertyDetailDrawer
        listing={selectedListing}
        onClose={() => setSelectedId(null)}
        onFetchLiveComps={() => {}}
        fetchingLiveComps={false}
        fetchLiveCompsError={null}
      />
    </div>
  );
}
