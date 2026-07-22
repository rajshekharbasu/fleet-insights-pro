import { useEffect, useState } from "react";
import {
  availableEsmsTiers,
  esmsSubsForTier,
  esmsTierForSub,
  isEsmsSubAvailable,
  resolveEsmsSub,
  type EsmsSubTab,
  type EsmsTier,
} from "@/lib/esg-data";
import { A, PanelCard, useEsg, useStubLoad, LoadingRows } from "./primitives";
import { Segmented } from "./Segmented";
import { PoliciesPanel } from "./esms/PoliciesPanel";
import { SopsPanel } from "./esms/SopsPanel";
import { AssessmentsPanel } from "./esms/AssessmentsPanel";
import { EsapPanel } from "./esms/EsapPanel";
import { AuditsPanel } from "./esms/AuditsPanel";
import { TrainingPanel } from "./esms/TrainingPanel";
import { MonitoringPanel } from "./esms/MonitoringPanel";
import { LifecyclePanel } from "./esms/LifecyclePanel";

/** Renders a tier-2 tab's label — through the acronym glossary when it is one. */
function subLabel(s: EsmsSubTab): React.ReactNode {
  if (!s.acronym) return s.label;
  const rest = s.label.slice(s.acronym.length);
  return (
    <>
      <A t={s.acronym} />
      {rest}
    </>
  );
}

/**
 * ESMS shell. Two-tier navigation (tier-1 groups → contextual tier-2 tabs) keeps
 * every row short as the module grows. The tier-2 key is the `?sub=` value; tier-1
 * is derived from it, so existing deep-links keep resolving.
 */
export function EsmsTab({ initialSub }: { initialSub?: string }) {
  const { scope } = useEsg();
  const [sub, setSub] = useState<string>(() => resolveEsmsSub(initialSub));
  const loading = useStubLoad(sub + JSON.stringify(scope));

  // Cross-area deep-links (e.g. a record drawer → external audit) navigate with a
  // new ?sub=; sync when it changes. Manual tab clicks don't touch the URL, so
  // this only fires on an actual incoming sub change.
  useEffect(() => {
    if (initialSub) setSub(resolveEsmsSub(initialSub));
  }, [initialSub]);

  const tier = esmsTierForSub(sub);
  const tiers = availableEsmsTiers();
  const tierSubs = esmsSubsForTier(tier);

  const setTier = (t: EsmsTier) => {
    const first = esmsSubsForTier(t)[0];
    if (first) setSub(first.key);
  };

  // ESAP backlinks and assessment "open findings" links jump between sub-tabs;
  // only follow when the target sub is available in the current build.
  const goToSub = (next: string) => {
    if (isEsmsSubAvailable(next)) setSub(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented<EsmsTier>
          ariaLabel="ESMS groups"
          size="md"
          value={tier}
          onChange={setTier}
          options={tiers.map((t) => ({ key: t.key, label: t.label }))}
        />
        {tierSubs.length > 1 && (
          <Segmented<string>
            ariaLabel={`${tier} sections`}
            size="sm"
            value={sub}
            onChange={setSub}
            options={tierSubs.map((s) => ({ key: s.key, label: subLabel(s) }))}
          />
        )}
      </div>

      {loading ? (
        <PanelCard>
          <LoadingRows rows={5} />
        </PanelCard>
      ) : (
        <>
          {sub === "policies" && <PoliciesPanel onOpenEsap={() => setSub("esap")} />}
          {sub === "sops" && <SopsPanel />}
          {sub === "esdd" && <AssessmentsPanel kind="ESDD" onOpenEsap={() => setSub("esap")} />}
          {sub === "esia" && <AssessmentsPanel kind="ESIA" onOpenEsap={() => setSub("esap")} />}
          {sub === "audit-internal" && <AuditsPanel kind="internal" onOpenEsap={() => setSub("esap")} />}
          {sub === "audit-external" && <AuditsPanel kind="external" onOpenEsap={() => setSub("esap")} />}
          {sub === "training" && <TrainingPanel />}
          {sub === "monitoring" && <MonitoringPanel />}
          {sub === "lifecycle" && <LifecyclePanel />}
          {sub === "esap" && <EsapPanel onOpenSource={goToSub} />}
        </>
      )}
    </div>
  );
}
