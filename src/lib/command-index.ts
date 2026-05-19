import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Gauge,
  LayoutDashboard,
  MapPin,
  Route,
  User,
  type LucideIcon,
} from "lucide-react";
import { DRIVERS, ROUTES, SEGMENTS } from "./fleet-data";

export type CommandItem = {
  id: string;
  label: string;
  keywords: string;
  href: string;
  group: "Pages" | "Routes" | "Drivers" | "Segments";
  icon: LucideIcon;
  meta?: string;
};

const PAGES: CommandItem[] = [
  { id: "page-home", label: "Trip Efficiency", keywords: "dashboard overview trips kpi", href: "/", group: "Pages", icon: LayoutDashboard },
  { id: "page-routes", label: "Route Intelligence", keywords: "routes map difficulty", href: "/routes", group: "Pages", icon: Route },
  { id: "page-segments", label: "Segment Risk", keywords: "segments dms risk map", href: "/segments", group: "Pages", icon: AlertTriangle },
  { id: "page-drivers", label: "Driver Intelligence", keywords: "drivers coaching score", href: "/drivers", group: "Pages", icon: User },
  { id: "page-fleet", label: "Fleet Command", keywords: "fleet executive command center", href: "/fleet", group: "Pages", icon: Activity },
  { id: "page-charging", label: "Charger Command Center", keywords: "charger depot bus charging health energy command war room", href: "/charging", group: "Pages", icon: BatteryCharging },
];

export function buildCommandIndex(): CommandItem[] {
  const routes: CommandItem[] = ROUTES.map((r) => ({
    id: `route-${r.route_id}`,
    label: r.route_code,
    keywords: `${r.route_code} ${r.route_name} route difficulty efficiency`.toLowerCase(),
    href: "/routes",
    group: "Routes",
    icon: MapPin,
    meta: r.route_name,
  }));

  const drivers: CommandItem[] = DRIVERS.map((d) => ({
    id: `driver-${d.driver_id}`,
    label: d.driver_name,
    keywords: `${d.driver_name} ${d.company_name} driver ${d.risk_band}`.toLowerCase(),
    href: "/drivers",
    group: "Drivers",
    icon: User,
    meta: `${d.risk_band} · ${d.contextual_score}`,
  }));

  const segments: CommandItem[] = SEGMENTS.slice(0, 40).map((s) => ({
    id: `seg-${s.segment_id}`,
    label: s.segment_id,
    keywords: `${s.segment_id} ${s.route_code} segment risk dms`.toLowerCase(),
    href: "/segments",
    group: "Segments",
    icon: Gauge,
    meta: `Risk ${s.risk_score} · ${s.route_code}`,
  }));

  return [...PAGES, ...routes, ...drivers, ...segments];
}

export const COMMAND_INDEX = buildCommandIndex();
