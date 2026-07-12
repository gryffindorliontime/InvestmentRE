"use client";

import { ConfidenceBadge } from "./ConfidenceBadge";
import { buildRealtorSearchUrl, buildZillowSearchUrl } from "@/lib/externalLinks";
import { formatCurrency, formatPercent } from "@/lib/format";
import { buildProjection } from "@/lib/projection";
import type { EnrichedListing } from "@/lib/searchEngine";
import type { FinancingAssumptions } from "@/lib/types";

interface PropertyDetailDrawerProps {
  listing: EnrichedListing | null;
  assumptions: FinancingAssumptions;
  onClose: () => void;
  onFetchLiveComps: (listing: EnrichedListing) => void;
  fetchingLiveComps: boolean;
  fetchLiveCompsError: string | null;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

export function PropertyDetailDrawer({
  listing,
  assumptions,
  onClose,
  onFetchLiveComps,
  fetchingLiveComps,
  fetchLiveCompsError,
}: PropertyDetailDrawerProps) {
  if (!listing) return null;
  const { property, rentEstimate, roi } = listing;
  const canUpgradeToLiveComps = property.source === "rentcast" && rentEstimate.method !== "comps";
  const projection = property.homeType === "Land" ? null : buildProjection(property, roi, assumptions);
  const projectionRows = projection
    ? projection.years.filter((y) => [1, 3, 5, 10].includes(y.year))
    : [];

  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{property.address}</h2>
            <p className="text-sm text-slate-500">
              {property.city}, {property.state} {property.zip}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <p className="mt-2 text-2xl font-bold text-slate-900">{formatCurrency(property.price)}</p>

        <div className="mt-2 flex gap-3 text-sm">
          <a
            href={buildZillowSearchUrl(property)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 hover:underline"
          >
            View on Zillow ↗
          </a>
          <a
            href={buildRealtorSearchUrl(property)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-blue-600 hover:underline"
          >
            View on Realtor.com ↗
          </a>
        </div>

        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-800">Property</h3>
          <Row label="Home type" value={property.homeType} />
          <Row label="Beds / baths" value={`${property.beds} / ${property.baths}`} />
          <Row label="Square footage" value={property.sqft ? `${property.sqft.toLocaleString()} sqft` : "—"} />
          <Row label="Lot size" value={property.lotSqft ? `${property.lotSqft.toLocaleString()} sqft` : "—"} />
          <Row label="Year built" value={property.yearBuilt ? String(property.yearBuilt) : "—"} />
          <Row label="Units" value={String(property.unitCount)} />
          <Row label="Days on market" value={`${property.daysOnMarket}d`} />
          <Row label="HOA" value={property.hoaMonthly ? `${formatCurrency(property.hoaMonthly)}/mo` : "None"} />
        </section>

        <section className="mt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Rent estimate</h3>
            <ConfidenceBadge estimate={rentEstimate} />
          </div>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {formatCurrency(rentEstimate.monthlyRent)}/mo{" "}
            <span className="text-sm font-normal text-slate-500">
              {property.unitCount > 1 ? `total across ${property.unitCount} units` : "total"}
            </span>
          </p>
          {property.unitCount > 1 && (
            <Row label="Avg rent per unit" value={`${formatCurrency(rentEstimate.perUnitMonthlyRent)}/mo`} />
          )}
          <Row label="Comps weight" value={formatPercent(rentEstimate.compsWeight * 100, 0)} />
          <Row label="Building weight" value={formatPercent(rentEstimate.buildingWeight * 100, 0)} />
          <Row label="Zip baseline weight" value={formatPercent(rentEstimate.zipBaselineWeight * 100, 0)} />
          <Row label="Zip baseline rent" value={`${formatCurrency(rentEstimate.zipBaselineMonthlyRent)}/mo`} />

          {canUpgradeToLiveComps && (
            <div className="mt-2">
              <button
                onClick={() => onFetchLiveComps(listing)}
                disabled={fetchingLiveComps}
                className="w-full rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {fetchingLiveComps ? "Fetching live comps…" : "Get live rent comps (1 API call)"}
              </button>
              {fetchLiveCompsError && (
                <p className="mt-1 text-xs text-rose-600">{fetchLiveCompsError}</p>
              )}
            </div>
          )}

          {rentEstimate.compsUsed.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-xs font-medium text-slate-600">
                {rentEstimate.compsUsed.length} rental comps used
              </p>
              <div className="max-h-40 overflow-y-auto rounded border border-slate-100">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1 text-left">Address</th>
                      <th className="px-2 py-1 text-right">Dist.</th>
                      <th className="px-2 py-1 text-right">Rent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rentEstimate.compsUsed.map((comp) => (
                      <tr key={comp.id} className="border-t border-slate-100">
                        <td className="px-2 py-1">{comp.address}</td>
                        <td className="px-2 py-1 text-right">{comp.distanceMiles} mi</td>
                        <td className="px-2 py-1 text-right">{formatCurrency(comp.monthlyRent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {property.buildingRentRoll && (
            <div className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600">
              Building: <span className="font-medium">{property.buildingRentRoll.buildingName}</span> —{" "}
              {property.buildingRentRoll.unitRents.length} unit rents on file
            </div>
          )}
        </section>

        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-800">ROI breakdown</h3>
          <Row label="Annual rent (gross)" value={formatCurrency(roi.annualRent)} />
          <Row label="Annual operating expenses" value={formatCurrency(roi.annualOperatingExpenses)} />
          <Row label="Net operating income (NOI)" value={formatCurrency(roi.noi)} />
          <Row label="Cap rate" value={formatPercent(roi.capRatePct)} />
          <Row label="Gross rental yield" value={formatPercent(roi.grossYieldPct)} />
          <Row label="Rent-to-price ratio" value={formatPercent(roi.rentToPricePct, 2)} />
        </section>

        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-800">Financing</h3>
          <Row label="Down payment" value={formatCurrency(roi.downPaymentAmount)} />
          <Row label="Loan amount" value={formatCurrency(roi.loanAmount)} />
          <Row label="Loan-to-value" value={formatPercent(roi.loanToValuePct)} />
          <Row label="Closing costs" value={formatCurrency(roi.closingCosts)} />
          <Row label="Total cash invested" value={formatCurrency(roi.totalCashInvested)} />
        </section>

        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-800">Mortgage payment</h3>
          <Row label="Monthly payment (P&I)" value={formatCurrency(roi.monthlyMortgagePI)} />
          <Row label="— of which interest (1st mo.)" value={formatCurrency(roi.firstMonthInterest)} />
          <Row label="— of which principal (1st mo.)" value={formatCurrency(roi.firstMonthPrincipal)} />
          <Row label="Total interest over loan term" value={formatCurrency(roi.totalInterestOverLoanTerm)} />
        </section>

        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-800">Rent profit (cash flow)</h3>
          <Row label="Net operating income (NOI)" value={formatCurrency(roi.noi)} />
          <Row label="− Mortgage payment (annual)" value={formatCurrency(roi.monthlyMortgagePI * 12)} />
          <Row label="= Annual cash flow" value={formatCurrency(roi.annualCashFlow)} />
          <Row label="= Monthly cash flow" value={formatCurrency(roi.monthlyCashFlow)} />
          <Row label="Cash-on-cash return" value={formatPercent(roi.cashOnCashPct)} />
        </section>

        {projection && (
          <section className="mt-4">
            <h3 className="text-sm font-semibold text-slate-800">10-year projection</h3>
            <Row
              label={`Appreciation — ${property.state} regional`}
              value={formatPercent(projection.appreciation.regionalPct * 100)}
            />
            <Row
              label={`Appreciation — ${property.homeType}`}
              value={formatPercent(projection.appreciation.homeTypePct * 100)}
            />
            <Row
              label="Blended rate (70% region / 30% style)"
              value={`${formatPercent(projection.appreciation.blendedPct * 100)}/yr`}
            />
            <div className="mt-2 overflow-x-auto rounded border border-slate-100">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-2 py-1 text-left">Year</th>
                    <th className="px-2 py-1 text-right">Value</th>
                    <th className="px-2 py-1 text-right">Equity</th>
                    <th className="px-2 py-1 text-right">Cash flow/yr</th>
                    <th className="px-2 py-1 text-right">Profit if sold</th>
                    <th className="px-2 py-1 text-right">IRR if sold</th>
                  </tr>
                </thead>
                <tbody>
                  {projectionRows.map((y) => (
                    <tr key={y.year} className="border-t border-slate-100">
                      <td className="px-2 py-1">{y.year}</td>
                      <td className="px-2 py-1 text-right">{formatCurrency(y.propertyValue)}</td>
                      <td className="px-2 py-1 text-right">{formatCurrency(y.equity)}</td>
                      <td
                        className={`px-2 py-1 text-right ${y.annualCashFlow >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                      >
                        {formatCurrency(y.annualCashFlow)}
                      </td>
                      <td
                        className={`px-2 py-1 text-right ${y.totalProfitIfSold >= 0 ? "text-emerald-700" : "text-rose-700"}`}
                      >
                        {formatCurrency(y.totalProfitIfSold)}
                      </td>
                      <td className="px-2 py-1 text-right font-medium">
                        {y.irrIfSoldPct === null ? "—" : formatPercent(y.irrIfSoldPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              NOI grown at {formatPercent(assumptions.rentGrowthPct * 100)}/yr; sale nets out{" "}
              {formatPercent(assumptions.sellingCostsPct * 100)} selling costs and the remaining loan
              balance. Demo appreciation assumptions — not a forecast.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
