import { GRAPHQL_API_URL } from "./config";
import type { Trip } from "../mock-data";
import type { Filters } from "../analytics";

/**
 * Fetches trip efficiency & telemetry records from the trip_efficiency_fact SQLite table.
 */
export async function fetchDbTrips(limit = 300, filters?: Filters): Promise<Trip[]> {
  let whereClauses: string[] = [];
  if (filters) {
    if (filters.from) {
      whereClauses.push(`scheduling_date >= '${filters.from}'`);
    }
    if (filters.to) {
      whereClauses.push(`scheduling_date <= '${filters.to}'`);
    }
    if (filters.companies && filters.companies.length > 0) {
      const list = filters.companies.map(c => `'${c.replace(/'/g, "''")}'`).join(",");
      whereClauses.push(`companyname IN (${list})`);
    }
    if (filters.drivers && filters.drivers.length > 0) {
      const list = filters.drivers.map(d => `'${d.replace(/'/g, "''")}'`).join(",");
      whereClauses.push(`driver_name IN (${list})`);
    }
    if (filters.routes && filters.routes.length > 0) {
      const list = filters.routes.map(r => `'${r.replace(/'/g, "''")}'`).join(",");
      whereClauses.push(`route_code IN (${list})`);
    }
    if (filters.vehicles && filters.vehicles.length > 0) {
      const list = filters.vehicles.map(v => `'${v.replace(/'/g, "''")}'`).join(",");
      whereClauses.push(`vehiclenumber IN (${list})`);
    }
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const sql = `SELECT * FROM trip_efficiency_fact ${whereStr} ORDER BY scheduling_date DESC LIMIT ${limit}`;

  const res = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query GetDbTrips($sql: String!) {
        sqlQuery(sql: $sql)
      }`,
      variables: { sql },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch database trips: ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL query error");
  }

  const rawRows = json.data?.sqlQuery || [];
  return rawRows.map(mapDbRowToTrip);
}

/**
 * Maps SQLite row record to frontend Trip type
 */
export function mapDbRowToTrip(row: any): Trip {
  const gross = Number(row.gross_discharge_kwh) || 0;
  const net = Number(row.net_kwh_consumed) || 0;
  const idle = Number(row.idle_kwh_estimated) || 0;
  const aDischarge = Number(row.a_discharge_kwh) || 0;
  const bDischarge = Number(row.b_discharge_kwh) || 0;

  // Event timestamp is usually based on trip start time
  const eventTs = row.trip_start_time || new Date().toISOString();

  return {
    trip_id: row.trip_id ? `T-${row.trip_id}` : (row.schedule_id ? `S-${row.schedule_id}` : `T-gen-${Math.round(Math.random() * 100000)}`),
    schedule_id: row.schedule_id ? `S-${row.schedule_id}` : "",
    scheduling_date: row.scheduling_date ? row.scheduling_date.slice(0, 10) : "",
    vehiclenumber: row.vehiclenumber || "",
    registration_number: row.registration_number || "",
    route_id: row.route_id ? String(row.route_id) : "",
    route_name: row.route_name || "",
    route_code: row.route_code || "",
    driver_id: row.driver_id ? String(row.driver_id) : "",
    driver_name: row.driver_name || "",
    company_id: row.companyid ? String(row.companyid) : "",
    company_name: row.companyname || "",
    trip_start_time: row.trip_start_time || "",
    trip_end_time: row.trip_end_time || "",
    battery_pack_state_of_charge_start: Number(row.start_soc) || 0,
    battery_pack_state_of_charge_end: Number(row.end_soc) || 0,
    regen_kwh: Number(row.regen_kwh) || 0,
    gross_discharge_kwh: gross,
    net_signed_energy_kwh: net,
    avg_power_kw: Number(row.avg_power_kw) || 0,
    peak_regen_kw: Number(row.peak_regen_kw) || 0,
    peak_discharge_kw: Number(row.peak_discharge_kw) || 0,
    avg_a_voltage_v: Number(row.avg_a_voltage_v) || 0,
    avg_b_voltage_v: Number(row.avg_b_voltage_v) || 0,
    max_cell_temp: Number(row.max_cell_temp) || 0,
    avg_cell_temp: Number(row.avg_cell_temp) || 0,
    trip_distance_km: Number(row.distance_km_odo_trip) || 0,
    net_kwh_consumed: net,
    regen_ratio: Number(row.regen_ratio) || 0,
    kwh_per_km: Number(row.kwh_per_km) || 0,
    soc_drop_per_km: Number(row.soc_drop_per_km) || 0,
    a_kwh_share: gross > 0 ? parseFloat((aDischarge / gross).toFixed(3)) : 0.5,
    b_kwh_share: gross > 0 ? parseFloat((bDischarge / gross).toFixed(3)) : 0.5,
    pack_balance_delta: Number(row.pack_balance_delta) || 0,
    high_temp_flag: Boolean(row.high_temp_flag),
    voltage_instability_flag: Boolean(row.voltage_instability_flag),
    pack_imbalance_flag: Boolean(row.pack_imbalance_flag),
    efficiency_anomaly_flag: Boolean(row.efficiency_anomaly_flag),
    idle_time_sec: Math.round((Number(row.idle_duration_min) || 0) * 60),
    idle_energy_kwh: idle,
    idle_energy_share_pct: net > 0 ? parseFloat(((idle / net) * 100).toFixed(2)) : 0,
    event_ts: eventTs,
  };
}

export async function fetchDbTripStats(filters: Filters): Promise<{ totalTrips: number; totalDistance: number }> {
  let whereClauses: string[] = [];
  if (filters) {
    if (filters.from) {
      whereClauses.push(`scheduling_date >= '${filters.from}'`);
    }
    if (filters.to) {
      whereClauses.push(`scheduling_date <= '${filters.to}'`);
    }
    if (filters.companies && filters.companies.length > 0) {
      const list = filters.companies.map(c => `'${c.replace(/'/g, "''")}'`).join(",");
      whereClauses.push(`companyname IN (${list})`);
    }
    if (filters.drivers && filters.drivers.length > 0) {
      const list = filters.drivers.map(d => `'${d.replace(/'/g, "''")}'`).join(",");
      whereClauses.push(`driver_name IN (${list})`);
    }
    if (filters.routes && filters.routes.length > 0) {
      const list = filters.routes.map(r => `'${r.replace(/'/g, "''")}'`).join(",");
      whereClauses.push(`route_code IN (${list})`);
    }
    if (filters.vehicles && filters.vehicles.length > 0) {
      const list = filters.vehicles.map(v => `'${v.replace(/'/g, "''")}'`).join(",");
      whereClauses.push(`vehiclenumber IN (${list})`);
    }
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
  const sql = `SELECT COUNT(*) as total_trips, SUM(distance_km_odo_trip) as total_distance FROM trip_efficiency_fact ${whereStr}`;

  const res = await fetch(GRAPHQL_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `query GetStats($sql: String!) {
        sqlQuery(sql: $sql)
      }`,
      variables: { sql },
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch database stats: ${res.statusText}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(json.errors[0]?.message || "GraphQL query error");
  }

  const rows = json.data?.sqlQuery || [];
  if (rows.length > 0) {
    return {
      totalTrips: Number(rows[0].total_trips) || 0,
      totalDistance: Number(rows[0].total_distance) || 0,
    };
  }

  return { totalTrips: 0, totalDistance: 0 };
}
