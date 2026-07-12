"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { AssumptionsPanel } from "@/components/AssumptionsPanel";
import { FilterPanel } from "@/components/FilterPanel";
import { LiveSearchBar } from "@/components/LiveSearchBar";
import { PropertyDetailDrawer } from "@/components/PropertyDetailDrawer";
import { ResultsTable } from "@/components/ResultsTable";
import { DEFAULT_FILTERS } from "@/lib/constants";
import { DEFAULT_ASSUMPTIONS } from "@/lib/roi";
import {
  applyFilters,
  buildEnrichedListings,
  buildEnrichedListingsFromLive,
  sortListings,
  type EnrichedListing,
} from "@/lib/searchEngine";
import type { FinancingAssumptions, Property, RentEstimate, SearchFilters, SortState } from "@/lib/types";

// Leaflet touches `window`, so the map must never render during SSR.
const PropertyMap = dynamic(() => import("@/components/PropertyMap").then((m) => m.PropertyMap), {
  ssr: false,
});

type LiveEntry = { property: Property; rentEstimate: RentEstimate };

export default function Home() {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [assumptions, setAssumptions] = useState<FinancingAssumptions>(DEFAULT_ASSUMPTIONS);
  const [sort, setSort] = useState<SortState>({ key: "capRatePct", direction: "desc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "map">("table");

  const [dataSource, setDataSource] = useState<"mock" | "live">("mock");
  const [liveEntries, setLiveEntries] = useState<LiveEntry[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveLoadingProgress, setLiveLoadingProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [liveError, setLiveError] = useState<string | null>(null);
  const [regionErrors, setRegionErrors] = useState<string[]>([]);
  const [rentOverrides, setRentOverrides] = useState<Record<string, RentEstimate>>({});
  const [fetchingCompsFor, setFetchingCompsFor] = useState<string | null>(null);
  const [fetchCompsError, setFetchCompsError] = useState<string | null>(null);

  const mockListings = useMemo(() => buildEnrichedListings(assumptions), [assumptions]);
  const liveListings = useMemo(
    () => buildEnrichedListingsFromLive(liveEntries, assumptions, rentOverrides),
    [liveEntries, assumptions, rentOverrides]
  );
  const allListings = dataSource === "live" ? liveListings : mockListings;

  const filtered = useMemo(() => applyFilters(allListings, filters), [allListings, filters]);
  const sorted = useMemo(() => sortListings(filtered, sort), [filtered, sort]);
  const selectedListing = useMemo(
    () => allListings.find((l) => l.property.id === selectedId) ?? null,
    [allListings, selectedId]
  );

  // Breaks a search into one API call per region (any mix of zip codes and
  // "City, ST" — the granularity is whatever the caller types) and merges
  // the results. Regions run in parallel; a failure in one region doesn't
  // block the others, it's just reported alongside the merged results.
  async function handleLiveSearch(regions: string[]) {
    setLiveLoading(true);
    setLiveError(null);
    setRegionErrors([]);
    setLiveLoadingProgress({ done: 0, total: regions.length });

    const collected: LiveEntry[] = [];
    const errors: string[] = [];
    let done = 0;

    await Promise.all(
      regions.map(async (region) => {
        try {
          const qs = new URLSearchParams({ location: region });
          if (filters.price.min !== null) qs.set("priceMin", String(filters.price.min));
          if (filters.price.max !== null) qs.set("priceMax", String(filters.price.max));
          if (filters.homeTypes.length === 1) qs.set("homeType", filters.homeTypes[0]);

          const res = await fetch(`/api/search?${qs.toString()}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "Search failed");

          collected.push(...data.listings);
        } catch (err) {
          errors.push(`${region} (${err instanceof Error ? err.message : "failed"})`);
        } finally {
          done += 1;
          setLiveLoadingProgress({ done, total: regions.length });
        }
      })
    );

    const deduped = Array.from(new Map(collected.map((entry) => [entry.property.id, entry])).values());

    setLiveEntries(deduped);
    setRegionErrors(errors);
    if (deduped.length === 0 && errors.length > 0) {
      setLiveError("All regions failed to search.");
    }
    setRentOverrides({});
    setDataSource("live");
    setSelectedId(null);
    setLiveLoading(false);
    setLiveLoadingProgress(null);
  }

  async function handleFetchLiveComps(listing: EnrichedListing) {
    setFetchingCompsFor(listing.property.id);
    setFetchCompsError(null);
    try {
      const { property } = listing;
      const qs = new URLSearchParams({
        address: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
        homeType: property.homeType,
        beds: String(property.beds),
        baths: String(property.baths),
        sqft: String(property.sqft),
      });
      const res = await fetch(`/api/rent-estimate?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch live comps");

      setRentOverrides((prev) => ({ ...prev, [property.id]: data.rentEstimate }));
    } catch (err) {
      setFetchCompsError(err instanceof Error ? err.message : "Failed to fetch live comps");
    } finally {
      setFetchingCompsFor(null);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Real Estate ROI Dashboard</h1>
          <p className="text-xs text-slate-500">
            {dataSource === "live"
              ? "Showing live RentCast listings."
              : "Running on mock listing data — search below to fetch live listings."}
          </p>
        </div>
      </header>

      <LiveSearchBar
        dataSource={dataSource}
        loading={liveLoading}
        loadingProgress={liveLoadingProgress}
        error={liveError}
        regionErrors={regionErrors}
        onSearch={handleLiveSearch}
        onUseMockData={() => {
          setDataSource("mock");
          setSelectedId(null);
        }}
      />

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
        onFetchLiveComps={handleFetchLiveComps}
        fetchingLiveComps={fetchingCompsFor === selectedListing?.property.id}
        fetchLiveCompsError={fetchCompsError}
      />
    </div>
  );
}
