import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Building2, ClipboardList, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  useSites, 
  useChecklistItems, 
  useCreateChecklistItem, 
  useUpdateChecklistItem, 
  useDeleteChecklistItem 
} from "@/lib/readiness/queries";

const CATEGORIES = ["CAPEX", "OPEX", "CAPEX + OPEX", "SOFTWARE", "APP"];
const PRIORITIES = ["Critical", "High", "Medium", "Low"];

export function ReadinessConfigPanel() {
  const { data: sitesData, isLoading: loadingSites } = useSites();
  const { data: checklistData, isLoading: loadingChecklist } = useChecklistItems();
  
  const [siteFilter, setSiteFilter] = useState<"all" | "active" | "inactive">("all");
  const [sitesSearch, setSitesSearch] = useState("");
  const [checklistSearch, setChecklistSearch] = useState("");

  const sites = sitesData || [];
  const masterChecklist = checklistData?.items || [];

  const filteredSites = sites.filter((site) => {
    if (siteFilter === "active" && !site.is_active) return false;
    if (siteFilter === "inactive" && site.is_active) return false;
    if (sitesSearch && !`${site.name} ${site.code} ${site.site_type} ${site.location}`.toLowerCase().includes(sitesSearch.toLowerCase())) return false;
    return true;
  });

  const filteredChecklist = masterChecklist.filter((item) => {
    if (checklistSearch && !`${item.name} ${item.team} ${item.default_owner} ${item.category}`.toLowerCase().includes(checklistSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
            Configuration
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">Site readiness setup</h1>
          <p className="mt-2 max-w-xl text-[13px] text-muted-foreground">
            View active sites and maintain the master checklist. Default SLA (days) applies when you onboard a
            new site via the Master module — each open item gets a deadline automatically.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/readiness">← Back to overview</Link>
        </Button>
      </header>

      <Tabs defaultValue="sites">
        <TabsList className="h-10">
          <TabsTrigger value="sites" className="gap-2 text-[13px]">
            <Building2 className="h-4 w-4" />
            Sites ({sites.length})
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-2 text-[13px]">
            <ClipboardList className="h-4 w-4" />
            Master checklist ({masterChecklist.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sites" className="mt-4 space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/50 p-4">
            <div>
              <h2 className="text-[14px] font-semibold">Tracked Sites</h2>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Sites are managed in the Onboarding module. The list below shows all sites currently tracked.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Input
                placeholder="Search sites..."
                value={sitesSearch}
                onChange={(e) => setSitesSearch(e.target.value)}
                className="h-8 w-64 bg-background text-[12px]"
              />
              <select
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value as any)}
                className="h-8 rounded-md border border-border/60 bg-background px-2 text-[12px] text-foreground"
              >
                <option value="all">All Sites</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-border/50 overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30 text-left text-[11px] uppercase text-muted-foreground">
                  <th className="px-4 py-2.5">Site Name</th>
                  <th className="px-4 py-2.5">Site Code</th>
                  <th className="px-4 py-2.5">Site Type</th>
                  <th className="px-4 py-2.5">Location</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {loadingSites ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin opacity-50" />
                    </td>
                  </tr>
                ) : filteredSites.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      No sites match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredSites.map((site) => (
                    <tr key={site.id} className="border-b border-border/25">
                      <td className="px-4 py-3 font-medium">{site.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{site.code}</td>
                      <td className="px-4 py-3 text-muted-foreground">{site.site_type || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{site.location || "—"}</td>
                      <td className="px-4 py-3">
                        {site.is_active ? (
                          <span className="inline-flex items-center rounded-md bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success ring-1 ring-inset ring-success/20">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-destructive/15 px-2 py-0.5 text-[10px] font-medium text-destructive ring-1 ring-inset ring-destructive/20">
                            Inactive
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="checklist" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[14px] font-semibold">Checklist Items</h2>
            <Input
              placeholder="Search items, teams, owners..."
              value={checklistSearch}
              onChange={(e) => setChecklistSearch(e.target.value)}
              className="h-8 w-64 bg-background text-[12px]"
            />
          </div>
          <ChecklistAddForm />
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
                {loadingChecklist ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin opacity-50" />
                    </td>
                  </tr>
                ) : filteredChecklist.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No checklist items match the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredChecklist.map((entry) => (
                    <ChecklistRow key={entry.id} entry={entry} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChecklistRow({ entry }: { entry: any }) {
  const { mutate: updateItem } = useUpdateChecklistItem();
  const { mutate: deleteItem, isPending: isDeleting } = useDeleteChecklistItem();

  const handleUpdate = (patch: any) => {
    updateItem({ id: entry.id, data: patch }, {
      onError: (err) => toast.error(err.message)
    });
  };

  const handleRemove = () => {
    if (confirm(`Remove "${entry.name}" from master checklist?`)) {
      deleteItem(entry.id, {
        onSuccess: () => toast.success("Item removed"),
        onError: (err) => toast.error(err.message)
      });
    }
  };

  return (
    <tr className="border-b border-border/25 hover:bg-muted/10">
      <td className="px-3 py-2">
        <Input
          defaultValue={entry.name}
          onBlur={(e) => {
            if (e.target.value !== entry.name) handleUpdate({ name: e.target.value });
          }}
          className="h-8 text-[12px]"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          defaultValue={entry.team}
          onBlur={(e) => {
            if (e.target.value !== entry.team) handleUpdate({ team: e.target.value });
          }}
          className="h-8 min-w-[140px] text-[12px]"
        />
      </td>
      <td className="px-2 py-2">
        <Input
          defaultValue={entry.default_owner}
          onBlur={(e) => {
            if (e.target.value !== entry.default_owner) handleUpdate({ default_owner: e.target.value });
          }}
          className="h-8 min-w-[100px] text-[12px]"
        />
      </td>
      <td className="px-2 py-2">
        <select
          value={entry.category}
          onChange={(e) => handleUpdate({ category: e.target.value })}
          className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-[11px]"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <select
          value={entry.priority}
          onChange={(e) => handleUpdate({ priority: e.target.value })}
          className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-[11px]"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-2">
        <Input
          type="number"
          min={0}
          placeholder="—"
          defaultValue={entry.default_sla_days ?? ""}
          onBlur={(e) => {
            const v = e.target.value;
            const num = v === "" ? null : Math.max(0, parseInt(v, 10) || 0);
            if (num !== entry.default_sla_days) handleUpdate({ default_sla_days: num });
          }}
          className="h-8 w-20 text-center text-[12px] tabular-nums"
        />
      </td>
      <td className="px-2 py-2">
        <Button variant="ghost" size="sm" className="text-destructive" onClick={handleRemove} disabled={isDeleting}>
          {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </td>
    </tr>
  );
}

function ChecklistAddForm() {
  const [item, setItem] = useState("");
  const [team, setTeam] = useState("");
  const [owner, setOwner] = useState("");
  const [sla, setSla] = useState("30");
  const [category, setCategory] = useState("OPEX");
  const [priority, setPriority] = useState("Medium");

  const { mutate: createItem, isPending } = useCreateChecklistItem();

  const handleAdd = () => {
    if (!item.trim()) return;
    createItem({
      name: item.trim(),
      team: team.trim() || "—",
      default_owner: owner.trim() || "—",
      category: category,
      spend_type: category.includes("CAPEX") ? "CAPEX" : "OPEX", // defaulting since it's required by backend schema
      priority: priority,
      default_sla_days: sla === "" ? null : parseInt(sla, 10) || 30,
      is_active: true,
      sort_order: 0,
    }, {
      onSuccess: () => {
        toast.success("Item added successfully");
        setItem("");
        setTeam("");
        setOwner("");
        setSla("30");
        setCategory("OPEX");
        setPriority("Medium");
      },
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <div className="rounded-xl border border-dashed border-primary/35 bg-primary/5 p-4">
      <h2 className="text-[14px] font-semibold">Add checklist item</h2>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
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
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-[13px] text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-[13px] text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <Input
          type="number"
          placeholder="SLA days"
          value={sla}
          onChange={(e) => setSla(e.target.value)}
          className="h-9"
        />
        <Button
          className="h-9 gap-1"
          onClick={handleAdd}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </Button>
      </div>
    </div>
  );
}
