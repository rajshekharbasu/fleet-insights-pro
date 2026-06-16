// Mock data shaped to match `trip_efficiency` gold table.
// Replace with API/Redshift queries — interfaces stay stable.

export interface Trip {
  trip_id: string;
  schedule_id: string;
  scheduling_date: string;
  vehiclenumber: string;
  registration_number: string;
  route_id: string;
  route_name: string;
  route_code: string;
  driver_id: string;
  driver_name: string;
  company_id: string;
  company_name: string;
  trip_start_time: string;
  trip_end_time: string;
  battery_pack_state_of_charge_start: number;
  battery_pack_state_of_charge_end: number;
  regen_kwh: number;
  gross_discharge_kwh: number;
  net_signed_energy_kwh: number;
  avg_power_kw: number;
  peak_regen_kw: number;
  peak_discharge_kw: number;
  avg_a_voltage_v: number;
  avg_b_voltage_v: number;
  max_cell_temp: number;
  avg_cell_temp: number;
  trip_distance_km: number;
  net_kwh_consumed: number;
  regen_ratio: number;
  kwh_per_km: number;
  soc_drop_per_km: number;
  a_kwh_share: number;
  b_kwh_share: number;
  pack_balance_delta: number;
  high_temp_flag: boolean;
  voltage_instability_flag: boolean;
  pack_imbalance_flag: boolean;
  efficiency_anomaly_flag: boolean;
  idle_time_sec: number;
  idle_energy_kwh: number;
  idle_energy_share_pct: number;
  event_ts: string;
}

const COMPANIES = [
  { id: "co_01", name: "Apex Logistics" },
  { id: "co_02", name: "Northwind Transit" },
  { id: "co_03", name: "Helix Mobility" },
  { id: "co_04", name: "Vector Freight" },
];

const DRIVERS = [
  "Anaya Sharma", "Marco Bellini", "Lin Wei", "Sofia Becker", "Ravi Patel",
  "Jonas Müller", "Aiko Tanaka", "Diego Alvarez", "Priya Iyer", "Lukas Novak",
  "Elena Rossi", "Hiro Sato", "Noor Khan", "Mateo Silva", "Kenji Yamada",
  "Aisha Karim", "Tomás Reyes", "Yara Haddad",
];

const ROUTES = [
  { code: "R-101", name: "Harbor → Midtown Loop" },
  { code: "R-204", name: "Northgate Express" },
  { code: "R-309", name: "Industrial Belt" },
  { code: "R-417", name: "Airport Shuttle" },
  { code: "R-522", name: "Cross-City Trunk" },
  { code: "R-630", name: "Riverside Corridor" },
  { code: "R-744", name: "Tech Park Circular" },
];

