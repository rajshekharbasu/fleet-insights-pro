import { DEFAULT_COMPANY_ID } from "./constants";
import { generateMockTrips } from "./mock-trips";
import type { MisTripRow } from "./types";

/** GET /mis/trips?date=X&company_id=Y — mock until API is wired */
export async function fetchMisTrips(
  date: string,
  companyId: string = DEFAULT_COMPANY_ID,
): Promise<MisTripRow[]> {
  await new Promise((res) => setTimeout(res, 600));
  return generateMockTrips(date, companyId);
}

export async function fetchMisTripsRange(
  dateFrom: string,
  dateTo: string,
  companyId: string = DEFAULT_COMPANY_ID,
): Promise<MisTripRow[]> {
  const dates: string[] = [];
  const d = new Date(dateFrom);
  const end = new Date(dateTo);
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  const batches = await Promise.all(dates.map((dt) => fetchMisTrips(dt, companyId)));
  return batches.flat();
}
