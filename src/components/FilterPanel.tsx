"use client";

import { HOME_TYPES, LISTING_STATUSES, US_STATES } from "@/lib/constants";
import type { HomeType, ListingStatus, SearchFilters } from "@/lib/types";

interface FilterPanelProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onReset: () => void;
  resultCount: number;
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  width = "w-24",
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  width?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-xs text-slate-600 ${width}`}>
      {label}
      <input
        type="number"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
      />
    </label>
  );
}

// Native <details> dropdown: no open/close state to manage. The panel is
// absolutely positioned so it overlays the results instead of pushing the
// layout around.
function Dropdown({
  label,
  badge,
  children,
  panelWidth = "w-64",
}: {
  label: string;
  badge?: number;
  children: React.ReactNode;
  panelWidth?: string;
}) {
  return (
    <details className="relative">
      <summary className="flex cursor-pointer select-none items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        {label}
        {badge !== undefined && badge > 0 && (
          <span className="rounded-full bg-blue-600 px-1.5 text-[11px] font-semibold text-white">
            {badge}
          </span>
        )}
        <span className="text-xs text-slate-400">▾</span>
      </summary>
      <div
        className={`absolute left-0 top-full z-30 mt-1 ${panelWidth} rounded border border-slate-200 bg-white p-3 shadow-lg`}
      >
        {children}
      </div>
    </details>
  );
}

export function FilterPanel({ filters, onChange, onReset, resultCount }: FilterPanelProps) {
  function update<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function toggleHomeType(type: HomeType) {
    const next = filters.homeTypes.includes(type)
      ? filters.homeTypes.filter((t) => t !== type)
      : [...filters.homeTypes, type];
    update("homeTypes", next);
  }

  function toggleStatus(status: ListingStatus) {
    const next = filters.status.includes(status)
      ? filters.status.filter((s) => s !== status)
      : [...filters.status, status];
    update("status", next);
  }

  function toggleState(state: string) {
    const next = filters.states.includes(state)
      ? filters.states.filter((s) => s !== state)
      : [...filters.states, state];
    update("states", next);
  }

  const investorActive = [
    filters.capRateMin,
    filters.cashOnCashMin,
    filters.monthlyCashFlowMin,
    filters.rentToPriceMin,
    filters.unitCountMin,
  ].filter((v) => v !== null).length;

  const moreActive =
    [
      filters.lotSqft.min,
      filters.lotSqft.max,
      filters.yearBuilt.min,
      filters.yearBuilt.max,
      filters.daysOnMarketMax,
      filters.hoaMax,
      filters.pricePerSqft.min,
      filters.pricePerSqft.max,
      filters.parkingMin,
    ].filter((v) => v !== null).length +
    (filters.basementOnly ? 1 : 0) +
    (filters.keyword.trim() ? 1 : 0) +
    filters.status.length;

  return (
    <div className="flex flex-wrap items-end gap-3 border-b border-slate-200 bg-white px-4 py-2">
      <label className="flex w-44 flex-col gap-1 text-xs text-slate-600">
        Location
        <input
          type="text"
          value={filters.location}
          onChange={(e) => update("location", e.target.value)}
          placeholder="City, zip, or metro"
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
        />
      </label>

      <NumberField
        label="Price min"
        value={filters.price.min}
        onChange={(v) => update("price", { ...filters.price, min: v })}
        placeholder="$0"
      />
      <NumberField
        label="Price max"
        value={filters.price.max}
        onChange={(v) => update("price", { ...filters.price, max: v })}
        placeholder="No max"
      />
      <NumberField label="Beds min" value={filters.bedsMin} onChange={(v) => update("bedsMin", v)} width="w-20" />
      <NumberField
        label="Baths min"
        value={filters.bathsMin}
        onChange={(v) => update("bathsMin", v)}
        width="w-20"
      />
      <NumberField
        label="Sqft min"
        value={filters.sqft.min}
        onChange={(v) => update("sqft", { ...filters.sqft, min: v })}
        width="w-20"
      />
      <NumberField
        label="Sqft max"
        value={filters.sqft.max}
        onChange={(v) => update("sqft", { ...filters.sqft, max: v })}
        width="w-20"
      />

      <Dropdown label="State" badge={filters.states.length} panelWidth="w-72">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600">States</span>
          {filters.states.length > 0 && (
            <button
              onClick={() => update("states", [])}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <div className="grid max-h-56 grid-cols-4 gap-1 overflow-y-auto">
          {US_STATES.map((state) => (
            <label key={state} className="flex items-center gap-1 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.states.includes(state)}
                onChange={() => toggleState(state)}
              />
              {state}
            </label>
          ))}
        </div>
      </Dropdown>

      <Dropdown label="Home type" badge={filters.homeTypes.length} panelWidth="w-56">
        <div className="flex flex-col gap-1">
          {HOME_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={filters.homeTypes.includes(type)}
                onChange={() => toggleHomeType(type)}
              />
              {type}
            </label>
          ))}
        </div>
      </Dropdown>

      <Dropdown label="More" badge={moreActive} panelWidth="w-80">
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Lot sqft min"
            value={filters.lotSqft.min}
            onChange={(v) => update("lotSqft", { ...filters.lotSqft, min: v })}
            width="w-full"
          />
          <NumberField
            label="Lot sqft max"
            value={filters.lotSqft.max}
            onChange={(v) => update("lotSqft", { ...filters.lotSqft, max: v })}
            width="w-full"
          />
          <NumberField
            label="Year built min"
            value={filters.yearBuilt.min}
            onChange={(v) => update("yearBuilt", { ...filters.yearBuilt, min: v })}
            width="w-full"
          />
          <NumberField
            label="Year built max"
            value={filters.yearBuilt.max}
            onChange={(v) => update("yearBuilt", { ...filters.yearBuilt, max: v })}
            width="w-full"
          />
          <NumberField
            label="Max days on market"
            value={filters.daysOnMarketMax}
            onChange={(v) => update("daysOnMarketMax", v)}
            width="w-full"
          />
          <NumberField
            label="Max HOA / month"
            value={filters.hoaMax}
            onChange={(v) => update("hoaMax", v)}
            width="w-full"
          />
          <NumberField
            label="$/sqft min"
            value={filters.pricePerSqft.min}
            onChange={(v) => update("pricePerSqft", { ...filters.pricePerSqft, min: v })}
            width="w-full"
          />
          <NumberField
            label="$/sqft max"
            value={filters.pricePerSqft.max}
            onChange={(v) => update("pricePerSqft", { ...filters.pricePerSqft, max: v })}
            width="w-full"
          />
          <NumberField
            label="Min parking spots"
            value={filters.parkingMin}
            onChange={(v) => update("parkingMin", v)}
            width="w-full"
          />
          <label className="flex items-center gap-2 self-end pb-1 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.basementOnly}
              onChange={(e) => update("basementOnly", e.target.checked)}
            />
            Has basement
          </label>
        </div>
        <div className="mt-2">
          <p className="mb-1 text-xs text-slate-600">Status</p>
          <div className="flex flex-wrap gap-2">
            {LISTING_STATUSES.map((status) => (
              <label key={status} className="flex items-center gap-1 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={filters.status.includes(status)}
                  onChange={() => toggleStatus(status)}
                />
                {status}
              </label>
            ))}
          </div>
        </div>
        <label className="mt-2 flex flex-col gap-1 text-xs text-slate-600">
          Keyword (e.g. pool, ADU)
          <input
            type="text"
            value={filters.keyword}
            onChange={(e) => update("keyword", e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
          />
        </label>
      </Dropdown>

      <Dropdown label="Investor" badge={investorActive} panelWidth="w-64">
        <div className="flex flex-col gap-2">
          <NumberField
            label="Min cap rate (%)"
            value={filters.capRateMin}
            onChange={(v) => update("capRateMin", v)}
            width="w-full"
          />
          <NumberField
            label="Min cash-on-cash return (%)"
            value={filters.cashOnCashMin}
            onChange={(v) => update("cashOnCashMin", v)}
            width="w-full"
          />
          <NumberField
            label="Min monthly cash flow ($)"
            value={filters.monthlyCashFlowMin}
            onChange={(v) => update("monthlyCashFlowMin", v)}
            width="w-full"
          />
          <NumberField
            label="Min rent-to-price ratio (%)"
            value={filters.rentToPriceMin}
            onChange={(v) => update("rentToPriceMin", v)}
            width="w-full"
          />
          <NumberField
            label="Min unit count"
            value={filters.unitCountMin}
            onChange={(v) => update("unitCountMin", v)}
            width="w-full"
          />
        </div>
      </Dropdown>

      <div className="ml-auto flex items-center gap-3 pb-1">
        <span className="text-xs text-slate-500">{resultCount} matching</span>
        <button onClick={onReset} className="text-xs font-medium text-blue-600 hover:underline">
          Reset filters
        </button>
      </div>
    </div>
  );
}
