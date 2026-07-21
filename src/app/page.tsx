"use client";

import dynamic from "next/dynamic";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AssumptionsPanel } from "@/components/AssumptionsPanel";
import { CompareModal } from "@/components/CompareModal";
import { FilterPanel } from "@/components/FilterPanel";
import { LiveSearchBar } from "@/components/LiveSearchBar";
import { PropertyDetailDrawer } from "@/components/PropertyDetailDrawer";
import { ProjectsBar } from "@/components/ProjectsBar";
import { ProjectSummary } from "@/components/ProjectSummary";
import { ResultsTable } from "@/components/ResultsTable";
import { DEFAULT_FILTERS } from "@/lib/constants";
import { exportListingPdf } from "@/lib/pdfExport";
import type { Project, SavedListingRecord } from "@/lib/projectsStore";
import { computeROI, DEFAULT_ASSUMPTIONS } from "@/lib/roi";
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
  const { data: session } = useSession();
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [assumptions, setAssumptions] = useState<FinancingAssumptions>(DEFAULT_ASSUMPTIONS);
  const [sort, setSort] = useState<SortState>({ key: "capRatePct", direction: "desc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "map">("table");
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const [dataSource, setDataSource] = useState<"mock" | "live">("mock");
  // Gates the live region-search bar (LiveSearchBar hides itself when this
  // is true, since the Location filter already covers mock narrowing for
  // free). Defaults on — no RentCast call happens until explicitly flipped
  // off.
  const [mockDataOnly, setMockDataOnly] = useState(true);
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
  const [avmProgress, setAvmProgress] = useState<{ done: number; total: number } | null>(null);
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

  // --- Projects (saved searches/settings + bookmarked listings) --------------
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [savedListings, setSavedListings] = useState<SavedListingRecord[]>([]);
  // "results" = Table/Map (governed by `view`); "saved" and "summary" are
  // project-scoped tabs, only reachable with an active project.
  const [contentTab, setContentTab] = useState<"results" | "saved" | "summary">("results");
  const savedIds = useMemo(() => new Set(savedListings.map((s) => s.propertyId)), [savedListings]);

  async function loadSavedListings(projectId: number) {
    try {
      const res = await fetch(`/api/projects/${projectId}/listings`);
      const data = await res.json();
      if (res.ok) setSavedListings(data.listings);
    } catch {
      // Leave whatever was showing; the Saved tab will just look stale.
    }
  }

  // Selecting a project loads its saved filters/assumptions/sort/view,
  // replacing whatever's currently on screen — a project's DB row is the
  // source of truth for its own content once it exists. "No project" is
  // scratch mode: works exactly like the app did before projects existed.
  function selectProject(id: number | null, projectList: Project[] = projects) {
    setActiveProjectId(id);
    setContentTab("results");
    if (id === null) {
      setSavedListings([]);
      return;
    }
    const project = projectList.find((p) => p.id === id);
    if (project) {
      setFilters(project.filters);
      setAssumptions(project.assumptions);
      setSort(project.sort);
      setView(project.view);
    }
    loadSavedListings(id);
  }

  async function handleCreateProject(name: string) {
    setProjectsError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, filters, assumptions, sort, view }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create project");
      setProjects((prev) => [data.project, ...prev]);
      selectProject(data.project.id, [data.project, ...projects]);
    } catch (err) {
      setProjectsError(err instanceof Error ? err.message : "Failed to create project");
    }
  }

  async function handleRenameProject(id: number, name: string) {
    setProjectsError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to rename project");
      setProjects((prev) => prev.map((p) => (p.id === id ? data.project : p)));
    } catch (err) {
      setProjectsError(err instanceof Error ? err.message : "Failed to rename project");
    }
  }

  async function handleDeleteProject(id: number) {
    setProjectsError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete project");
      setProjects((prev) => prev.filter((p) => p.id !== id));
      if (activeProjectId === id) selectProject(null);
    } catch (err) {
      setProjectsError(err instanceof Error ? err.message : "Failed to delete project");
    }
  }

  async function handleToggleSave(listing: EnrichedListing) {
    if (activeProjectId === null) return;
    const { property, rentEstimate } = listing;
    const alreadySaved = savedIds.has(property.id);
    try {
      if (alreadySaved) {
        const res = await fetch(
          `/api/projects/${activeProjectId}/listings/${encodeURIComponent(property.id)}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Failed to unsave listing");
        setSavedListings((prev) => prev.filter((s) => s.propertyId !== property.id));
      } else {
        const res = await fetch(`/api/projects/${activeProjectId}/listings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ property, rentEstimate }),
        });
        if (!res.ok) throw new Error("Failed to save listing");
        setSavedListings((prev) => [
          { propertyId: property.id, property, rentEstimate, createdAt: new Date().toISOString() },
          ...prev,
        ]);
      }
    } catch {
      // Quiet failure — the star just won't have toggled; no dedicated
      // error slot exists for this low-stakes an action.
    }
  }

  // Saved listings' ROI is recomputed against *current* assumptions, not
  // frozen at save time — assumptions are meant to be live/adjustable, and a
  // saved listing you're revisiting should reflect today's numbers.
  const savedEnrichedListings: EnrichedListing[] = useMemo(
    () =>
      savedListings.map((s) => ({
        property: s.property,
        rentEstimate: s.rentEstimate,
        roi: computeROI(s.property, s.rentEstimate.monthlyRent, assumptions),
      })),
    [savedListings, assumptions]
  );

  const projectsFetched = useRef(false);
  useEffect(() => {
    if (!session?.user || projectsFetched.current) return;
    projectsFetched.current = true;
    setProjectsLoading(true);
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        if (data.projects) {
          setProjects(data.projects);
          // A URL-shared link may name a project to open on load — only
          // meaningful once we know it's actually one of this user's.
          const urlProjectId = parseDashboardState(window.location.search).projectId;
          if (urlProjectId !== null && data.projects.some((p: Project) => p.id === urlProjectId)) {
            selectProject(urlProjectId, data.projects);
          }
        }
      })
      .catch(() => setProjectsError("Failed to load projects."))
      .finally(() => setProjectsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user]);

  // Keeps the active project's saved search/settings in sync with whatever's
  // on screen — mirrors the URL-persistence effect below, just against the
  // database instead of the address bar. Harmless no-op PATCH on the first
  // fire right after selecting a project (writes back what was just loaded).
  useEffect(() => {
    if (activeProjectId === null) return;
    const handle = setTimeout(() => {
      fetch(`/api/projects/${activeProjectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters, assumptions, sort, view }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.project) setProjects((prev) => prev.map((p) => (p.id === data.project.id ? data.project : p)));
        })
        .catch(() => {});
    }, 500);
    return () => clearTimeout(handle);
  }, [activeProjectId, filters, assumptions, sort, view]);
  // ---------------------------------------------------------------------------

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
      const query = serializeDashboardState({ filters, assumptions, sort, view, projectId: activeProjectId });
      window.history.replaceState(null, "", query || window.location.pathname);
    }, 300);
    return () => clearTimeout(handle);
  }, [filters, assumptions, sort, view, activeProjectId]);
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
  const selectedListing = useMemo(() => {
    const fromSearch = allListings.find((l) => l.property.id === selectedId);
    if (fromSearch) return fromSearch;
    // A saved listing may no longer be in the current search results (its
    // snapshot is what makes it viewable regardless) — fall back to that.
    const saved = savedListings.find((s) => s.propertyId === selectedId);
    if (!saved) return null;
    return {
      property: saved.property,
      rentEstimate: saved.rentEstimate,
      roi: computeROI(saved.property, saved.rentEstimate.monthlyRent, assumptions),
    };
  }, [allListings, selectedId, savedListings, assumptions]);
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
  // Only ever called in live mode — LiveSearchBar hides the textarea/button
  // entirely when mockDataOnly is on (the Location filter covers that case).
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

  // Bulk-upgrade rents to RentCast AVM estimates — 1 API call per listing,
  // so it's an explicit button with the cost on the label, capped per click,
  // top of the sort order first. Narrowing filters narrows the spend.
  const AVM_BATCH_LIMIT = 50;
  const avmCandidates = useMemo(
    () =>
      dataSource === "live"
        ? sorted.filter((l) => l.property.source === "rentcast" && l.rentEstimate.method !== "comps")
        : [],
    [dataSource, sorted]
  );

  function handleLoadAvmRents() {
    void runAvmBatch(avmCandidates);
  }

  async function runAvmBatch(entries: { property: Property; rentEstimate: RentEstimate }[]) {
    const batch = entries
      .filter(
        (e) =>
          e.property.source === "rentcast" &&
          e.rentEstimate.method !== "comps" &&
          !rentOverrides[e.property.id]
      )
      .slice(0, AVM_BATCH_LIMIT);
    if (batch.length === 0 || avmProgress) return;
    setAvmProgress({ done: 0, total: batch.length });

    let done = 0;
    const queue = [...batch];
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        for (;;) {
          const listing = queue.shift();
          if (!listing) return;
          const { property } = listing;
          try {
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
            if (res.ok) {
              rentAutoFetched.current.add(property.id);
              setRentOverrides((prev) => ({ ...prev, [property.id]: data.rentEstimate }));
            }
          } catch {
            // Leave this listing on its baseline; the drawer offers a retry.
          } finally {
            done += 1;
            setAvmProgress({ done, total: batch.length });
          }
        }
      })
    );
    setAvmProgress(null);
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

  async function handleExportPdf(listing: EnrichedListing) {
    // A report should carry RentCast's AVM rent, not the free local baseline
    // — fetch it first when this listing hasn't loaded one yet (1 API call;
    // the result is kept, so the table/drawer upgrade too and a re-export is
    // free). If the fetch fails, export with the baseline rather than block.
    let effective = listing;
    if (listing.property.source === "rentcast" && listing.rentEstimate.method !== "comps") {
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
        if (res.ok) {
          rentAutoFetched.current.add(property.id);
          setRentOverrides((prev) => ({ ...prev, [property.id]: data.rentEstimate }));
          effective = {
            property,
            rentEstimate: data.rentEstimate,
            roi: computeROI(property, data.rentEstimate.monthlyRent, assumptions),
          };
        }
      } catch {
        // Fall through with the baseline estimate.
      }
    }
    exportListingPdf(effective, assumptions).catch((err) => console.error("PDF export failed:", err));
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
        {session?.user && (
          <div className="flex items-center gap-3">
            <ProjectsBar
              projects={projects}
              activeProjectId={activeProjectId}
              onSelectProject={(id) => selectProject(id)}
              onCreateProject={handleCreateProject}
              onRenameProject={handleRenameProject}
              onDeleteProject={handleDeleteProject}
              loading={projectsLoading}
              error={projectsError}
            />
            <span className="text-xs text-slate-500">{session.user.email}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Sign out
            </button>
          </div>
        )}
      </header>

      <LiveSearchBar
        dataSource={dataSource}
        mockDataOnly={mockDataOnly}
        onToggleMockDataOnly={setMockDataOnly}
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
              onClick={() => {
                setContentTab("results");
                setView("table");
              }}
              className={`rounded px-2 py-1 text-xs font-medium ${
                contentTab === "results" && view === "table"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Table
            </button>
            <button
              onClick={() => {
                setContentTab("results");
                setView("map");
              }}
              className={`rounded px-2 py-1 text-xs font-medium ${
                contentTab === "results" && view === "map"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Map
            </button>
            {activeProjectId !== null && (
              <button
                onClick={() => setContentTab("saved")}
                className={`rounded px-2 py-1 text-xs font-medium ${
                  contentTab === "saved" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Saved ({savedListings.length})
              </button>
            )}
            {activeProjectId !== null && (
              <button
                onClick={() => setContentTab("summary")}
                className={`rounded px-2 py-1 text-xs font-medium ${
                  contentTab === "summary" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Summary
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              {avmCandidates.length > 0 && (
                <button
                  onClick={handleLoadAvmRents}
                  disabled={!!avmProgress}
                  className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  title="Replace baseline rents in the current view with RentCast AVM estimates — 1 API call per listing. Narrow your filters first to spend fewer calls."
                >
                  {avmProgress
                    ? `AVM rents ${avmProgress.done}/${avmProgress.total}…`
                    : `AVM rents for ${Math.min(avmCandidates.length, 50)}${
                        avmCandidates.length > 50 ? ` of ${avmCandidates.length}` : ""
                      } (${Math.min(avmCandidates.length, 50)} API calls)`}
                </button>
              )}
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

          {contentTab === "saved" ? (
            <ResultsTable
              listings={sortListings(savedEnrichedListings, sort)}
              sort={sort}
              onSortChange={setSort}
              onSelect={(listing) => selectListing(listing.property.id)}
              selectedId={selectedId}
              compareIds={compareIds}
              onToggleCompare={toggleCompare}
              compareLimitReached={compareIds.length >= MAX_COMPARE}
              onExportPdf={handleExportPdf}
              savedIds={savedIds}
              onToggleSave={handleToggleSave}
              canSave={activeProjectId !== null}
            />
          ) : contentTab === "summary" ? (
            <ProjectSummary
              projectName={projects.find((p) => p.id === activeProjectId)?.name ?? ""}
              listings={savedEnrichedListings}
              onSelect={(listing) => selectListing(listing.property.id)}
            />
          ) : view === "table" ? (
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
              savedIds={savedIds}
              onToggleSave={handleToggleSave}
              canSave={activeProjectId !== null}
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
        isSaved={selectedListing !== null && savedIds.has(selectedListing.property.id)}
        onToggleSave={handleToggleSave}
        canSave={activeProjectId !== null}
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
