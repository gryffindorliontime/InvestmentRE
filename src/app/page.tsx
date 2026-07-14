"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { AssumptionsPanel } from "@/components/AssumptionsPanel";
import { CompareModal } from "@/components/CompareModal";
import { FilterPanel } from "@/components/FilterPanel";
import { LiveSearchBar } from "@/components/LiveSearchBar";
import { PropertyDetailDrawer } from "@/components/PropertyDetailDrawer";
import { ResultsTable } from "@/components/ResultsTable";
import { DEFAULT_FILTERS } from "@/lib/constants";
import { exportListingPdf } from "@/lib/pdfExport";
import { DEFAULT_ASSUMPTIONS } from "@/lib/roi";
import {
  applyFilters,
  buildEnrichedListings,
  buildEnrichedListingsFromLive,
  sortListings,
  type EnrichedListing,
} from "@/lib/searchEngine";
import { parseDashboardState, serializeDashboardState } from "@/lib/urlState";
import type {
  FinancingAssumptions,
  FloodZoneInfo,
  Property,
  PropertyTaxRecord,
  RentEstimate,
  SearchFilters,
  SortState,
} from "@/lib/types";

// Leaflet touches `window`, so the map must never render during SSR.
const PropertyMap = dynamic(() => import("@/components/PropertyMap").then((m) => m.PropertyMap), {
  ssr: false,
});

const MAX_COMPARE = 4;

type LiveEntry = { property: Property; rentEstimate: RentEstimate };

