import { Bell, Eye, Globe, Megaphone, ShieldAlert, TimerReset } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { NOTIFICATIONS, PERIODS, type EsgNotification } from "@/lib/esg-data";
import { useEsg, type Audience } from "./primitives";
import { MonthWheelPicker, ScopeWheelPicker } from "./WheelPicker";
import { Segmented } from "./Segmented";

const AREAS: { key: string; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "esms", label: "ESMS" },
  { key: "projects", label: "Project Compliance" },
  { key: "reports", label: "Reports" },
  { key: "vendors", label: "Vendors" },
  { key: "masters", label: "Masters" },
];

function PeriodControl() {
  const { period, setPeriod } = useEsg();
  return <MonthWheelPicker value={period} onChange={setPeriod} options={PERIODS} />;
}

/** The audience lens — the hero control. Larger, brand-filled, unmistakable. */
function AudienceControl() {
  const { audience, setAudience } = useEsg();
  return (
    <div className="flex items-center gap-2.5">
      <Segmented<Audience>
        ariaLabel="Audience view — internal shows the complete record; external shows the curated view"
        size="lg"
        emphasis
        value={audience}
        onChange={setAudience}
        options={[
          { key: "internal", label: "Internal", Icon: Eye },
          { key: "external", label: "External", Icon: Globe },
        ]}
      />
      <span className="hidden text-[11px] font-medium leading-tight text-muted-foreground lg:block">
        {audience === "internal" ? (
          <>
            Complete record
            <br />
            nothing withheld
          </>
        ) : (
          <>
            Curated view
            <br />
            non-compliance hidden
          </>
        )}
      </span>
    </div>
  );
}

const NOTIF_ICON: Record<EsgNotification["kind"], typeof Bell> = {
  expiry: TimerReset,
  digest: Megaphone,
  escalation: ShieldAlert,
};

function NotificationsBell() {
  const { goto } = useEsg();
  const unread = NOTIFICATIONS.filter((n) => n.unread).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative grid h-8 w-8 place-items-center rounded-lg border border-border/60 bg-card/60 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          aria-label={`Notifications${unread ? ` — ${unread} unread` : ""}`}
        >
          <Bell className="h-3.5 w-3.5" aria-hidden />
          {unread > 0 && (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] rounded-xl border-border/60 p-0 shadow-elevated">
        <div className="border-b border-border/60 px-4 py-3">
          <div className="text-[13px] font-semibold tracking-tight">Notifications</div>
          <p className="text-[11px] text-muted-foreground">
            Per-item renewal alerts, escalations, and the monthly digest — deduplicated by design.
          </p>
        </div>
        <div className="max-h-[340px] overflow-auto">
          {NOTIFICATIONS.map((n) => {
            const Icon = NOTIF_ICON[n.kind];
            const clickable = !!n.recordId;
            return (
              <button
                key={n.id}
                type="button"
                disabled={!clickable}
                onClick={() => n.recordId && goto("overview", { record: n.recordId })}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border/40 px-4 py-3 text-left last:border-0",
                  clickable && "cursor-pointer transition-colors hover:bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                    n.kind === "escalation"
                      ? "bg-destructive/12 text-destructive"
                      : n.kind === "expiry"
                        ? "bg-warning/14 text-warning"
                        : "bg-primary/10 text-primary",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className={cn("block truncate text-[12.5px]", n.unread ? "font-semibold" : "font-medium")}>
                    {n.title}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">{n.detail}</span>
                  {clickable && (
                    <span className="mt-1 block text-[10.5px] font-medium text-primary">Open in work queue →</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** ESG sub-header: in-tab navigation + the always-visible scope / period / audience context. */
export function EsgHeader({ area }: { area: string }) {
  const { goto, scope, setScope } = useEsg();
  return (
    <div className="space-y-3">
      {/* Audience lens leads on the left — it changes what every screen shows. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <AudienceControl />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <ScopeWheelPicker scope={scope} onChange={setScope} />
          <PeriodControl />
          <NotificationsBell />
        </div>
      </div>

      <Segmented
        ariaLabel="ESG areas"
        size="md"
        value={area}
        onChange={goto}
        className="w-full [&>button]:flex-1"
        options={AREAS.map((a) => ({ key: a.key, label: a.label }))}
      />
    </div>
  );
}
