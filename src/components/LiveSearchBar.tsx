"use client";

import { useMemo, useState } from "react";

interface LiveSearchBarProps {
  dataSource: "mock" | "live";
  // Controls what the Search button does next, independent of dataSource
  // (which reflects what's currently on screen): true = filter the local
  // mock dataset, zero RentCast calls; false = call the live API.
  mockDataOnly: boolean;
  onToggleMockDataOnly: (value: boolean) => void;
  loading: boolean;
  loadingProgress: { done: number; total: number } | null;
  error: string | null;
  regionErrors: string[];
  onSearch: (regions: string[]) => void;
  onUseMockData: () => void;
}

// Only newlines/semicolons separate regions — commas stay reserved for the
// "City, ST" shape of an individual region, so they can't be split apart.
function parseRegions(raw: string): string[] {
  return raw
    .split(/[\n;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function LiveSearchBar({
  dataSource,
  mockDataOnly,
  onToggleMockDataOnly,
  loading,
  loadingProgress,
  error,
  regionErrors,
  onSearch,
  onUseMockData,
}: LiveSearchBarProps) {
  const [value, setValue] = useState("");
  const regions = useMemo(() => parseRegions(value), [value]);

  function submit() {
    if (regions.length > 0) onSearch(regions);
  }

  return (
    <div className="flex flex-col gap-1 border-b border-slate-200 bg-white px-4 py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onToggleMockDataOnly(!mockDataOnly)}
          title={
            mockDataOnly
              ? "Mock data only — no RentCast calls. Click to enable the live API."
              : "Live API is on — Search will call RentCast. Click to switch to mock data only."
          }
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            mockDataOnly ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {mockDataOnly ? "Mock data" : "Live · RentCast"}
        </button>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={1}
          placeholder={'One region per line (or ; separated) — zips, "City/Town, ST", or "Name County, ST" mixed freely, e.g.:\n75217\nFort Worth, TX\nCollin County, TX'}
          className="w-[28rem] resize-y rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
        />
        <button
          onClick={submit}
          disabled={loading || regions.length === 0}
          className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading
            ? loadingProgress
              ? `Searching ${loadingProgress.done}/${loadingProgress.total}…`
              : "Searching…"
            : mockDataOnly
              ? `Search ${regions.length || ""} ${regions.length === 1 ? "region" : "regions"} (mock, 0 API calls)`
              : `Search ${regions.length || ""} ${regions.length === 1 ? "region" : "regions"} (${regions.length} API call${regions.length === 1 ? "" : "s"})`}
        </button>
        {dataSource === "live" && (
          <button onClick={onUseMockData} className="text-xs font-medium text-slate-500 hover:underline">
            Back to mock data
          </button>
        )}
      </div>
      {error && <span className="text-xs text-rose-600">{error}</span>}
      {regionErrors.length > 0 && (
        <span className="text-xs text-amber-600">
          {regionErrors.length} region{regionErrors.length === 1 ? "" : "s"} failed: {regionErrors.join("; ")}
        </span>
      )}
    </div>
  );
}
