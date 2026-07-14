import type { Property } from "./types";

// We don't have real Zillow listing IDs for mock (or RentCast) data, so this
// builds the public address-search URL Zillow supports — it resolves to the
// matching listing when one exists, or a search results page otherwise.
// (Realtor.com links were removed: their property pages require an internal
// listing id RentCast doesn't provide, so no reliable deep link exists.)

function slugify(part: string): string {
  return part
    .trim()
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function buildZillowSearchUrl(property: Property): string {
  const slug = [
    slugify(property.address),
    slugify(property.city),
    property.state,
    property.zip,
  ].join("-");
  return `https://www.zillow.com/homes/${slug}_rb/`;
}
