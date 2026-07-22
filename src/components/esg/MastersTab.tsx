import { useMemo, useState } from "react";
import { BookMarked, CircleHelp, Settings2, Timer, UserCog } from "lucide-react";
import { Input } from "@/components/ui/input";
import { GLOSSARY, TYPE_MASTER } from "@/lib/esg-data";
import { ROLES, type Role } from "@/lib/esg-policy";
import { A, PanelCard, EmptyState, useEsg } from "./primitives";
import { Segmented } from "./Segmented";
import { GhgMastersPanel } from "./GhgMastersPanel";

/**
 * Dev-only role switcher. Presents the permission model that gates policy
 * approval, monitoring entry, etc. — this is UI presentation, not enforcement.
 */
function RoleSwitcher() {
  const { role, setRole } = useEsg();
  return (
    <PanelCard>
      <div className="border-b border-border/60 px-5 py-3.5">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <UserCog className="h-4 w-4 text-primary" aria-hidden /> Acting role
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            dev
          </span>
        </h3>
        <p className="text-[12px] text-muted-foreground">
          Simulates who is signed in. Gates who may upload, submit, and approve across the module — a preview of the
          permission model, not enforcement.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-5 py-4">
        <Segmented<Role>
          ariaLabel="Acting role"
          size="md"
          value={role}
          onChange={setRole}
          options={ROLES.map((r) => ({ key: r.key, label: r.label }))}
        />
        <span className="text-[11.5px] text-muted-foreground">{ROLES.find((r) => r.key === role)?.blurb}</span>
      </div>
    </PanelCard>
  );
}

/** Masters: the configurable substrate — type lead-windows, glossary, open scope questions. */
export function MastersTab() {
  const { masters } = useEsg();
  const [q, setQ] = useState("");
  const terms = useMemo(
    () =>
      Object.entries(GLOSSARY)
        .filter(([k, v]) => (k + v.full + (v.note ?? "")).toLowerCase().includes(q.toLowerCase()))
        .sort(([a], [b]) => a.localeCompare(b)),
    [q],
  );

  return (
    <div className="space-y-4">
      <RoleSwitcher />
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <PanelCard>
          <div className="border-b border-border/60 px-5 py-3.5">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <Timer className="h-4 w-4 text-primary" aria-hidden /> Compliance type master
            </h3>
          <p className="text-[12px] text-muted-foreground">
            Renewal lead windows are per type — a fire <A t="NOC" /> and an <A t="ISO" /> certificate warrant different warning horizons. These
            windows drive every alert. Renewal-bearing licences carry a 90-day (3-month) floor; edit any window below.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[460px] text-[12.5px]">
            <thead>
              <tr className="border-b border-border/60 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                <th className="px-5 py-2.5 text-left font-medium">Type</th>
                <th className="px-3 py-2.5 text-left font-medium">Category</th>
                <th className="px-3 py-2.5 text-right font-medium">Lead window</th>
                <th className="px-5 py-2.5 text-left font-medium">Default owner</th>
              </tr>
            </thead>
            <tbody>
              {TYPE_MASTER.map((t) => {
                const days = masters.leadDaysFor(t.key);
                const perpetual = t.leadDays === 0;
                return (
                  <tr key={t.key} className="border-b border-border/40 last:border-0">
                    <td className="px-5 py-2.5 font-medium">
                      <A t={t.label.split(" ")[0]} />
                      {t.label.includes(" ") ? ` ${t.label.slice(t.label.indexOf(" ") + 1)}` : ""}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t.category === "permit" ? "Permit" : "Site"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {perpetual ? (
                        <span className="num text-muted-foreground">—</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 justify-end">
                          <Input
                            type="number"
                            min={0}
                            defaultValue={days}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isFinite(v)) masters.setLeadDays(t.key, v);
                            }}
                            className="num h-7 w-16 text-right text-[12px] font-semibold"
                            aria-label={`${t.label} lead window (days)`}
                          />
                          <span className="text-[11px] text-muted-foreground">d</span>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-[12px] text-muted-foreground">{t.ownerRole}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PanelCard>

      <div className="xl:col-span-2">
        <GhgMastersPanel />
      </div>

      <div className="space-y-4">
        <PanelCard>
          <div className="border-b border-border/60 px-5 py-3.5">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <BookMarked className="h-4 w-4 text-primary" aria-hidden /> Acronym glossary
            </h3>
            <p className="text-[12px] text-muted-foreground">
              One definition source feeds every dotted-underline popover across the module — defined once, reused everywhere.
            </p>
          </div>
          <div className="border-b border-border/40 px-5 py-3">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search terms…" className="h-9 bg-muted/40 text-[12.5px]" aria-label="Search glossary" />
          </div>
          {terms.length === 0 ? (
            <EmptyState title="No matching terms" />
          ) : (
            <div className="max-h-[360px] divide-y divide-border/30 overflow-auto">
              {terms.map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-3 px-5 py-2.5">
                  <span className="num w-[74px] shrink-0 text-[12px] font-bold text-primary">{k}</span>
                  <span>
                    <span className="text-[12.5px] font-medium">{v.full}</span>
                    {v.note && <span className="block text-[11px] leading-snug text-muted-foreground">{v.note}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </PanelCard>

        <PanelCard>
          <div className="border-b border-border/60 px-5 py-3.5">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              <CircleHelp className="h-4 w-4 text-warning" aria-hidden /> Open scope questions
            </h3>
            <p className="text-[12px] text-muted-foreground">Carried from the BRD, on the record rather than silently resolved.</p>
          </div>
          <ul className="space-y-2 px-5 py-4 text-[12.5px] leading-relaxed">
            {[
              <>Entity list & hierarchy to be confirmed — it shapes every roll-up on the dashboard.</>,
              <>
                Vendor bulk documents: keep in-module or defer to a separate <A t="DMS" />? Phase 1 captures the compliance sheet either way.
              </>,
              <>
                Asset-master integration for the adequacy assessments <A t="ESAP" /> references.
              </>,
              <>
                <A t="ISO" /> 9001 certification is in progress — third certificate joins the register on award.
              </>,
            ].map((item, i) => (
              <li key={i} className="flex gap-2.5">
                <Settings2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </PanelCard>
      </div>
      </div>
    </div>
  );
}