// The page opens on the 1,000-listing mock dataset; the search bar fetches
// live RentCast listings for any mix of zips / "City, ST" / "Name County, ST"
// regions (1 API call each). No API call happens until the user searches —
// deliberate, so idle visits to the deployed site don't burn RentCast quota.
export default function Home() {
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [assumptions, setAssumptions] = useState<FinancingAssumptions>(DEFAULT_ASSUMPTIONS);
  const [sort, setSort] = useState<SortState>({ key: "capRatePct", direction: "desc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "map">("table");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

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
  const [taxOverrides, setTaxOverrides] = useState<Record<string, PropertyTaxRecord>>({});
  const [fetchingTaxFor, setFetchingTaxFor] = useState<string | null>(null);
  const [fetchTaxError, setFetchTaxError] = useState<string | null>(null);
  const [floodOverrides, setFloodOverrides] = useState<Record<string, FloodZoneInfo>>({});
  const [fetchingFloodFor, setFetchingFloodFor] = useState<string | null>(null);
  const [fetchFloodError, setFetchFloodError] = useState<string | null>(null);

  // Fetch errors belong to the property they happened on — clear them when
  // the drawer switches to a different property (or closes) so they don't
  // show up under an unrelated listing.
  function selectListing(id: string | null) {
    setSelectedId(id);
    setFetchCompsError(null);
    setFetchTaxError(null);
    setFetchFloodError(null);
  }

  // --- URL persistence -------------------------------------------------------
  // Restore once on mount (in an effect rather than the initializer so the
  // server-rendered HTML and first client render match), then mirror state
  // into the URL via replaceState, debounced so typing doesn't spam history.
  const urlRestored = useRef(false);
  useEffect(() => {
    if (urlRestored.current) return;
    const restored = parseDashboardState(window.location.search);
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

  const mockListings = useMemo(
    () => buildEnrichedListings(assumptions, floodOverrides),
    [assumptions, floodOverrides]
  );
  const liveListings = useMemo(
    () =>
      buildEnrichedListingsFromLive(liveEntries, assumptions, rentOverrides, taxOverrides, floodOverrides),
    [liveEntries, assumptions, rentOverrides, taxOverrides, floodOverrides]
  );
  const allListings = dataSource === "live" ? liveListings : mockListings;

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

  // Opening a listing automatically pulls its RentCast rent estimate (AVM
  // with comps, 1 API call), county tax record (RentCast, 1 API call) and
  // FEMA flood zone (free) so the ROI runs on RentCast's rent + the real tax
  // bill, and flood warnings appear — all without extra clicks. Live
  // listings only for the RentCast lookups. The refs make each fetch
  // once-per-property, so a failed lookup doesn't retry in a loop (the
  // drawer offers a manual retry instead).
  const rentAutoFetched = useRef(new Set<string>());
  const taxAutoFetched = useRef(new Set<string>());
  const floodAutoFetched = useRef(new Set<string>());
  const selectedForAutoFetch = selectedListing;
  useEffect(() => {
    if (!selectedForAutoFetch) return;
    const { property, rentEstimate } = selectedForAutoFetch;
    if (
      property.source === "rentcast" &&
      rentEstimate.method !== "comps" &&
      !rentAutoFetched.current.has(property.id)
    ) {
      rentAutoFetched.current.add(property.id);
      handleFetchLiveComps(selectedForAutoFetch);
    }
    if (
      property.source === "rentcast" &&
      !property.taxHistory &&
      !taxAutoFetched.current.has(property.id)
    ) {
      taxAutoFetched.current.add(property.id);
      handleFetchTaxRecord(selectedForAutoFetch);
    }
    if (!property.floodZone && !floodAutoFetched.current.has(property.id)) {
      floodAutoFetched.current.add(property.id);
      handleFetchFloodZone(selectedForAutoFetch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedForAutoFetch?.property.id]);

  function toggleCompare(id: string) {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < MAX_COMPARE ? [...prev, id] : prev
    );
  }

  // Compare selections are ids into the current data source; switching
  // sources would leave them dangling, so drop them.
  function switchDataSource(source: "mock" | "live") {
    setDataSource(source);
    setSelectedId(null);
    setCompareIds([]);
    setCompareOpen(false);
  }

  // Breaks a search into one API call per region (any mix of zip codes and
  // "City, ST" — the granularity is whatever the caller types) and merges
  // the results. Regions run in parallel; a failure in one region doesn't
  // block the others, it's just reported alongside the merged results.
  async function handleLiveSearch(regions: string[], searchFilters: SearchFilters = filters) {
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
          if (searchFilters.price.min !== null) qs.set("priceMin", String(searchFilters.price.min));
          if (searchFilters.price.max !== null) qs.set("priceMax", String(searchFilters.price.max));
          if (searchFilters.homeTypes.length === 1) qs.set("homeType", searchFilters.homeTypes[0]);

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

    setRegionErrors(errors);
    // Only replace what's on screen if at least one region actually returned
    // listings. When every region errors out — or they all "succeed" with 0
    // results (e.g. a misspelled city) — keep the current results (mock or a
    // prior live search) instead of wiping them for an empty table.
    if (errors.length === regions.length && regions.length > 0) {
      setLiveError("All regions failed to search.");
    } else if (deduped.length === 0) {
      setLiveError(
        "Search returned 0 active listings. Check the spelling, or try a nearby zip or county."
      );
    } else {
      setLiveError(null);
      setLiveEntries(deduped);
      // Fetched RentCast rent estimates, tax records, and flood zones are
      // facts keyed by stable address-based ids — they persist across
      // searches so already-viewed properties don't re-spend API calls.
      switchDataSource("live");
    }
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
        unitCount: String(property.unitCount),
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

  async function handleFetchTaxRecord(listing: EnrichedListing) {
    setFetchingTaxFor(listing.property.id);
    setFetchTaxError(null);
    try {
      const { property } = listing;
      const qs = new URLSearchParams({
        address: property.address,
        city: property.city,
        state: property.state,
        zip: property.zip,
      });
      const res = await fetch(`/api/tax-record?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch tax record");

      // A null record means RentCast has no county tax data for this address
      // (coverage is regional) — store an empty record so the drawer explains
      // that instead of presenting it as a failed lookup, and so reopening
      // the listing doesn't look like the fetch never ran.
      setTaxOverrides((prev) => ({
        ...prev,
        [property.id]: data.record ?? { taxHistory: [], assessmentHistory: [] },
      }));
    } catch (err) {
      setFetchTaxError(err instanceof Error ? err.message : "Failed to fetch tax record");
    } finally {
      setFetchingTaxFor(null);
    }
  }

  async function handleFetchFloodZone(listing: EnrichedListing) {
    setFetchingFloodFor(listing.property.id);
    setFetchFloodError(null);
    try {
      const { property } = listing;
      const qs = new URLSearchParams({ lat: String(property.lat), lng: String(property.lng) });
      const res = await fetch(`/api/flood-zone?${qs.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch flood zone");
      if (!data.floodZone) throw new Error("FEMA has no flood map covering this location.");

      setFloodOverrides((prev) => ({ ...prev, [property.id]: data.floodZone }));
    } catch (err) {
      setFetchFloodError(err instanceof Error ? err.message : "Failed to fetch flood zone");
    } finally {
      setFetchingFloodFor(null);
    }
  }

  function handleExportPdf(listing: EnrichedListing) {
    // Fire-and-forget: generation is local and near-instant; surface failures
    // in the console rather than blocking the UI.
    exportListingPdf(listing, assumptions).catch((err) => console.error("PDF export failed:", err));
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Real Estate ROI Dashboard</h1>
          <p className="text-xs text-slate-500">
            {dataSource === "live"
              ? "Showing live RentCast listings. Filters & assumptions are saved in the URL."
              : "Showing sample listing data — search below to fetch live RentCast listings."}
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
        onUseMockData={() => switchDataSource("mock")}
      />

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
              onSelect={(listing) => selectListing(listing.property.id)}
              selectedId={selectedId}
              compareIds={compareIds}
              onToggleCompare={toggleCompare}
              compareLimitReached={compareIds.length >= MAX_COMPARE}
              onExportPdf={handleExportPdf}
            />
          ) : (
            <PropertyMap listings={sorted} onSelect={(listing) => selectListing(listing.property.id)} />
          )}
        </div>
      </div>

      <PropertyDetailDrawer
        listing={selectedListing}
        assumptions={assumptions}
        onClose={() => selectListing(null)}
        onFetchLiveComps={handleFetchLiveComps}
        fetchingLiveComps={fetchingCompsFor === selectedListing?.property.id}
        fetchLiveCompsError={fetchCompsError}
        onFetchTaxRecord={handleFetchTaxRecord}
        fetchingTaxRecord={fetchingTaxFor === selectedListing?.property.id}
        fetchTaxRecordError={fetchTaxError}
        onFetchFloodZone={handleFetchFloodZone}
        fetchingFloodZone={fetchingFloodFor === selectedListing?.property.id}
        fetchFloodZoneError={fetchFloodError}
        onExportPdf={handleExportPdf}
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
