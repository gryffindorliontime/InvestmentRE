"use client";

import { useState } from "react";
import type { FinancingAssumptions } from "@/lib/types";

interface AssumptionsPanelProps {
  assumptions: FinancingAssumptions;
  onChange: (assumptions: FinancingAssumptions) => void;
  onReset: () => void;
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
        <input
          type="number"
          step="0.1"
          value={(value * 100).toFixed(2)}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
        />
        <span className="text-xs text-slate-500">%</span>
      </div>
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
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Loan term (yrs)
            <input
              type="number"
              value={assumptions.loanTermYears}
              onChange={(e) => update("loanTermYears", Number(e.target.value))}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
            />
          </label>
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
          <label className="flex flex-col gap-1 text-xs text-slate-600">
            Annual insurance ($)
            <input
              type="number"
              value={assumptions.annualInsuranceEstimate}
              onChange={(e) => update("annualInsuranceEstimate", Number(e.target.value))}
              className="w-full rounded border border-slate-300 px-2 py-1 text-sm text-slate-900"
            />
          </label>
        </div>
      )}
    </div>
  );
}
