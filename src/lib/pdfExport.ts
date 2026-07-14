// One-page investment report for a listing, generated fully client-side with
// jsPDF. Both libraries are imported dynamically so they stay out of the main
// bundle until the first export.

import type { jsPDF } from "jspdf";
import { formatCurrency, formatPercent } from "./format";
import { getLocalTaxRate } from "./propertyTax";
import { buildProjection } from "./projection";
import type { EnrichedListing } from "./searchEngine";
import type { FinancingAssumptions } from "./types";

const MARGIN = 48;
const SLATE_900: [number, number, number] = [15, 23, 42];
const SLATE_500: [number, number, number] = [100, 116, 139];
const SLATE_200: [number, number, number] = [226, 232, 240];
const BLUE_600: [number, number, number] = [37, 99, 235];
const EMERALD_700: [number, number, number] = [4, 120, 87];
const ROSE_700: [number, number, number] = [190, 18, 60];

export async function exportListingPdf(
  listing: EnrichedListing,
  assumptions: FinancingAssumptions
): Promise<void> {
  const { doc, filename } = await buildListingPdf(listing, assumptions);
  doc.save(filename);
}

// Builds the report without saving, so tests (or a future server export) can
// inspect the document via doc.output(...).
export async function buildListingPdf(
  listing: EnrichedListing,
  assumptions: FinancingAssumptions
): Promise<{ doc: jsPDF; filename: string }> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const { property, rentEstimate, roi } = listing;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ---- Header ---------------------------------------------------------------
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...SLATE_900);
  doc.text(property.address, MARGIN, 64);
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(...SLATE_500);
  doc.text(
    `${property.city}, ${property.state} ${property.zip}${
      property.county ? ` · ${property.county} County` : ""
    }`,
    MARGIN,
    80
  );
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...BLUE_600);
  doc.text(formatCurrency(property.price), pageWidth - MARGIN, 64, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(...SLATE_500);
  doc.text(property.status, pageWidth - MARGIN, 80, { align: "right" });

  const meta = [
    property.homeType,
    property.beds > 0 ? `${property.beds} bd / ${property.baths} ba` : null,
    property.sqft > 0 ? `${property.sqft.toLocaleString()} sqft` : null,
    property.lotSqft > 0 ? `${property.lotSqft.toLocaleString()} sqft lot` : null,
    property.yearBuilt > 0 ? `built ${property.yearBuilt}` : null,
    property.unitCount > 1 ? `${property.unitCount} units` : null,
    `${property.daysOnMarket} days on market`,
    property.hoaMonthly > 0 ? `HOA ${formatCurrency(property.hoaMonthly)}/mo` : null,
    property.floodZone
      ? `FEMA flood zone ${property.floodZone.zone} (${property.floodZone.riskLevel.toLowerCase()} risk)`
      : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  doc.setFontSize(9).setTextColor(...SLATE_900);
  const metaLines: string[] = doc.splitTextToSize(meta, pageWidth - MARGIN * 2);
  doc.text(metaLines, MARGIN, 98);
  const metaBottom = 98 + (metaLines.length - 1) * 11;
  let headerBottom = metaBottom + 10;
  if (property.floodZone?.riskLevel === "High") {
    doc.setFontSize(8).setTextColor(...ROSE_700);
    doc.text(
      "Special Flood Hazard Area — lenders typically require flood insurance (not included in the expense estimates below).",
      MARGIN,
      metaBottom + 12
    );
    headerBottom = metaBottom + 22;
  }
  doc.setDrawColor(...SLATE_200);
  doc.line(MARGIN, headerBottom, pageWidth - MARGIN, headerBottom);

  // ---- Key/value sections ---------------------------------------------------
  let cursorY = headerBottom + 12;
  const pageHeight = doc.internal.pageSize.getHeight();

  // Section titles and the footer are drawn manually (autotable only breaks
  // pages for its own rows), so give each one a page-break check.
  const ensureRoom = (needed: number) => {
    if (cursorY + needed > pageHeight - MARGIN) {
      doc.addPage();
      cursorY = MARGIN;
    }
  };

  const kvSection = (title: string, rows: [string, string][]) => {
    ensureRoom(80);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...SLATE_900);
    doc.text(title, MARGIN, cursorY + 14);
    autoTable(doc, {
      startY: cursorY + 20,
      margin: { left: MARGIN, right: MARGIN },
      theme: "plain",
      styles: { fontSize: 9, cellPadding: { top: 3, bottom: 3, left: 0, right: 8 } },
      columnStyles: {
        0: { textColor: SLATE_500, cellWidth: 220 },
        1: { textColor: SLATE_900, fontStyle: "bold" },
      },
      body: rows,
      didDrawCell: (data) => {
        doc.setDrawColor(...SLATE_200);
        doc.line(
          data.cell.x,
          data.cell.y + data.cell.height,
          data.cell.x + data.cell.width,
          data.cell.y + data.cell.height
        );
      },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  };

  const taxRate = getLocalTaxRate(property.city, property.state);
  const taxSource = property.taxHistory?.length
    ? `county record, ${property.taxHistory[0].year}`
    : property.annualPropertyTax !== undefined
      ? "from listing"
      : `estimated at ${formatPercent(taxRate.rate * 100, 2)} (${
          taxRate.source === "city" ? property.city : taxRate.source === "state" ? property.state : "default"
        } rate)`;

  const rentRows: [string, string][] = [
    [
      "Estimated monthly rent (total)",
      `${formatCurrency(rentEstimate.monthlyRent)}/mo${
        property.unitCount > 1 ? ` (${formatCurrency(rentEstimate.perUnitMonthlyRent)}/unit)` : ""
      }`,
    ],
    [
      "Method / confidence",
      `${rentEstimate.method} · ${rentEstimate.confidence}${
        rentEstimate.compsUsed.length > 0 ? ` · ${rentEstimate.compsUsed.length} comps` : ""
      }`,
    ],
  ];
  if (rentEstimate.rentRangeLow !== undefined && rentEstimate.rentRangeHigh !== undefined) {
    rentRows.push([
      "RentCast range",
      `${formatCurrency(rentEstimate.rentRangeLow)} – ${formatCurrency(rentEstimate.rentRangeHigh)}/mo`,
    ]);
  }
  kvSection("Rent estimate", rentRows);

  const insuranceSource =
    roi.insuranceSource === "override"
      ? "assumption"
      : roi.insuranceSource === "state"
        ? `est. — ${property.state} average`
        : "est. — national average";
  kvSection("Returns", [
    ["Annual rent (gross)", formatCurrency(roi.annualRent)],
    [`Property tax (${taxSource})`, `${formatCurrency(roi.annualPropertyTax)}/yr`],
    [`Insurance (${insuranceSource})`, `${formatCurrency(roi.annualInsurance)}/yr`],
    ["Annual operating expenses", formatCurrency(roi.annualOperatingExpenses)],
    ["Net operating income (NOI)", formatCurrency(roi.noi)],
    ["Cap rate", formatPercent(roi.capRatePct)],
    ["Gross rental yield", formatPercent(roi.grossYieldPct)],
    ["Rent-to-price ratio", formatPercent(roi.rentToPricePct, 2)],
  ]);

  kvSection("Financing", [
    [
      `Down payment (${formatPercent(Math.min(1, Math.max(0, assumptions.downPaymentPct)) * 100, 0)})`,
      formatCurrency(roi.downPaymentAmount),
    ],
    ["Loan amount", formatCurrency(roi.loanAmount)],
    ["Closing costs", formatCurrency(roi.closingCosts)],
    ["Total cash invested", formatCurrency(roi.totalCashInvested)],
    [
      `Monthly payment, P&I (${formatPercent(assumptions.interestRatePct * 100, 2)}, ${assumptions.loanTermYears} yr)`,
      formatCurrency(roi.monthlyMortgagePI),
    ],
    ["Total interest over loan term", formatCurrency(roi.totalInterestOverLoanTerm)],
  ]);

  const cashFlowRows: [string, string][] = [
    ["Annual cash flow", formatCurrency(roi.annualCashFlow)],
    ["Monthly cash flow", formatCurrency(roi.monthlyCashFlow)],
    ["Cash-on-cash return", formatPercent(roi.cashOnCashPct)],
  ];
  if (roi.targetPrice !== null) {
    cashFlowRows.push([
      `Price to hit ${formatPercent(assumptions.requiredReturnPct * 100)} cash-on-cash`,
      `${formatCurrency(roi.targetPrice)}${
        property.price > 0
          ? roi.meetsRequiredReturn
            ? " (asking price meets target)"
            : ` (${formatPercent(((roi.targetPrice - property.price) / property.price) * 100, 1)} vs asking)`
          : ""
      }`,
    ]);
  }
  kvSection("Cash flow", cashFlowRows);

  // ---- 10-year projection -----------------------------------------------------
  const projection = property.homeType === "Land" ? null : buildProjection(property, roi, assumptions);
  if (projection) {
    ensureRoom(140);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...SLATE_900);
    doc.text(
      `Projection (${formatPercent(projection.appreciation.blendedPct * 100)}/yr appreciation)`,
      MARGIN,
      cursorY + 14
    );
    autoTable(doc, {
      startY: cursorY + 20,
      margin: { left: MARGIN, right: MARGIN },
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4, lineColor: SLATE_200, textColor: SLATE_900 },
      headStyles: { fillColor: [248, 250, 252], textColor: SLATE_500, fontStyle: "normal" },
      head: [["Year", "Value", "Equity", "Cash flow / yr", "Profit if sold", "IRR if sold"]],
      body: projection.years
        .filter((y) => [1, 3, 5, 10].includes(y.year))
        .map((y) => [
          String(y.year),
          formatCurrency(y.propertyValue),
          formatCurrency(y.equity),
          formatCurrency(y.annualCashFlow),
          formatCurrency(y.totalProfitIfSold),
          y.irrIfSoldPct === null ? "—" : formatPercent(y.irrIfSoldPct),
        ]),
      didParseCell: (data) => {
        // Negative money values read better in red, positive in green.
        if (data.section === "body" && data.column.index >= 3 && data.column.index <= 4) {
          const raw = String(data.cell.raw);
          data.cell.styles.textColor = raw.startsWith("-") ? ROSE_700 : EMERALD_700;
        }
      },
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // ---- County tax history (when fetched) --------------------------------------
  if (property.taxHistory?.length) {
    ensureRoom(100);
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...SLATE_900);
    doc.text("County tax records", MARGIN, cursorY + 14);
    autoTable(doc, {
      startY: cursorY + 20,
      margin: { left: MARGIN, right: MARGIN },
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 4, lineColor: SLATE_200, textColor: SLATE_900 },
      headStyles: { fillColor: [248, 250, 252], textColor: SLATE_500, fontStyle: "normal" },
      head: [["Tax year", "Total tax", "Assessed", "Land", "Improvements"]],
      body: property.taxHistory.map((t) => {
        const assessment = property.assessmentHistory?.find((a) => a.year === t.year);
        return [
          String(t.year),
          formatCurrency(t.total),
          assessment ? formatCurrency(assessment.value) : "—",
          assessment?.land !== undefined ? formatCurrency(assessment.land) : "—",
          assessment?.improvements !== undefined ? formatCurrency(assessment.improvements) : "—",
        ];
      }),
    });
    cursorY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // ---- Listing contact ----------------------------------------------------------
  const contactRows: [string, string][] = [];
  const describeContact = (c: NonNullable<typeof property.listingAgent>) =>
    [c.name, c.phone, c.email, c.website].filter(Boolean).join(" · ");
  if (property.listingAgent) contactRows.push(["Agent", describeContact(property.listingAgent)]);
  if (property.listingOffice) contactRows.push(["Brokerage", describeContact(property.listingOffice)]);
  if (contactRows.length > 0) {
    kvSection("Listing contact", contactRows);
  }

  // ---- Footer -----------------------------------------------------------------
  const assumptionsSummary =
    `Assumptions: ${formatPercent(assumptions.downPaymentPct * 100, 0)} down · ` +
    `${formatPercent(assumptions.interestRatePct * 100, 2)} / ${assumptions.loanTermYears} yr · ` +
    `closing ${formatPercent(assumptions.closingCostsPct * 100, 0)} · vacancy ${formatPercent(assumptions.vacancyPct * 100, 0)} · ` +
    `maintenance ${formatPercent(assumptions.maintenanceCapexPct * 100, 0)} · mgmt ${formatPercent(assumptions.propertyMgmtPct * 100, 0)} · ` +
    `insurance ${
      assumptions.annualInsuranceEstimate !== null
        ? `${formatCurrency(assumptions.annualInsuranceEstimate)}/yr`
        : "local estimate"
    } · required return ${formatPercent(assumptions.requiredReturnPct * 100, 1)} · ` +
    `rent growth ${formatPercent(assumptions.rentGrowthPct * 100, 0)}/yr · ` +
    `selling costs ${formatPercent(assumptions.sellingCostsPct * 100, 0)}`;
  const generated = `Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} · Real Estate ROI Dashboard${
    property.source === "rentcast" ? " · Listing data: RentCast" : " · Sample (mock) listing"
  }`;

  ensureRoom(60);
  doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...SLATE_500);
  const footerLines = doc.splitTextToSize(
    `${assumptionsSummary}\n${generated} · Estimates for research only — not financial advice.`,
    pageWidth - MARGIN * 2
  );
  doc.text(footerLines, MARGIN, cursorY + 16);

  const safeName = `${property.address}, ${property.city} ${property.state}`
    .replace(/[^a-zA-Z0-9,\- ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { doc, filename: `${safeName} - investment report.pdf` };
}