// Deterministic seeded RNG so the dashboard renders the same on every load.
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function gauss(mean: number, std: number): number {
  const u = 1 - rand();
  const v = rand();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function generateTrips(count = 720): Trip[] {
  const trips: Trip[] = [];
  const now = new Date("2026-05-13T12:00:00Z").getTime();
  const sixMonths = 1000 * 60 * 60 * 24 * 180;

  for (let i = 0; i < count; i++) {
    const company = pick(COMPANIES);
    const driverName = pick(DRIVERS);
    const route = pick(ROUTES);
    const tsMs = now - rand() * sixMonths;
    const ts = new Date(tsMs);

    const distance = Math.max(4, gauss(38, 18));
    const baseKwhPerKm = gauss(1.15, 0.18);
    const kwh_per_km = Math.max(0.55, baseKwhPerKm);
    const grossDischarge = kwh_per_km * distance;
    const regen = grossDischarge * Math.max(0.05, Math.min(0.42, gauss(0.22, 0.08)));
    const net = grossDischarge - regen;

    const socStart = Math.min(100, Math.max(60, gauss(88, 8)));
    const socEnd = Math.max(10, socStart - (net / 220) * 100);
    const socDelta = socStart - socEnd;
    const socDropPerKm = socDelta / distance;

    const idleSec = Math.max(0, gauss(380, 220));
    const idleKwh = (idleSec / 3600) * gauss(2.4, 0.6);
    const idleShare = Math.min(0.32, idleKwh / Math.max(net, 0.1));

    const aShare = Math.min(0.62, Math.max(0.38, gauss(0.5, 0.05)));
    const maxTemp = gauss(38, 6);
    const avgTemp = maxTemp - Math.abs(gauss(4, 2));
    const avgVoltA = gauss(620, 12);
    const avgVoltB = avgVoltA + gauss(0, 8);

    const high_temp_flag = maxTemp > 48;
    const voltage_instability_flag = Math.abs(avgVoltA - avgVoltB) > 18;
    const pack_imbalance_flag = Math.abs(aShare - 0.5) > 0.1;
    const efficiency_anomaly_flag = kwh_per_km > 1.55 || socDropPerKm > 1.2;

    const id = String(100000 + i);
    const driverId = "drv_" + driverName.split(" ").map((p) => p[0]).join("").toLowerCase() + "_" + (i % 7);

    trips.push({
      trip_id: "T-" + id,
      schedule_id: "S-" + id,
      scheduling_date: ts.toISOString().slice(0, 10),
      vehiclenumber: "EV-" + (1000 + (i % 60)),
      registration_number: "KA" + (10 + (i % 40)) + "EV" + (1000 + i),
      route_id: route.code,
      route_name: route.name,
      route_code: route.code,
      driver_id: driverId,
      driver_name: driverName,
      company_id: company.id,
      company_name: company.name,
      trip_start_time: ts.toISOString(),
      trip_end_time: new Date(tsMs + Math.max(900, distance * 120 * 1000)).toISOString(),
      battery_pack_state_of_charge_start: +socStart.toFixed(1),
      battery_pack_state_of_charge_end: +socEnd.toFixed(1),
      regen_kwh: +regen.toFixed(2),
      gross_discharge_kwh: +grossDischarge.toFixed(2),
      net_signed_energy_kwh: +net.toFixed(2),
      avg_power_kw: +Math.max(8, gauss(38, 12)).toFixed(1),
      peak_regen_kw: +Math.max(20, gauss(110, 30)).toFixed(1),
      peak_discharge_kw: +Math.max(40, gauss(180, 40)).toFixed(1),
      avg_a_voltage_v: +avgVoltA.toFixed(1),
      avg_b_voltage_v: +avgVoltB.toFixed(1),
      max_cell_temp: +maxTemp.toFixed(1),
      avg_cell_temp: +avgTemp.toFixed(1),
      trip_distance_km: +distance.toFixed(2),
      net_kwh_consumed: +net.toFixed(2),
      regen_ratio: +(regen / grossDischarge).toFixed(3),
      kwh_per_km: +kwh_per_km.toFixed(3),
      soc_drop_per_km: +socDropPerKm.toFixed(3),
      a_kwh_share: +aShare.toFixed(3),
      b_kwh_share: +(1 - aShare).toFixed(3),
      pack_balance_delta: +(aShare - 0.5).toFixed(3),
      high_temp_flag,
      voltage_instability_flag,
      pack_imbalance_flag,
      efficiency_anomaly_flag,
      idle_time_sec: Math.round(idleSec),
      idle_energy_kwh: +idleKwh.toFixed(2),
      idle_energy_share_pct: +(idleShare * 100).toFixed(2),
      event_ts: ts.toISOString(),
    });
  }
  return trips.sort((a, b) => a.event_ts.localeCompare(b.event_ts));
}

export const TRIPS: Trip[] = generateTrips();

export const FILTER_OPTIONS = {
  companies: COMPANIES,
  drivers: Array.from(new Set(TRIPS.map((t) => t.driver_name))).sort(),
  routes: ROUTES,
  vehicles: Array.from(
    new Map(
      TRIPS.map((t) => [t.vehiclenumber, t.registration_number || t.vehiclenumber])
    ).entries()
  ).map(([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code)),
};
