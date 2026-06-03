import { MIS_SITES } from "./sites";
import type { MisTripRow, RemarkCode } from "./types";

const STAGES = ["Depot", "A", "B", "C", "D", "Closing"];
const DRIVERS = [
  { code: "DRV-101", name: "Rajesh Kumar" },
  { code: "DRV-204", name: "Suresh Patil" },
  { code: "DRV-318", name: "Amit Deshmukh" },
  { code: "DRV-422", name: "Vikram Singh" },
];
const BUSES = [
  { num: "MH-12-AB-1107", type: "12m Low Floor", vtype: "Electric" },
  { num: "MH-12-CD-1203", type: "9m Midi", vtype: "Electric" },
  { num: "MH-12-EF-1004", type: "12m Low Floor", vtype: "Electric" },
];
const ROUTES = ["RT-101", "RT-205", "RT-318", "RT-422"];
function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateMockTrips(date: string, companyId: string): MisTripRow[] {
  const rows: MisTripRow[] = [];
  const r = seededRand(date.split("-").join("").length + companyId.length);

  ROUTES.forEach((route, ri) => {
    const site = MIS_SITES[ri % MIS_SITES.length]!;
    ["Morning", "Evening"].forEach((shift, si) => {
      const scheduleCode = `${route}-${shift === "Morning" ? "AM" : "PM"}`;
      const driver = DRIVERS[(ri + si) % DRIVERS.length]!;
      const bus = BUSES[ri % BUSES.length]!;
      const tripCount = 4 + Math.floor(r() * 3);

      for (let t = 1; t <= tripCount; t++) {
        const from = STAGES[t - 1] ?? "Depot";
        const to = STAGES[t] ?? "Closing";
        const dist = +(3.5 + r() * 12).toFixed(2);
        const isLost = r() < 0.08 ? 1 : 0;
        const isShort = !isLost && r() < 0.1 ? 1 : 0;
        let remark: RemarkCode = 0;
        if (isLost) remark = ([1, 2, 3, 4, 5, 6] as RemarkCode[])[Math.floor(r() * 6)]!;

        rows.push({
          companyId,
          siteId: site.id,
          schedulingDate: date,
          scheduleCode,
          shift: shift as MisTripRow["shift"],
          vehicleType: bus.vtype,
          busType: bus.type,
          vehicleNumber: bus.num,
          startTime: `${shift === "Morning" ? "06" : "14"}:${String(t * 12).padStart(2, "0")}`,
          endTime: `${shift === "Morning" ? "07" : "15"}:${String(t * 12 + 8).padStart(2, "0")}`,
          fromStage: from,
          toStage: to,
          distanceInKM: dist,
          aDistanceInKM: dist,
          employeeCode: driver.code,
          driverName: driver.name,
          isLost: isLost as 0 | 1,
          isShort: isShort as 0 | 1,
          remark,
          reason: isLost ? "Operational delay" : isShort ? "Partial run" : "",
          tripNumber: t,
          isScheduleCodeChanged: 0,
          zone: site.zone,
          runningBoard: `RB-${route.replace("RT-", "")}`,
          route,
          service: "Regular",
        });
      }
    });
  });

  return rows;
}
