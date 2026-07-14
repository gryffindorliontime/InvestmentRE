import { NextRequest, NextResponse } from "next/server";
import { getZipBaselineRent, perUnitBeds } from "@/lib/mockData";
import { getRentEstimate } from "@/lib/rentcastClient";
import type { HomeType } from "@/lib/types";

// Costs exactly 1 RentCast API call. Called on demand (e.g. when a user opens
// a property's detail view) rather than for every row in a search result, to
// keep quota usage proportional to what the user actually looks at.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const address = params.get("address");
  const city = params.get("city");
  const state = params.get("state");
  const zip = params.get("zip");
  const homeType = params.get("homeType") as HomeType | null;
  const beds = params.get("beds");
  const baths = params.get("baths");
  const sqft = params.get("sqft");
  const unitCount = params.get("unitCount");

  if (!address || !city || !state || !zip) {
    return NextResponse.json({ error: "address, city, state, and zip are required" }, { status: 400 });
  }

  try {
    const bedsNum = beds ? Number(beds) : 0;
    const unitCountNum = unitCount ? Number(unitCount) : 1;
    const zipBaseline = getZipBaselineRent(
      zip,
      perUnitBeds({ beds: bedsNum, unitCount: unitCountNum }),
      city,
      state
    );
    const rentEstimate = await getRentEstimate(
      {
        address: `${address}, ${city}, ${state} ${zip}`,
        propertyType: homeType ?? undefined,
        bedrooms: beds ? Number(beds) : undefined,
        bathrooms: baths ? Number(baths) : undefined,
        squareFootage: sqft ? Number(sqft) : undefined,
        unitCount: unitCount ? Number(unitCount) : undefined,
      },
      zipBaseline
    );

    return NextResponse.json({ rentEstimate });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("disabled") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
