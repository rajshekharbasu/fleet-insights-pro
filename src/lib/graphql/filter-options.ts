import { GRAPHQL_API_URL } from "./config";

export interface RouteOption {
  code: string;
  name: string;
}

export interface VehicleOption {
  code: string;
  name: string;
}

export interface FilterOptions {
  companies: string[];
  drivers: string[];
  routes: RouteOption[];
  vehicles: VehicleOption[];
}

/**
 * Fetches the distinct filter dimensions (companies, drivers, routes, vehicles)
 * used to populate the shared <FilterBar /> dropdowns. Sourced from
 * trip_efficiency_fact so every page shares one canonical option set.
 */
export async function fetchFilterOptions(): Promise<FilterOptions> {
  const sql = `
    SELECT 
      DISTINCT companyname, 
      driver_name, 
      route_code, 
      route_name,
      vehiclenumber,
      bus_code
    FROM trip_efficiency_fact
  `;

  const res = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query GetFilterOptions($sql: String!) {
        sqlQuery(sql: $sql)
      }`,
      variables: { sql },
    }),
  });
  if (!res.ok) throw new Error("Failed to fetch filter options");

  const json = await res.json();
  const rows = json.data?.sqlQuery || [];

  const companies = Array.from(
    new Set(rows.map((r: any) => r.companyname).filter(Boolean)),
  ).sort() as string[];
  const drivers = Array.from(
    new Set(rows.map((r: any) => r.driver_name).filter(Boolean)),
  ).sort() as string[];
  const routes = (
    Array.from(
      new Map(
        rows
          .filter((r: any) => r.route_code)
          .map((r: any) => [r.route_code, r.route_name || r.route_code]),
      ).entries(),
    ) as [string, string][]
  )
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code));
  const vehicles = (
    Array.from(
      new Map(
        rows
          .filter((r: any) => r.vehiclenumber)
          .map((r: any) => [r.vehiclenumber, r.bus_code || r.vehiclenumber]),
      ).entries(),
    ) as [string, string][]
  )
    .map(([code, name]) => ({ code, name }))
    .sort((a, b) => a.code.localeCompare(b.code));

  return { companies, drivers, routes, vehicles };
}
