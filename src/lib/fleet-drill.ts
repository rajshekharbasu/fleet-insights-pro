/** Cross-section drill-down from risk rankings / alerts into fleet explainability panels. */

import type { AbnormalityEvent, BusOperationalHealthDaily } from "@/lib/charger-data";

export type FleetDrillTarget =
  | { type: "bus"; vehicleId: string }
  | { type: "charger"; chargerId: string };

export function fleetDrillAnchorId(target: FleetDrillTarget): string {
  return target.type === "bus" ? "bus-intel-drill" : "charger-intel-drill";
}

export function scrollToFleetDrill(target: FleetDrillTarget) {
  const id = fleetDrillAnchorId(target);
  requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export function resolveBusVehicleId(
  buses: BusOperationalHealthDaily[],
  entityId: string,
): string | null {
  const byId = buses.find((b) => b.vehicle_id === entityId);
  if (byId) return byId.vehicle_id;
  return buses.find((b) => b.vehicle_number === entityId)?.vehicle_id ?? null;
}

export function fleetDrillFromEvent(
  event: AbnormalityEvent,
  buses: BusOperationalHealthDaily[],
): FleetDrillTarget | null {
  if (event.entity_type === "bus") {
    const vehicleId = resolveBusVehicleId(buses, event.entity_id);
    return vehicleId ? { type: "bus", vehicleId } : null;
  }
  if (event.entity_type === "charger") {
    return { type: "charger", chargerId: event.entity_id };
  }
  return null;
}
