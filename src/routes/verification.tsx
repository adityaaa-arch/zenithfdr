// @ts-nocheck
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileWarning, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Empty, LifecycleBadge, VerificationBadge, RemarksDialog } from "@/components/fdr/ui";
import { KpiCard } from "@/components/fdr/shared";
import { useStore, actions } from "@/lib/fdr/store";
import { isPendingVerification, openFlags, priorityScore } from "@/lib/fdr/rules";
import { fmtINR, fmtINRShort } from "@/lib/fdr/format";
import { can, minLabel } from "@/lib/fdr/access";
import { toast } from "sonner";

export const Route = createFileRoute("/verification")({
  head: () => ({
    meta: [
      { title: "Verification Queue — ZenithFDR" },
      { name: "description", content: "Newly submitted fixed deposit receipts awaiting scrutiny, correction or verification." },
      { property: "og:title", content: "Verification Queue — ZenithFDR" },
      { property: "og:description", content: "Submitted receipts awaiting scrutiny and verification." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Verification,
});

const SEV_TONE = { High: "text-critical", Medium: "text-warning", Low: "text-muted-foreground" };

function Verification() {
  const s = useStore((st) => st);
  const queue = s.fdrs.filter(isPendingVerification);
  const [scrutinyId, setScrutinyId] = useState<string | null>(null);
  const [correctionId, setCorrectionId] = useState<string | null>(null);
  const reviewer = can(s.role, "reviewer");

  const flaggedCount = queue.reduce((a, f) => a + openFlags(f).length, 0);

  return (
    <>
      <PageHeader
        title="Verification Queue"
        subtitle="Rule-checked instruments awaiting scrutiny. Flags are administrative inconsistencies, not proof of fraud."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Awaiting scrutiny" value={queue.length} sub="Submitted, under scrutiny or correction requested" />
        <KpiCard label="Open discrepancies" value={flaggedCount} warn={flaggedCount > 0} />
        <KpiCard label="Highest priority score" value={queue.length ? Math.max(...queue.map((f) => priorityScore(f, s.releases, s.renewals).score)) : 0} />
      </div>

      <div className="mt-4 space-y-4">
        {queue.length === 0 && <Empty title="The queue is clear" hint="New submissions from the Smart Scanner will appear here." />}
        {queue.map((f) => {
          const flags = openFlags(f);
          return (
            <Panel key={f.id} bodyClass="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to="/fdr/$id" params={{ id: f.id }} className="num text-[15px] font-semibold hover:underline">{f.ref}</Link>
                    <span className="num text-xs text-muted-foreground">{f.fdrNumber}</span>
                    <LifecycleBadge s={f.lifecycle} />
                    <VerificationBadge s={f.verification} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{f.institution} · {f.bank} · <span className="num">{fmtINR(f.principal)}</span> at {f.rate.toFixed(2)}%</p>
                  <p className="mt-1 text-xs">Next action: <span className="font-medium">{f.nextAction}</span></p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline"><Link to="/fdr/$id" params={{ id: f.id }}>Open case</Link></Button>
                  {f.lifecycle === "Submitted" && (
                    <Button size="sm" disabled={!reviewer} onClick={() => setScrutinyId(f.id)}><ShieldCheck /> Move to scrutiny</Button>
                  )}
                  {["Submitted", "Under Scrutiny"].includes(f.lifecycle) && (
                    <Button size="sm" variant="outline" disabled={!reviewer} onClick={() => setCorrectionId(f.id)}><FileWarning /> Request correction</Button>
                  )}
                </div>
              </div>

              {flags.length > 0 && (
                <ul className="mt-3 space-y-2 rounded-md border border-warning/30 bg-warning-soft/50 p-3">
                  {flags.map((fl) => (
                    <li key={fl.id} className="text-xs">
                      <p className="font-medium"><span className={SEV_TONE[fl.severity]}>●</span> {fl.type} <span className="text-muted-foreground">({fl.field})</span></p>
                      <p className="mt-0.5 text-muted-foreground">{fl.reason}</p>
                      <p className="mt-0.5"><span className="text-muted-foreground">Expected:</span> <span className="num">{fl.expected}</span> · <span className="text-muted-foreground">Observed:</span> <span className="num">{fl.observed}</span></p>
                      <p className="mt-0.5 text-muted-foreground">Suggestion: {fl.suggestion}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          );
        })}
      </div>

      <RemarksDialog
        open={!!scrutinyId}
        onOpenChange={(o) => !o && setScrutinyId(null)}
        title="Move to scrutiny"
        description="The record enters the scrutiny stage for document checks."
        confirmLabel="Move to scrutiny"
        onConfirm={(remarks) => { actions.transition(scrutinyId!, "Under Scrutiny", "Moved to scrutiny", remarks); toast.success("Moved to scrutiny"); }}
      />
      <RemarksDialog
        open={!!correctionId}
        onOpenChange={(o) => !o && setCorrectionId(null)}
        title="Request correction from institution"
        description="The institution must resubmit with corrections before verification can continue."
        confirmLabel="Request correction"
        onConfirm={(remarks) => { actions.transition(correctionId!, "Correction Requested", "Correction requested", remarks); toast.success("Correction requested"); }}
      />
      {!reviewer && <p className="mt-3 text-[11px] text-muted-foreground">Scrutiny actions need the {minLabel("reviewer")} demo role.</p>}
    </>
  );
}
