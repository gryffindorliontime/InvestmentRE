import { NextRequest, NextResponse } from "next/server";
import { parseLocationQuery } from "@/lib/locationParse";
import { getRentBaselineForProperty } from "@/lib/mockData";
import { estimateRent } from "@/lib/rentEstimate";
import { searchSaleListings } from "@/lib/rentcastClient";
import type { HomeType } from "@/lib/types";

// Costs exactly 1 RentCast API call regardless of result count. Rent
// estimates here are zip-baseline only (free, computed locally) — callers
// upgrade individual properties to comps-based estimates on demand via
// /api/rent-estimate, so a search never costs more than 1 call.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const location = params.get("location") ?? "";
  const parsed = parseLocationQuery(location);

  if (!parsed) {
    return NextResponse.json(
      { error: "Enter a location as a 5-digit zip code or \"City, ST\"." },
      { status: 400 }
    );
  }

  const priceMin = params.get("priceMin");
  const priceMax = params.get("priceMax");
  const homeType = params.get("homeType");

  try {
    const properties = await searchSaleListings({
      city: parsed.city,
      state: parsed.state,
      zipCode: parsed.zipCode,
      priceMin: priceMin ? Number(priceMin) : undefined,
      priceMax: priceMax ? Number(priceMax) : undefined,
      propertyType: (homeType as HomeType) || undefined,
      limit: 20,
    });

    const listings = properties.map((property) => {
      const zipBaseline = getRentBaselineForProperty(property);
      const rentEstimate = estimateRent(property, [], zipBaseline);
      return { property, rentEstimate };
    });

    return NextResponse.json({ listings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("disabled") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
