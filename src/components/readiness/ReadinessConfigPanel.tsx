import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, ClipboardList, Plus, Trash2 } from "lucide-react";
import { useReadinessConfig } from "@/lib/readiness-store";
import type { MasterChecklistEntry } from "@/lib/readiness-config";
import type { Cost } from "@/lib/readiness-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CATEGORIES: Cost[] = ["CAPEX", "OPEX", "CAPEX + OPEX", "SOFTWARE", "APP"];
const PRIORITIES: MasterChecklistEntry["priority"][] = ["Critical", "High", "Medium", "Low"];

export function ReadinessConfigPanel() {
  const {
    sites,
    masterChecklist,
    addSite,
    removeSite,
    updateMasterItem,
    addMasterItem,
    removeMasterItem,
  } = useReadinessConfig();

  const [newSite, setNewSite] = useState("");

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
            Configuration
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">Site readiness setup</h1>
          <p className="mt-2 max-w-xl text-[13px] text-muted-foreground">
            Add depots and maintain the master checklist. Default SLA (days) applies when you add a
            new site — each open item gets a deadline automatically.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/readiness/">← Back to overview</Link>
        </Button>
      </header>

      <Tabs defaultValue="sites">
        <TabsList className="h-10">
          <TabsTrigger value="sites" className="gap-2 text-[13px]">
            <Building2 className="h-4 w-4" />
            Depots ({sites.length})
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-2 text-[13px]">
            <ClipboardList className="h-4 w-4" />
            Master checklist ({masterChecklist.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sites" className="mt-4 space-y-4">
          <div className="rounded-xl border border-border/50 bg-card/50 p-4">
            <h2 className="text-[14px] font-semibold">Add a depot</h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              New depots get every checklist row with status &quot;No&quot; and deadlines from each
              item&apos;s default SLA.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Input
                placeholder="Depot code e.g. Nagpur"
                value={newSite}
                onChange={(e) => setNewSite(e.target.value)}
                className="h-10 max-w-xs text-[14px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    addSite(newSite);
                    setNewSite("");
                  }
                }}
              />
              <Button
                className="h-10 gap-1.5"
                onClick={() => {
                  addSite(newSite);
                  setNewSite("");
                }}
              >
                <Plus className="h-4 w-4" />
                Add depot
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30 text-left text-[11px] uppercase text-muted-foreground">
                  <th className="px-4 py-2.5">Depot</th>
                  <th className="px-4 py-2.5 w-24" />
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => (
                  <tr key={site} className="border-b border-border/25">
                    <td className="px-4 py-3 font-medium">{site}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Remove depot "${site}" and all its cell data?`)) {
                            removeSite(site);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="checklist" className="mt-4 space-y-4">
          <ChecklistAddForm onAdd={addMasterItem} />
          <div className="overflow-x-auto rounded-xl border border-border/50">
            <table className="w-full min-w-[900px] text-[12px]">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30 text-left text-[10px] uppercase text-muted-foreground">
                  <th className="px-3 py-2.5 min-w-[200px]">Item</th>
                  <th className="px-2 py-2.5">Team</th>
                  <th className="px-2 py-2.5">Owner</th>
                  <th className="px-2 py-2.5">Category</th>
                  <th className="px-2 py-2.5">Priority</th>
                  <th className="px-2 py-2.5 text-center">Default SLA (days)</th>
                  <th className="px-2 py-2.5 w-12" />
                </tr>
              </thead>
              <tbody>
                {masterChecklist.map((entry) => (
                  <ChecklistRow
                    key={entry.id}
                    entry={entry}
                    onUpdate={(patch) => updateMasterItem(entry.id, patch)}
                    onRemove={() => {
                      if (confirm(`Remove "${entry.item}" from master checklist?`)) {
                        removeMasterItem(entry.id);
                      }
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChecklistRow({
  entry,
  onUpdate,
  onRemove,
}: {
  entry: MasterChecklistEntry;
  onUpdate: (patch: Partial<MasterChecklistEntry>) => void;
  onRemove: () => void;
}) {
  return (
    <tr className="border-b border-border/25 hover:bg-muted/10">
      <td className="px-3 py-2">
        <Input
          value={entry.item}
          onChange={(e) => onUpdate({ item: e.target.value })}
          className="h-8 text-[12px]"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          value={entry.team}
          onChange={(e) => onUpdate({ team: e.target.value })}
          className="h-8 min-w-[140px] text-[12px]"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          value={entry.owner}
          onChange={(e) => onUpdate({ owner: e.target.value })}
          className="h-8 min-w-[100px] text-[12px]"
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={entry.category}
          onChange={(e) => onUpdate({ category: e.target.value as Cost })}
          className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-[11px]"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <select
          value={entry.priority}
          onChange={(e) =>
            onUpdate({ priority: e.target.value as MasterChecklistEntry["priority"] })
          }
          className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-[11px]"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <Input
          type="number"
          min={0}
          placeholder="—"
          value={entry.defaultSlaDays ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onUpdate({
              defaultSlaDays: v === "" ? null : Math.max(0, parseInt(v, 10) || 0),
            });
          }}
          className="h-8 w-20 text-center text-[12px] tabular-nums"
        />
      </td>
      <td className="px-2 py-2">
        <Button variant="ghost" size="sm" className="text-destructive" onClick={onRemove}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

function ChecklistAddForm({
  onAdd,
}: {
  onAdd: (entry: Omit<MasterChecklistEntry, "id">) => void;
}) {
  const [item, setItem] = useState("");
  const [team, setTeam] = useState("ITMS - Hardware / Network");
  const [owner, setOwner] = useState("");
  const [sla, setSla] = useState("30");

  return (
    <div className="rounded-xl border border-dashed border-primary/35 bg-primary/5 p-4">
      <h2 className="text-[14px] font-semibold">Add checklist item</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          placeholder="Item name"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          className="h-9"
        />
        <Input
          placeholder="Team"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          className="h-9"
        />
        <Input
          placeholder="Owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="h-9"
        />
        <Input
          type="number"
          placeholder="SLA days"
          value={sla}
          onChange={(e) => setSla(e.target.value)}
          className="h-9"
        />
        <Button
          className="h-9 gap-1"
          onClick={() => {
            if (!item.trim()) return;
            onAdd({
              item: item.trim(),
              team: team.trim() || "—",
              owner: owner.trim() || "—",
              category: "OPEX",
              type: "Asset Infra",
              priority: "Medium",
              defaultSlaDays: sla === "" ? null : parseInt(sla, 10) || 30,
            });
            setItem("");
          }}
        >
          <Plus className="h-4 w-4" />
          Add item
        </Button>
      </div>
    </div>
  );
}
