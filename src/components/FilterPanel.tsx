"use client";

import { useState } from "react";
import { HOME_TYPES, LISTING_STATUSES } from "@/lib/constants";
import type { HomeType, ListingStatus, SearchFilters } from "@/lib/types";

interface FilterPanelProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  onReset: () => void;
  resultCount: number;
  availableStates: string[];
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-4 mb-2 text-sm font-semibold text-slate-800">{children}</h3>;
}

export function FilterPanel({ filters, onChange, onReset, resultCount, availableStates }: FilterPanelProps) {
  const [showMore, setShowMore] = useState(false);
  const [showInvestor, setShowInvestor] = useState(true);

  function update<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function toggleState(state: string) {
    const next = filters.states.includes(state)
      ? filters.states.filter((s) => s !== state)
      : [...filters.states, state];
    update("states", next);
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

  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Filters</h2>
        <button
          onClick={onReset}
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          Reset
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">{resultCount} matching properties</p>

      <SectionHeading>Location</SectionHeading>
      <input
        type="text"
        value={filters.location}
        onChange={(e) => update("location", e.target.value)}
        placeholder="City, zip, or metro"
        className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
      />

      <SectionHeading>State</SectionHeading>
      {filters.states.length > 0 && (
        <button
          onClick={() => update("states", [])}
          className="mb-1 text-xs font-medium text-blue-600 hover:underline"
        >
          Clear ({filters.states.length} selected)
        </button>
      )}
      <div className="grid max-h-40 grid-cols-2 gap-x-2 gap-y-1 overflow-y-auto rounded border border-slate-100 p-2">
        {availableStates.map((state) => (
          <label key={state} className="flex items-center gap-1.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.states.includes(state)}
              onChange={() => toggleState(state)}
            />
            {state}
          </label>
        ))}
      </div>

      <SectionHeading>Price range</SectionHeading>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Min"
          value={filters.price.min}
          onChange={(v) => update("price", { ...filters.price, min: v })}
          placeholder="$0"
        />
        <NumberField
          label="Max"
          value={filters.price.max}
          onChange={(v) => update("price", { ...filters.price, max: v })}
          placeholder="No max"
        />
      </div>

      <SectionHeading>Home type</SectionHeading>
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

      <SectionHeading>Beds &amp; baths</SectionHeading>
      <div className="grid grid-cols-2 gap-2">
        <NumberField label="Beds min" value={filters.bedsMin} onChange={(v) => update("bedsMin", v)} />
        <NumberField label="Baths min" value={filters.bathsMin} onChange={(v) => update("bathsMin", v)} />
      </div>

      <SectionHeading>Square footage</SectionHeading>
      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Min sqft"
          value={filters.sqft.min}
          onChange={(v) => update("sqft", { ...filters.sqft, min: v })}
        />
        <NumberField
          label="Max sqft"
          value={filters.sqft.max}
          onChange={(v) => update("sqft", { ...filters.sqft, max: v })}
        />
      </div>

      <button
        onClick={() => setShowMore((s) => !s)}
        className="mt-4 text-xs font-semibold text-blue-600 hover:underline"
      >
        {showMore ? "Hide more filters" : "Show more filters"}
      </button>

      {showMore && (
        <div className="mt-2 flex flex-col gap-3 border-t border-slate-100 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Lot sqft min"
              value={filters.lotSqft.min}
              onChange={(v) => update("lotSqft", { ...filters.lotSqft, min: v })}
            />
            <NumberField
              label="Lot sqft max"
              value={filters.lotSqft.max}
              onChange={(v) => update("lotSqft", { ...filters.lotSqft, max: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Year built min"
              value={filters.yearBuilt.min}
              onChange={(v) => update("yearBuilt", { ...filters.yearBuilt, min: v })}
            />
            <NumberField
              label="Year built max"
              value={filters.yearBuilt.max}
              onChange={(v) => update("yearBuilt", { ...filters.yearBuilt, max: v })}
            />
          </div>
          <NumberField
            label="Max days on market"
            value={filters.daysOnMarketMax}
            onChange={(v) => update("daysOnMarketMax", v)}
          />

          <div>
            <p className="mb-1 text-xs text-slate-600">Status</p>
            <div className="flex flex-col gap-1">
              {LISTING_STATUSES.map((status) => (
                <label key={status} className="flex items-center gap-2 text-sm text-slate-700">
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

          <NumberField label="Max HOA / month" value={filters.hoaMax} onChange={(v) => update("hoaMax", v)} />

          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="$/sqft min"
              value={filters.pricePerSqft.min}
              onChange={(v) => update("pricePerSqft", { ...filters.pricePerSqft, min: v })}
            />
            <NumberField
              label="$/sqft max"
              value={filters.pricePerSqft.max}
              onChange={(v) => update("pricePerSqft", { ...filters.pricePerSqft, max: v })}
            />
          </div>

          <NumberField
            label="Min parking spots"
            value={filters.parkingMin}
            onChange={(v) => update("parkingMin", v)}
          />

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.basementOnly}
              onChange={(e) => update("basementOnly", e.target.checked)}
            />
            Has basement
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Keyword (e.g. pool, ADU)
            <input
              type="text"
              value={filters.keyword}
              onChange={(e) => update("keyword", e.target.value)}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
            />
          </label>
        </div>
      )}

      <button
        onClick={() => setShowInvestor((s) => !s)}
        className="mt-4 text-xs font-semibold text-emerald-700 hover:underline"
      >
        {showInvestor ? "Hide investor filters" : "Show investor filters"}
      </button>

      {showInvestor && (
        <div className="mt-2 flex flex-col gap-3 border-t border-slate-100 pt-3">
          <NumberField
            label="Min cap rate (%)"
            value={filters.capRateMin}
            onChange={(v) => update("capRateMin", v)}
          />
          <NumberField
            label="Min cash-on-cash return (%)"
            value={filters.cashOnCashMin}
            onChange={(v) => update("cashOnCashMin", v)}
          />
          <NumberField
            label="Min monthly cash flow ($)"
            value={filters.monthlyCashFlowMin}
            onChange={(v) => update("monthlyCashFlowMin", v)}
          />
          <NumberField
            label="Min rent-to-price ratio (%)"
            value={filters.rentToPriceMin}
            onChange={(v) => update("rentToPriceMin", v)}
          />
          <NumberField
            label="Min unit count"
            value={filters.unitCountMin}
            onChange={(v) => update("unitCountMin", v)}
          />
        </div>
      )}
    </aside>
  );
}
