// @ts-nocheck
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckSquare, Square, Plus } from "lucide-react";
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
import { fmtDate, fmtDateTime, fmtINR } from "@/lib/fdr/format";
import type { ReleaseRequest } from "@/lib/fdr/types";

export const Route = createFileRoute("/releases")({
  head: () => ({
    meta: [
      { title: "Release & Refunds — ZenithFDR" },
      { name: "description", content: "Release and refund requests with condition checklists, approvals and completion references." },
      { property: "og:title", content: "Release & Refunds — ZenithFDR" },
      { property: "og:description", content: "Track release and refund requests through their stages." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Releases,
});

const STAGE_TONE = { Submitted: "info", "Under Review": "warning", Approved: "teal", Rejected: "critical", Completed: "success", Closed: "neutral" } as const;
const ACTIVE_STAGES = ["Submitted", "Under Review", "Approved", "Completed"];

function Releases() {
  const s = useStore((st) => st);
  const reviewer = can(s.role, "reviewer");
  const approver = can(s.role, "approver");
  const operator = can(s.role, "operator");
  const [createOpen, setCreateOpen] = useState(false);
  const [remarks, setRemarks] = useState<null | { id: string; kind: "Under Review" | "Approved" | "Rejected" | "Closed" }>(null);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [target, setTarget] = useState("pick");

  const eligible = s.fdrs.filter((f) => !CLOSED_STATES.includes(f.lifecycle) && ["Active", "Renewal Due"].includes(f.lifecycle) && !s.releases.some((r) => r.fdrId === f.id && ACTIVE_STAGES.includes(r.stage)));

  return (
    <>
      <PageHeader
        title="Release & Refunds"
        subtitle="Requests move through submission, review, approval, completion and closure."
        actions={<Button size="sm" onClick={() => setCreateOpen(true)} disabled={eligible.length === 0}><Plus /> New request</Button>}
      />

      {s.releases.length === 0 ? (
        <Empty title="No release or refund requests" hint="Create one from an active instrument here or from its detail page." />
      ) : (
        <div className="space-y-4">
          {s.releases.map((r) => {
            const f = s.fdrs.find((x) => x.id === r.fdrId);
            const allMet = r.conditions.every((c) => c.met);
            return (
              <Panel key={r.id} bodyClass="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
                    <span className="num font-semibold">{r.ref}</span>
                    <ToneBadge tone={STAGE_TONE[r.stage]}>{r.stage}</ToneBadge>
                    <span className="rounded border px-1.5 py-0.5 text-xs">{r.kind}</span>
                    {f && <Link to="/fdr/$id" params={{ id: f.id }} className="num text-xs text-primary hover:underline">{f.ref}</Link>}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {r.stage === "Submitted" && <Button size="sm" variant="outline" disabled={!reviewer} onClick={() => setRemarks({ id: r.id, kind: "Under Review" })}>Take up for review</Button>}
                    {r.stage === "Under Review" && (
                      <>
                        <Button size="sm" disabled={!approver} onClick={() => setRemarks({ id: r.id, kind: "Approved" })}>Approve</Button>
                        <Button size="sm" variant="destructive" disabled={!approver} onClick={() => setRemarks({ id: r.id, kind: "Rejected" })}>Reject</Button>
                      </>
                    )}
                    {r.stage === "Approved" && <Button size="sm" disabled={!reviewer} onClick={() => setCompleteId(r.id)}>Record completion…</Button>}
                    {r.stage === "Completed" && <Button size="sm" variant="outline" disabled={!approver} onClick={() => setRemarks({ id: r.id, kind: "Closed" })}>Close instrument</Button>}
                  </div>
                </div>

                <p className="mt-1.5 text-xs text-muted-foreground">{f ? `${f.institution} · ${fmtINR(f.principal)} · matures ${fmtDate(f.maturityDate)}` : "Instrument not found"}</p>
                {r.reason && <p className="mt-1 text-xs">Reason: {r.reason}</p>}
                {r.completion && <p className="mt-1 text-xs text-muted-foreground">Completion: <span className="num">{r.completion.ref}</span> on <span className="num">{fmtDate(r.completion.date)}</span></p>}
                {r.docs.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Documents: {r.docs.join(", ")}</p>}

                <ul className="mt-3 space-y-1.5">
                  {r.conditions.map((c, i) => (
                    <li key={c.label}>
                      <label className="flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          disabled={!reviewer || ["Rejected", "Closed"].includes(r.stage)}
                          onClick={() => actions.toggleCondition(r.id, i)}
                          className="text-primary disabled:opacity-40"
                          aria-label={`Toggle condition: ${c.label}`}
                        >
                          {c.met ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                        </button>
                        <span className={c.met ? "text-muted-foreground line-through" : ""}>{c.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                {!allMet && ["Approved", "Completed", "Closed"].includes(r.stage) === false && reviewer && (
                  <p className="mt-1 text-[11px] text-muted-foreground">All conditions must be met before completion is recorded.</p>
                )}

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
      {!reviewer && <p className="mt-3 text-[11px] text-muted-foreground">Condition checklists need the {minLabel("reviewer")} role; approvals need {minLabel("approver")}.</p>}

      <CreateReleaseDialog open={createOpen} onOpenChange={setCreateOpen} eligible={eligible} target={target} setTarget={setTarget} disabled={!operator} />

      <RemarksDialog
        open={!!remarks}
        onOpenChange={(o) => !o && setRemarks(null)}
        title={remarks ? `${remarks.kind === "Under Review" ? "Take up for review" : remarks.kind} request` : ""}
        description={remarks?.kind === "Approved" ? "Approval does not disburse funds — completion is recorded separately with the bank reference." : undefined}
        confirmLabel={remarks?.kind === "Under Review" ? "Take up for review" : remarks?.kind ?? "Confirm"}
        destructive={remarks?.kind === "Rejected"}
        onConfirm={(rem) => {
          if (!remarks) return;
          actions.releaseAction(remarks.id, remarks.kind, rem);
          toast.success(`Request ${remarks.kind === "Under Review" ? "taken up for review" : remarks.kind.toLowerCase()}`);
        }}
      />

      <CompleteDialog id={completeId} onOpenChange={(o) => !o && setCompleteId(null)} />
    </>
  );
}

function CompleteDialog({ id, onOpenChange }) {
  const [ref, setRef] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  return (
    <Dialog open={!!id} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Record completion</DialogTitle><DialogDescription>Enter the bank credit reference (e.g. UTR) and value date.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Completion reference</Label><Input className="num" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="UTR…" /></div>
          <div className="space-y-1"><Label>Value date</Label><Input type="date" className="num" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-1"><Label>Remarks</Label><Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={ref.trim().length < 3}
            onClick={() => { actions.releaseAction(id, "Completed", remarks || "Funds credited.", { ref: ref.trim(), date }); toast.success("Completion recorded"); onOpenChange(false); }}
          >
            Record completion
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateReleaseDialog({ open, onOpenChange, eligible, target, setTarget, disabled }) {
  const [kind, setKind] = useState("Release");
  const [reason, setReason] = useState("");
  const [docs, setDocs] = useState("Release_Request_Letter.pdf");
  const f = eligible.find((x) => x.id === target);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>New release / refund request</DialogTitle><DialogDescription>Active and renewal-due instruments without an in-flight request are eligible.</DialogDescription></DialogHeader>
        {eligible.length === 0 ? (
          <p className="text-sm text-muted-foreground">No eligible instruments right now.</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Instrument</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger><SelectValue placeholder="Pick an instrument" /></SelectTrigger>
                <SelectContent>
                  {eligible.map((x) => <SelectItem key={x.id} value={x.id}>{x.ref} · {x.fdrNumber} · {fmtINR(x.principal)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Type</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Release">Release</SelectItem><SelectItem value="Refund">Refund</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Reason (mandatory)</Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
            <div className="space-y-1"><Label>Supporting documents (comma-separated)</Label><Input value={docs} onChange={(e) => setDocs(e.target.value)} /></div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onOpenChange}>Cancel</Button>
          <Button
            disabled={disabled || !f || reason.trim().length < 5}
            onClick={() => {
              try {
                actions.createRelease(f.id, kind, reason.trim(), docs.split(",").map((x) => x.trim()).filter(Boolean));
                toast.success("Request submitted");
                onOpenChange(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not create request");
              }
            }}
          >
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
