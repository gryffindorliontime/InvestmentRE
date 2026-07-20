import { DEFAULT_FILTERS } from "./constants";
import { DEFAULT_ASSUMPTIONS } from "./roi";
import type { FinancingAssumptions, SearchFilters, SortState } from "./types";

// Dashboard state that survives refresh / can be shared as a link. Serialized
// as JSON into a single `s` query param — not pretty, but tolerant of new
// fields (missing keys fall back to defaults on parse).
export interface DashboardUrlState {
  filters: SearchFilters;
  assumptions: FinancingAssumptions;
  sort: SortState;
  view: "table" | "map";
  // Active project (see lib/projectsStore.ts) — null means the scratch/
  // no-project mode this app always had. When set, its filters/assumptions/
  // sort/view are loaded from the database instead of this URL state (see
  // page.tsx), and further changes auto-save back to the project.
  projectId: number | null;
}

export const DEFAULT_URL_STATE: DashboardUrlState = {
  filters: DEFAULT_FILTERS,
  assumptions: DEFAULT_ASSUMPTIONS,
  sort: { key: "capRatePct", direction: "desc" },
  view: "table",
  projectId: null,
};

export function serializeDashboardState(state: DashboardUrlState): string {
  // Keep the URL clean when everything is at defaults.
  if (JSON.stringify(state) === JSON.stringify(DEFAULT_URL_STATE)) return "";
  return `?s=${encodeURIComponent(JSON.stringify(state))}`;
}

export function parseDashboardState(search: string): DashboardUrlState {
  try {
    const raw = new URLSearchParams(search).get("s");
    if (!raw) return DEFAULT_URL_STATE;
    const parsed = JSON.parse(raw);
    // Deep-merge one level per section so states saved before a new
    // filter/assumption existed still load with the new field defaulted.
    return {
      filters: { ...DEFAULT_FILTERS, ...(parsed.filters ?? {}) },
      assumptions: { ...DEFAULT_ASSUMPTIONS, ...(parsed.assumptions ?? {}) },
      sort: { ...DEFAULT_URL_STATE.sort, ...(parsed.sort ?? {}) },
      view: parsed.view === "map" ? "map" : "table",
      projectId: Number.isInteger(parsed.projectId) ? parsed.projectId : null,
    };
  } catch {
    return DEFAULT_URL_STATE;
  }
}
