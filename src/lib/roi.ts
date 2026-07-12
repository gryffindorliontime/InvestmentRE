import type { FinancingAssumptions, Property, ROIResult } from "./types";

export const DEFAULT_ASSUMPTIONS: FinancingAssumptions = {
  downPaymentPct: 0.2,
  interestRatePct: 0.0675,
  loanTermYears: 30,
  closingCostsPct: 0.03,
  vacancyPct: 0.05,
  maintenanceCapexPct: 0.1,
  propertyMgmtPct: 0.08,
  annualInsuranceEstimate: 1800,
  propertyTaxPct: 0.012,
};

function monthlyMortgagePayment(loanAmount: number, annualRatePct: number, termYears: number): number {
  const monthlyRate = annualRatePct / 12;
  const numPayments = termYears * 12;
  if (monthlyRate === 0) return loanAmount / numPayments;
  const factor = Math.pow(1 + monthlyRate, numPayments);
  return (loanAmount * monthlyRate * factor) / (factor - 1);
}

/**
 * Computes all investor ROI metrics for a property given an estimated monthly
 * rent and a set of financing/operating assumptions (PRD section 6.2).
 */
export function computeROI(
  property: Property,
  monthlyRent: number,
  assumptions: FinancingAssumptions = DEFAULT_ASSUMPTIONS
): ROIResult {
  const annualRent = monthlyRent * 12;

  const vacancyLoss = annualRent * assumptions.vacancyPct;
  const maintenanceCapex = annualRent * assumptions.maintenanceCapexPct;
  const propertyMgmt = annualRent * assumptions.propertyMgmtPct;
  const annualPropertyTax = property.annualPropertyTax ?? property.price * assumptions.propertyTaxPct;
  const annualOperatingExpenses =
    annualPropertyTax +
    assumptions.annualInsuranceEstimate +
    vacancyLoss +
    maintenanceCapex +
    propertyMgmt +
    property.hoaMonthly * 12;

  const noi = annualRent - annualOperatingExpenses;
  const capRatePct = property.price > 0 ? (noi / property.price) * 100 : 0;
  const grossYieldPct = property.price > 0 ? (annualRent / property.price) * 100 : 0;
  const rentToPricePct = property.price > 0 ? (monthlyRent / property.price) * 100 : 0;

  const downPaymentAmount = property.price * assumptions.downPaymentPct;
  const loanAmount = property.price - downPaymentAmount;
  const closingCosts = property.price * assumptions.closingCostsPct;
  const totalCashInvested = downPaymentAmount + closingCosts;

  const monthlyMortgagePI = monthlyMortgagePayment(
    loanAmount,
    assumptions.interestRatePct,
    assumptions.loanTermYears
  );
  const annualDebtService = monthlyMortgagePI * 12;

  const annualCashFlow = noi - annualDebtService;
  const monthlyCashFlow = annualCashFlow / 12;
  const cashOnCashPct = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;

  return {
    monthlyRent,
    annualRent,
    annualOperatingExpenses,
    noi,
    capRatePct,
    grossYieldPct,
    rentToPricePct,
    loanAmount,
    downPaymentAmount,
    closingCosts,
    totalCashInvested,
    monthlyMortgagePI,
    monthlyCashFlow,
    annualCashFlow,
    cashOnCashPct,
  };
}
