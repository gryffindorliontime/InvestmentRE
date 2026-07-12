"use client";

import { useState } from "react";
import type { FinancingAssumptions } from "@/lib/types";

interface AssumptionsPanelProps {
  assumptions: FinancingAssumptions;
  onChange: (assumptions: FinancingAssumptions) => void;
  onReset: () => void;
}

// Free-typing numeric input: while focused it shows exactly what the user has
// typed (a local draft string), committing every parseable value live; on
// blur it snaps back to the canonical formatted value. Formatting the prop
// directly into a controlled input (the previous approach) rewrote the field
// on every keystroke — e.g. typing "15" became "1.00" after the first key.
function DraftNumberInput({
  displayValue,
  onCommit,
  step,
}: {
  displayValue: string;
  onCommit: (value: number) => void;
  step?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      type="number"
      step={step}
      value={draft ?? displayValue}
      onFocus={() => setDraft(displayValue)}
      onChange={(e) => {
        setDraft(e.target.value);
        const parsed = Number(e.target.value);
        if (e.target.value !== "" && Number.isFinite(parsed)) {
          onCommit(parsed);
        }
      }}
      onBlur={() => setDraft(null)}
      className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
    />
  );
}

// Trim float noise without forcing trailing zeros: 0.0675 -> "6.75", 0.2 -> "20".
function formatPct(fraction: number): string {
  return String(parseFloat((fraction * 100).toFixed(4)));
}

function PctField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      {label}
      <div className="flex items-center gap-1">
        <DraftNumberInput
          displayValue={formatPct(value)}
          onCommit={(v) => onChange(v / 100)}
          step="0.1"
        />
        <span className="text-xs text-slate-500">%</span>
      </div>
    </label>
  );
}

function DollarField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-600">
      {label}
      <DraftNumberInput displayValue={String(value)} onCommit={onChange} />
    </label>
  );
}

export function AssumptionsPanel({ assumptions, onChange, onReset }: AssumptionsPanelProps) {
  const [open, setOpen] = useState(true);

  function update<K extends keyof FinancingAssumptions>(key: K, value: FinancingAssumptions[K]) {
    onChange({ ...assumptions, [key]: value });
  }

  return (
    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-sm font-semibold text-slate-800"
        >
          Financing &amp; expense assumptions {open ? "▾" : "▸"}
        </button>
        <button onClick={onReset} className="text-xs font-medium text-blue-600 hover:underline">
          Reset to defaults
        </button>
      </div>
      {open && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <PctField
            label="Down payment"
            value={assumptions.downPaymentPct}
            onChange={(v) => update("downPaymentPct", v)}
          />
          <PctField
            label="Interest rate"
            value={assumptions.interestRatePct}
            onChange={(v) => update("interestRatePct", v)}
          />
          <DollarField
            label="Loan term (yrs)"
            value={assumptions.loanTermYears}
            onChange={(v) => update("loanTermYears", v)}
          />
          <PctField
            label="Closing costs"
            value={assumptions.closingCostsPct}
            onChange={(v) => update("closingCostsPct", v)}
          />
          <PctField
            label="Vacancy"
            value={assumptions.vacancyPct}
            onChange={(v) => update("vacancyPct", v)}
          />
          <PctField
            label="Maintenance/capex"
            value={assumptions.maintenanceCapexPct}
            onChange={(v) => update("maintenanceCapexPct", v)}
          />
          <PctField
            label="Property mgmt fee"
            value={assumptions.propertyMgmtPct}
            onChange={(v) => update("propertyMgmtPct", v)}
          />
          <DollarField
            label="Annual insurance ($)"
            value={assumptions.annualInsuranceEstimate}
            onChange={(v) => update("annualInsuranceEstimate", v)}
          />
          <PctField
            label="Rent growth / yr"
            value={assumptions.rentGrowthPct}
            onChange={(v) => update("rentGrowthPct", v)}
          />
          <PctField
            label="Selling costs"
            value={assumptions.sellingCostsPct}
            onChange={(v) => update("sellingCostsPct", v)}
          />
        </div>
      )}
    </div>
  );
}
