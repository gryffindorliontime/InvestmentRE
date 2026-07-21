"use client";

import { ConfidenceBadge } from "./ConfidenceBadge";
import { buildZillowSearchUrl } from "@/lib/externalLinks";
import { formatCurrency, formatPercent } from "@/lib/format";
import { buildProjection } from "@/lib/projection";
import { getLocalTaxRate } from "@/lib/propertyTax";
import type { EnrichedListing } from "@/lib/searchEngine";
import type { FinancingAssumptions, Property } from "@/lib/types";

interface PropertyDetailDrawerProps {
  listing: EnrichedListing | null;
  assumptions: FinancingAssumptions;
  onClose: () => void;
  onFetchLiveComps: (listing: EnrichedListing) => void;
  fetchingLiveComps: boolean;
  fetchLiveCompsError: string | null;
  onFetchTaxRecord: (listing: EnrichedListing) => void;
  fetchingTaxRecord: boolean;
  fetchTaxRecordError: string | null;
  onFetchFloodZone: (listing: EnrichedListing) => void;
  fetchingFloodZone: boolean;
  fetchFloodZoneError: string | null;
  onExportPdf: (listing: EnrichedListing) => void;
  isSaved: boolean;
  onToggleSave: (listing: EnrichedListing) => void;
  canSave: boolean;
}

