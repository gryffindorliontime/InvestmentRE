import "server-only";

import { sql } from "./db";
import type { FinancingAssumptions, Property, RentEstimate, SearchFilters, SortState } from "./types";

// Per-user projects: a project bundles its own saved search (filters) and
// settings (financing assumptions, sort, view) plus a set of bookmarked
// listings. Every query here is scoped by user_email — every function takes
// it first and filters on it, so one signed-in user can never read, edit,
// or delete another's projects/listings even if they guess an id.
//
// Saved listings store a full snapshot (property + rentEstimate) rather
// than just an id: live RentCast listings aren't re-fetchable by id later
// (the search API is location-based only), so a snapshot is what makes a
// saved listing still render after it drops out of active search results.
// ROI is recomputed from the snapshot against the *current* assumptions
// when displayed, not frozen at save time — ROI math depends on
// assumptions, which are meant to be live/adjustable.

let schemaReady: Promise<void> | null = null;

function ensureSchema(): Promise<void> {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const db = sql();
    await db`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        user_email TEXT NOT NULL,
        name TEXT NOT NULL,
        filters JSONB NOT NULL,
        assumptions JSONB NOT NULL,
        sort JSONB NOT NULL,
        view TEXT NOT NULL DEFAULT 'table',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `;
    await db`CREATE INDEX IF NOT EXISTS idx_projects_user_email ON projects(user_email)`;
    await db`
      CREATE TABLE IF NOT EXISTS saved_listings (
        id SERIAL PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        property_id TEXT NOT NULL,
        property JSONB NOT NULL,
        rent_estimate JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (project_id, property_id)
      )
    `;
    await db`CREATE INDEX IF NOT EXISTS idx_saved_listings_project ON saved_listings(project_id)`;
  })();
  return schemaReady;
}

export interface Project {
  id: number;
  name: string;
  filters: SearchFilters;
  assumptions: FinancingAssumptions;
  sort: SortState;
  view: "table" | "map";
  createdAt: string;
  updatedAt: string;
}

interface ProjectRow {
  id: number;
  name: string;
  filters: SearchFilters;
  assumptions: FinancingAssumptions;
  sort: SortState;
  view: string;
  createdAt: string;
  updatedAt: string;
}

function toProject(row: ProjectRow): Project {
  return { ...row, view: row.view === "map" ? "map" : "table" };
}

export async function listProjects(userEmail: string): Promise<Project[]> {
  await ensureSchema();
  const db = sql();
  const rows = await db`
    SELECT id, name, filters, assumptions, sort, view,
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM projects WHERE user_email = ${userEmail.toLowerCase()}
    ORDER BY updated_at DESC
  `;
  return (rows as ProjectRow[]).map(toProject);
}

export async function createProject(
  userEmail: string,
  input: { name: string; filters: SearchFilters; assumptions: FinancingAssumptions; sort: SortState; view: string }
): Promise<Project> {
  await ensureSchema();
  const db = sql();
  const rows = await db`
    INSERT INTO projects (user_email, name, filters, assumptions, sort, view)
    VALUES (${userEmail.toLowerCase()}, ${input.name}, ${JSON.stringify(input.filters)}::jsonb,
            ${JSON.stringify(input.assumptions)}::jsonb, ${JSON.stringify(input.sort)}::jsonb, ${input.view})
    RETURNING id, name, filters, assumptions, sort, view,
              created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  return toProject((rows as ProjectRow[])[0]);
}

export async function updateProject(
  userEmail: string,
  id: number,
  patch: Partial<{ name: string; filters: SearchFilters; assumptions: FinancingAssumptions; sort: SortState; view: string }>
): Promise<Project | null> {
  await ensureSchema();
  const db = sql();
  const rows = await db`
    UPDATE projects SET
      name = COALESCE(${patch.name ?? null}, name),
      filters = COALESCE(${patch.filters ? JSON.stringify(patch.filters) : null}::jsonb, filters),
      assumptions = COALESCE(${patch.assumptions ? JSON.stringify(patch.assumptions) : null}::jsonb, assumptions),
      sort = COALESCE(${patch.sort ? JSON.stringify(patch.sort) : null}::jsonb, sort),
      view = COALESCE(${patch.view ?? null}, view),
      updated_at = now()
    WHERE id = ${id} AND user_email = ${userEmail.toLowerCase()}
    RETURNING id, name, filters, assumptions, sort, view,
              created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  const row = (rows as ProjectRow[])[0];
  return row ? toProject(row) : null;
}

export async function deleteProject(userEmail: string, id: number): Promise<boolean> {
  await ensureSchema();
  const db = sql();
  const rows = await db`
    DELETE FROM projects WHERE id = ${id} AND user_email = ${userEmail.toLowerCase()} RETURNING id
  `;
  return rows.length > 0;
}

export interface SavedListingRecord {
  propertyId: string;
  property: Property;
  rentEstimate: RentEstimate;
  createdAt: string;
}

// Confirms the project belongs to this user before any saved-listings
// operation touches it — the FK alone doesn't check ownership.
async function assertOwnedProject(userEmail: string, projectId: number): Promise<boolean> {
  const db = sql();
  const rows = await db`
    SELECT id FROM projects WHERE id = ${projectId} AND user_email = ${userEmail.toLowerCase()}
  `;
  return rows.length > 0;
}

export async function listSavedListings(
  userEmail: string,
  projectId: number
): Promise<SavedListingRecord[] | null> {
  await ensureSchema();
  if (!(await assertOwnedProject(userEmail, projectId))) return null;
  const db = sql();
  const rows = await db`
    SELECT property_id AS "propertyId", property, rent_estimate AS "rentEstimate",
           created_at AS "createdAt"
    FROM saved_listings WHERE project_id = ${projectId}
    ORDER BY created_at DESC
  `;
  return rows as SavedListingRecord[];
}

export async function saveListing(
  userEmail: string,
  projectId: number,
  property: Property,
  rentEstimate: RentEstimate
): Promise<boolean> {
  await ensureSchema();
  if (!(await assertOwnedProject(userEmail, projectId))) return false;
  const db = sql();
  await db`
    INSERT INTO saved_listings (project_id, property_id, property, rent_estimate)
    VALUES (${projectId}, ${property.id}, ${JSON.stringify(property)}::jsonb, ${JSON.stringify(rentEstimate)}::jsonb)
    ON CONFLICT (project_id, property_id)
    DO UPDATE SET property = EXCLUDED.property, rent_estimate = EXCLUDED.rent_estimate
  `;
  return true;
}

export async function removeSavedListing(
  userEmail: string,
  projectId: number,
  propertyId: string
): Promise<boolean> {
  await ensureSchema();
  if (!(await assertOwnedProject(userEmail, projectId))) return false;
  const db = sql();
  const rows = await db`
    DELETE FROM saved_listings WHERE project_id = ${projectId} AND property_id = ${propertyId} RETURNING id
  `;
  return rows.length > 0;
}
