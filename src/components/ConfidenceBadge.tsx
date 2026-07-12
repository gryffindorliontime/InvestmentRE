import type { RentEstimate } from "@/lib/types";

const CONFIDENCE_STYLES: Record<RentEstimate["confidence"], string> = {
  high: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-800",
  low: "bg-rose-100 text-rose-800",
};

const METHOD_LABELS: Record<RentEstimate["method"], string> = {
  comps: "Comps",
  building: "Building rent roll",
  "zip-baseline": "Zip baseline",
  blended: "Comps + zip blend",
};

export function ConfidenceBadge({ estimate }: { estimate: RentEstimate }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${CONFIDENCE_STYLES[estimate.confidence]}`}
      title={`${METHOD_LABELS[estimate.method]} · ${estimate.compsUsed.length} comps used`}
    >
      {METHOD_LABELS[estimate.method]} · {estimate.confidence}
    </span>
  );
}