const FLOOD_RISK_BADGE: Record<string, string> = {
  High: "bg-rose-100 text-rose-800",
  Moderate: "bg-amber-100 text-amber-800",
  Minimal: "bg-emerald-100 text-emerald-800",
  Undetermined: "bg-slate-200 text-slate-700",
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

// "9723337715" → "(972) 333-7715"; anything unexpected passes through as-is.
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function ContactBlock({ title, contact }: { title: string; contact: NonNullable<Property["listingAgent"]> }) {
  return (
    <div className="mt-2 rounded bg-slate-50 p-2 text-sm">
      <p className="text-xs font-medium text-slate-500">{title}</p>
      {contact.name && <p className="font-medium text-slate-900">{contact.name}</p>}
      <div className="flex flex-wrap gap-x-3 text-xs">
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className="text-blue-600 hover:underline">
            {formatPhone(contact.phone)}
          </a>
        )}
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
            {contact.email}
          </a>
        )}
        {contact.website && (
          <a
            href={contact.website.startsWith("http") ? contact.website : `https://${contact.website}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {contact.website.replace(/^https?:\/\//, "")}
          </a>
        )}
      </div>
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
  onFetchTaxRecord,
  fetchingTaxRecord,
  fetchTaxRecordError,
  onFetchFloodZone,
  fetchingFloodZone,
  fetchFloodZoneError,
  onExportPdf,
  isSaved,
  onToggleSave,
  canSave,
}: PropertyDetailDrawerProps) {
  if (!listing) return null;
  const { property, rentEstimate, roi } = listing;
  const canUpgradeToLiveComps = property.source === "rentcast" && rentEstimate.method !== "comps";
  const canFetchTaxRecord = property.source === "rentcast" && !property.taxHistory;
  const projection = property.homeType === "Land" ? null : buildProjection(property, roi, assumptions);
  const projectionRows = projection
    ? projection.years.filter((y) => [1, 3, 5, 10].includes(y.year))
    : [];
  const taxRate = getLocalTaxRate(property.city, property.state);

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
          <button
            onClick={() => onExportPdf(listing)}
            className="font-medium text-blue-600 hover:underline"
            title="Download an investment report PDF for this listing"
          >
            Export PDF ⤓
          </button>
          <button
            onClick={() => onToggleSave(listing)}
            disabled={!canSave}
            className={
              isSaved
                ? "font-medium text-amber-600 hover:underline disabled:opacity-40"
                : "font-medium text-blue-600 hover:underline disabled:opacity-40"
            }
            title={canSave ? "Save to the active project" : "Select or create a project to save listings"}
          >
            {isSaved ? "★ Saved" : "☆ Save"}
          </button>
        </div>

        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-800">Property</h3>
          <Row label="Home type" value={property.homeType} />
          {property.county && <Row label="County" value={`${property.county} County`} />}
          <Row label="Beds / baths" value={`${property.beds} / ${property.baths}`} />
          <Row label="Square footage" value={property.sqft ? `${property.sqft.toLocaleString()} sqft` : "—"} />
          <Row label="Lot size" value={property.lotSqft ? `${property.lotSqft.toLocaleString()} sqft` : "—"} />
          <Row label="Year built" value={property.yearBuilt ? String(property.yearBuilt) : "—"} />
          <Row label="Units" value={String(property.unitCount)} />
          <Row label="Days on market" value={`${property.daysOnMarket}d`} />
          <Row label="HOA" value={property.hoaMonthly ? `${formatCurrency(property.hoaMonthly)}/mo` : "None"} />
          {property.floodZone ? (
            <div className="border-b border-slate-100 py-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Flood zone (FEMA)</span>
                <span className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">Zone {property.floodZone.zone}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      FLOOD_RISK_BADGE[property.floodZone.riskLevel] ?? FLOOD_RISK_BADGE.Undetermined
                    }`}
                  >
                    {property.floodZone.riskLevel} risk
                  </span>
                </span>
              </div>
              {property.floodZone.subtype && (
                <p className="mt-0.5 text-right text-xs text-slate-400">{property.floodZone.subtype}</p>
              )}
              {property.floodZone.riskLevel === "High" && (
                <p className="mt-0.5 text-right text-xs text-rose-600">
                  Special Flood Hazard Area — lenders typically require flood insurance.
                </p>
              )}
            </div>
          ) : fetchingFloodZone ? (
            <p className="py-1.5 text-xs text-slate-400">Checking FEMA flood maps…</p>
          ) : (
            <div className="flex items-center justify-between py-1.5 text-xs">
              <span className="text-rose-600">{fetchFloodZoneError ?? "Flood zone not loaded."}</span>
              <button
                onClick={() => onFetchFloodZone(listing)}
                className="font-medium text-blue-600 hover:underline"
              >
                Retry FEMA lookup
              </button>
            </div>
          )}
        </section>

        {(property.listingAgent || property.listingOffice) && (
          <section className="mt-4">
            <h3 className="text-sm font-semibold text-slate-800">Listing contact</h3>
            {property.listingAgent && <ContactBlock title="Agent" contact={property.listingAgent} />}
            {property.listingOffice && <ContactBlock title="Brokerage" contact={property.listingOffice} />}
          </section>
        )}

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
          {rentEstimate.rentRangeLow !== undefined && rentEstimate.rentRangeHigh !== undefined && (
            <p className="text-xs text-slate-500">
              RentCast range: {formatCurrency(rentEstimate.rentRangeLow)}–
              {formatCurrency(rentEstimate.rentRangeHigh)}/mo
            </p>
          )}
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
                {fetchingLiveComps
                  ? "Fetching RentCast rent estimate…"
                  : "Get RentCast rent estimate (1 API call)"}
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
          <Row
            label={`Property tax (${
              property.taxHistory?.length
                ? `county record, ${property.taxHistory[0].year}`
                : property.annualPropertyTax !== undefined
                  ? "from listing"
                  : `est. — ${taxRate.source === "city" ? property.city : taxRate.source === "state" ? property.state : "default"} rate ${formatPercent(taxRate.rate * 100, 2)}`
            })`}
            value={`${formatCurrency(roi.annualPropertyTax)}/yr`}
          />
          <Row
            label={`Insurance (${
              roi.insuranceSource === "override"
                ? "your assumption"
                : roi.insuranceSource === "state"
                  ? `est. — ${property.state} average`
                  : "est. — national average"
            })`}
            value={`${formatCurrency(roi.annualInsurance)}/yr`}
          />
          <Row label="Annual operating expenses" value={formatCurrency(roi.annualOperatingExpenses)} />
          <Row label="Net operating income (NOI)" value={formatCurrency(roi.noi)} />
          <Row label="Cap rate" value={formatPercent(roi.capRatePct)} />
          <Row label="Gross rental yield" value={formatPercent(roi.grossYieldPct)} />
          <Row label="Rent-to-price ratio" value={formatPercent(roi.rentToPricePct, 2)} />
        </section>

        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-800">County tax records</h3>
          {canFetchTaxRecord &&
            (fetchingTaxRecord ? (
              <p className="mt-1 text-xs text-slate-400">Fetching county tax record…</p>
            ) : (
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-rose-600">{fetchTaxRecordError ?? "Tax record not loaded."}</span>
                <button
                  onClick={() => onFetchTaxRecord(listing)}
                  className="font-medium text-blue-600 hover:underline"
                >
                  Retry (1 API call)
                </button>
              </div>
            ))}
          {property.taxHistory?.length === 0 && (
            <p className="mt-1 text-xs text-slate-400">
              {(property.assessmentHistory?.length ?? 0) > 0
                ? "Assessed values are on file but no tax totals — the ROI uses the local-rate estimate."
                : "RentCast has no county tax data for this address (coverage varies by county) — the ROI uses the local-rate estimate."}
            </p>
          )}
          {property.taxHistory && property.taxHistory.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-xs font-medium text-slate-600">Property taxes by year</p>
              <div className="max-h-40 overflow-y-auto rounded border border-slate-100">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1 text-left">Tax year</th>
                      <th className="px-2 py-1 text-right">Total tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {property.taxHistory.map((t) => (
                      <tr key={t.year} className="border-t border-slate-100">
                        <td className="px-2 py-1">{t.year}</td>
                        <td className="px-2 py-1 text-right">{formatCurrency(t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {property.assessmentHistory && property.assessmentHistory.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-xs font-medium text-slate-600">Assessed values by year</p>
              <div className="max-h-40 overflow-y-auto rounded border border-slate-100">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-2 py-1 text-left">Year</th>
                      <th className="px-2 py-1 text-right">Assessed</th>
                      <th className="px-2 py-1 text-right">Land</th>
                      <th className="px-2 py-1 text-right">Improvements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {property.assessmentHistory.map((a) => (
                      <tr key={a.year} className="border-t border-slate-100">
                        <td className="px-2 py-1">{a.year}</td>
                        <td className="px-2 py-1 text-right">{formatCurrency(a.value)}</td>
                        <td className="px-2 py-1 text-right">{a.land !== undefined ? formatCurrency(a.land) : "—"}</td>
                        <td className="px-2 py-1 text-right">
                          {a.improvements !== undefined ? formatCurrency(a.improvements) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {!canFetchTaxRecord && !property.taxHistory && (
            <p className="mt-1 text-xs text-slate-400">
              County records are available for live RentCast listings only.
            </p>
          )}
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

        <section className="mt-4">
          <h3 className="text-sm font-semibold text-slate-800">
            Required return ({formatPercent(assumptions.requiredReturnPct * 100)} cash-on-cash)
          </h3>
          {roi.targetPrice === null ? (
            <p className="mt-1 text-xs text-slate-400">
              No purchase price reaches the target — the estimated rent doesn&apos;t cover the
              price-independent costs (insurance, HOA, vacancy/maintenance/management).
            </p>
          ) : (
            <>
              <Row label="Price to hit target" value={formatCurrency(roi.targetPrice)} />
              {property.price > 0 && (
                <Row
                  label={roi.meetsRequiredReturn ? "Asking price meets target" : "Needed vs asking"}
                  value={
                    roi.meetsRequiredReturn
                      ? `✓ (${formatCurrency(roi.targetPrice - property.price)} of headroom)`
                      : `${formatPercent(((roi.targetPrice - property.price) / property.price) * 100, 1)}`
                  }
                />
              )}
            </>
          )}
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
