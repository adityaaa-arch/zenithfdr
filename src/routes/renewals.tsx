// @ts-nocheck
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowRight, Plus, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Panel, Empty, RemarksDialog, ToneBadge } from "@/components/fdr/ui";
import { useStore, actions } from "@/lib/fdr/store";
import { can, minLabel } from "@/lib/fdr/access";
import { CLOSED_STATES } from "@/lib/fdr/rules";
import { daysToMaturity, fmtDate, fmtDateTime, fmtINR, addMonths } from "@/lib/fdr/format";
import type { RenewalRequest } from "@/lib/fdr/types";

export const Route = createFileRoute("/renewals")({
  head: () => ({
    meta: [
      { title: "Renewals & Replacements — ZenithFDR" },
      { name: "description", content: "Renewal chains: create a replacement FDR, track review, recommendation and approval." },
      { property: "og:title", content: "Renewals & Replacements — ZenithFDR" },
      { property: "og:description", content: "Create renewal chains and track their approval." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Renewals,
});

const STAGE_TONE = { "Under Review": "info", Recommended: "warning", Approved: "success", Rejected: "critical" } as const;

function Renewals() {
  const s = useStore((st) => st);
  const reviewer = can(s.role, "reviewer");
  const approver = can(s.role, "approver");
  const [createOpen, setCreateOpen] = useState(false);
  const [action, setAction] = useState<null | { id: string; kind: "Recommended" | "Approved" | "Rejected" }>(null);
  const [target, setTarget] = useState("pick");

  const eligible = s.fdrs.filter(
    (f) => !CLOSED_STATES.includes(f.lifecycle) && !s.renewals.some((r) => r.oldId === f.id && ["Under Review", "Recommended", "Approved"].includes(r.stage)) &&
      (f.lifecycle === "Renewal Due" || (f.lifecycle === "Active" && daysToMaturity(f.maturityDate) <= 30)),
  );

  const run = () => {
    if (!action) return;
    actions.renewalAction(action.id, action.kind, action.remarks);
    toast.success(`Renewal ${action.kind.toLowerCase()}`);
  };

  return (
    <>
      <PageHeader
        title="Renewals & Replacements"
        subtitle="Each renewal is a chain: the maturing instrument links forward to a replacement record."
        actions={<Button size="sm" onClick={() => setCreateOpen(true)} disabled={eligible.length === 0}><Plus /> New renewal</Button>}
      />

      {s.renewals.length === 0 ? (
        <Empty title="No renewal requests yet" hint="Create one from a maturing instrument here or from its detail page." />
      ) : (
        <div className="space-y-4">
          {s.renewals.map((r) => {
            const old = s.fdrs.find((f) => f.id === r.oldId);
            const neu = s.fdrs.find((f) => f.id === r.newId);
            return (
              <Panel key={r.id} bodyClass="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                    <span className="num font-semibold">{r.ref}</span>
                    <ToneBadge tone={STAGE_TONE[r.stage]}>{r.stage}</ToneBadge>
                    {old && <ChainLink f={old} />}
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    {neu && <ChainLink f={neu} />}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {r.stage === "Under Review" && (
                      <Button size="sm" variant="outline" disabled={!reviewer} onClick={() => setAction({ id: r.id, kind: "Recommended" })}>Recommend</Button>
                    )}
                    {r.stage === "Recommended" && (
                      <>
                        <Button size="sm" disabled={!approver} onClick={() => setAction({ id: r.id, kind: "Approved" })}>Approve</Button>
                        <Button size="sm" variant="destructive" disabled={!approver} onClick={() => setAction({ id: r.id, kind: "Rejected" })}>Reject</Button>
                      </>
                    )}
                    {r.stage === "Approved" && <p className="text-xs text-muted-foreground">Replacement is active.</p>}
                    {r.stage === "Rejected" && <p className="text-xs text-muted-foreground">Chain rejected.</p>}
                  </div>
                </div>
                {old && neu && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    <span className="num">{fmtINR(old.principal)}</span> maturing <span className="num">{fmtDate(old.maturityDate)}</span> → replacement <span className="num">{fmtINR(neu.principal)}</span> maturing <span className="num">{fmtDate(neu.maturityDate)}</span>
                  </p>
                )}
                {r.remarks && <p className="mt-1 text-xs">Remarks: {r.remarks}</p>}
                <ol className="mt-3 space-y-1.5 border-l pl-3">
                  {r.history.map((h, i) => (
                    <li key={i} className="text-xs">
                      <span className="font-medium">{h.action}</span> — {h.actor} <span className="text-muted-foreground">({h.role}, {fmtDateTime(h.at)})</span>
                      {h.remarks && <span className="block text-muted-foreground">{h.remarks}</span>}
                    </li>
                  ))}
                </ol>
              </Panel>
            );
          })}
        </div>
      )}
      {!reviewer && <p className="mt-3 text-[11px] text-muted-foreground">Recommendations need the {minLabel("reviewer")} role; approvals need the {minLabel("approver")} role.</p>}

      <CreateRenewalDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        eligible={eligible}
        target={target}
        setTarget={setTarget}
      />

      <RemarksDialog
        open={!!action}
        onOpenChange={(o) => !o && setAction(null)}
        title={action ? `Renewal ${action.kind.toLowerCase()}` : ""}
        description={action?.kind === "Approved" ? "Approving activates the replacement and closes the old instrument as Renewed." : action?.kind === "Rejected" ? "The replacement record is rejected and the old instrument returns to Renewal Due." : "The request moves to the approving authority."}
        confirmLabel={action?.kind ?? "Confirm"}
        destructive={action?.kind === "Rejected"}
        onConfirm={run}
      />
    </>
  );
}

function ChainLink({ f }) {
  return (
    <Link to="/fdr/$id" params={{ id: f.id }} className="num rounded border px-1.5 py-0.5 text-xs hover:bg-accent">
      {f.ref} <span className="text-muted-foreground">{f.lifecycle === "Renewed" ? "old" : "new"} · {fmtINR(f.principal)}</span>
    </Link>
  );
}

function CreateRenewalDialog({ open, onOpenChange, eligible, target, setTarget }) {
  const s = useStore((st) => st);
  const old = eligible.find((f) => f.id === target);
  const [data, setData] = useState({ fdrNumber: "", principal: 0, rate: 0, tenureMonths: 12, issueDate: "", maturityDate: "" });

  const applyFdr = (id: string) => {
    setTarget(id);
    const f = eligible.find((x) => x.id === id);
    if (f) setData({ fdrNumber: `${f.fdrNumber}-N1`, principal: f.principal, rate: f.rate, tenureMonths: f.tenureMonths, issueDate: f.maturityDate, maturityDate: addMonths(f.maturityDate, f.tenureMonths) });
  };

  const submit = () => {
    if (!old) return;
    try {
      actions.createRenewal(old.id, data, "Renewal requested from the renewals page.");
      toast.success("Renewal created");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create renewal");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>New renewal</DialogTitle><DialogDescription>Only maturing or due instruments without an active chain are eligible.</DialogDescription></DialogHeader>
        {eligible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No eligible instruments right now. Instruments become eligible in the renewal window (30 days before maturity).</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Maturing instrument</Label>
              <Select value={target} onValueChange={applyFdr}>
                <SelectTrigger><SelectValue placeholder="Pick an instrument" /></SelectTrigger>
                <SelectContent>
                  {eligible.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.ref} · {f.fdrNumber} · {fmtINR(f.principal)} · {fmtDate(f.maturityDate)} ({f.lifecycle})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {old && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><Label>New FDR number</Label><Input className="num" value={data.fdrNumber} onChange={(e) => setData({ ...data, fdrNumber: e.target.value })} /></div>
                <div className="space-y-1"><Label>Principal (₹)</Label><Input type="number" className="num" value={data.principal} onChange={(e) => setData({ ...data, principal: Number(e.target.value) })} /></div>
                <div className="space-y-1"><Label>Rate (%)</Label><Input type="number" step="0.05" className="num" value={data.rate} onChange={(e) => setData({ ...data, rate: Number(e.target.value) })} /></div>
                <div className="space-y-1"><Label>Tenure (months)</Label><Input type="number" className="num" value={data.tenureMonths} onChange={(e) => setData({ ...data, tenureMonths: Number(e.target.value) })} /></div>
                <div className="space-y-1"><Label>Issue date</Label><Input type="date" className="num" value={data.issueDate} onChange={(e) => setData({ ...data, issueDate: e.target.value })} /></div>
                <div className="space-y-1"><Label>Maturity date</Label><Input type="date" className="num" value={data.maturityDate} onChange={(e) => setData({ ...data, maturityDate: e.target.value })} /></div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onOpenChange}>Cancel</Button>
          <Button disabled={!old} onClick={submit}><RefreshCcw /> Create renewal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
