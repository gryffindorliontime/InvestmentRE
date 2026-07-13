"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { AssumptionsPanel } from "@/components/AssumptionsPanel";
import { CompareModal } from "@/components/CompareModal";
import { FilterPanel } from "@/components/FilterPanel";
import { PropertyDetailDrawer } from "@/components/PropertyDetailDrawer";
import { ResultsTable } from "@/components/ResultsTable";
import { DEFAULT_FILTERS } from "@/lib/constants";
import { DEFAULT_ASSUMPTIONS } from "@/lib/roi";
import { applyFilters, buildEnrichedListings, sortListings } from "@/lib/searchEngine";
import { parseDashboardState, serializeDashboardState } from "@/lib/urlState";
import type { FinancingAssumptions, SearchFilters, SortState } from "@/lib/types";

// Leaflet touches `window`, so the map must never render during SSR.
const PropertyMap = dynamic(() => import("@/components/PropertyMap").then((m) => m.PropertyMap), {
  ssr: false,
});

const MAX_COMPARE = 4;

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
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  // --- URL persistence -----------------------------------------------------
  // Restore once on mount (in an effect rather than the initializer so the
  // server-rendered HTML and first client render match), then mirror state
  // into the URL via replaceState, debounced so typing doesn't spam history.
  const urlRestored = useRef(false);
  useEffect(() => {
    // One-time hydration from the URL. Reading window.location in the
    // useState initializer instead would make the first client render differ
    // from the server-rendered HTML (hydration mismatch), so the restore has
    // to happen post-mount — a legitimate setState-in-effect.
    const restored = parseDashboardState(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilters(restored.filters);
    setAssumptions(restored.assumptions);
    setSort(restored.sort);
    setView(restored.view);
    urlRestored.current = true;
  }, []);

  useEffect(() => {
    if (!urlRestored.current) return;
    const handle = setTimeout(() => {
      const query = serializeDashboardState({ filters, assumptions, sort, view });
      window.history.replaceState(null, "", query || window.location.pathname);
    }, 300);
    return () => clearTimeout(handle);
  }, [filters, assumptions, sort, view]);
  // ---------------------------------------------------------------------------

  const allListings = useMemo(() => buildEnrichedListings(assumptions), [assumptions]);
  const filtered = useMemo(() => applyFilters(allListings, filters), [allListings, filters]);
  const sorted = useMemo(() => sortListings(filtered, sort), [filtered, sort]);
  const selectedListing = useMemo(
    () => allListings.find((l) => l.property.id === selectedId) ?? null,
    [allListings, selectedId]
  );
  const compareListings = useMemo(
    () => compareIds.map((id) => allListings.find((l) => l.property.id === id)).filter((l) => l !== undefined),
    [allListings, compareIds]
  );

  function toggleCompare(id: string) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < MAX_COMPARE ? [...prev, id] : prev
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Real Estate ROI Dashboard</h1>
          <p className="text-xs text-slate-500">
            1,000 sample listings across the US — live API disabled. Filters &amp; assumptions are
            saved in the URL.
          </p>
        </div>
      </header>

      <FilterPanel
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters(DEFAULT_FILTERS)}
        resultCount={sorted.length}
      />

      <div className="flex flex-1 overflow-hidden">
        <AssumptionsPanel
          assumptions={assumptions}
          onChange={setAssumptions}
          onReset={() => setAssumptions(DEFAULT_ASSUMPTIONS)}
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
            <div className="ml-auto flex items-center gap-2">
              {compareIds.length > 0 && (
                <button
                  onClick={() => setCompareIds([])}
                  className="text-xs font-medium text-slate-500 hover:underline"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setCompareOpen(true)}
                disabled={compareIds.length < 2}
                className="rounded bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-40"
                title={compareIds.length < 2 ? "Check 2–4 properties in the table to compare" : ""}
              >
                Compare ({compareIds.length}/{MAX_COMPARE})
              </button>
            </div>
          </div>

          {view === "table" ? (
            <ResultsTable
              listings={sorted}
              sort={sort}
              onSortChange={setSort}
              onSelect={(listing) => setSelectedId(listing.property.id)}
              selectedId={selectedId}
              compareIds={compareIds}
              onToggleCompare={toggleCompare}
              compareLimitReached={compareIds.length >= MAX_COMPARE}
            />
          ) : (
            <PropertyMap listings={sorted} onSelect={(listing) => setSelectedId(listing.property.id)} />
          )}
        </div>
      </div>

      <PropertyDetailDrawer
        listing={selectedListing}
        assumptions={assumptions}
        onClose={() => setSelectedId(null)}
        onFetchLiveComps={() => {}}
        fetchingLiveComps={false}
        fetchLiveCompsError={null}
      />

      {compareOpen && (
        <CompareModal
          listings={compareListings}
          assumptions={assumptions}
          onClose={() => setCompareOpen(false)}
          onRemove={(id) => {
            toggleCompare(id);
            if (compareIds.length <= 1) setCompareOpen(false);
          }}
        />
      )}
    </div>
  );
}
