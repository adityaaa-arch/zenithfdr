// @ts-nocheck
import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft, CalendarClock, CircleCheck, CircleDashed, Download, FileUp, Pencil, RefreshCcw, HandCoins,
  ShieldCheck, UserPlus, XCircle, Clock, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PageHeader, Panel, Empty, RemarksDialog, LifecycleBadge, VerificationBadge, Field } from "@/components/fdr/ui";
import { ScoreBadge } from "@/components/fdr/ui";
import { useStore, actions, getState } from "@/lib/fdr/store";
import { can, minLabel } from "@/lib/fdr/access";
import { openFlags, priorityScore, isPendingVerification, CLOSED_STATES } from "@/lib/fdr/rules";
import { VERIFICATIONS } from "@/lib/fdr/rules";
import { OFFICERS, INSTITUTIONS, BANKS } from "@/lib/fdr/seed";
import { daysToMaturity, fmtDate, fmtDateTime, fmtINR, addMonths } from "@/lib/fdr/format";
import type { FlagDecision, Lifecycle } from "@/lib/fdr/types";

export const Route = createFileRoute("/fdr/$id")({
  loader: ({ params }) => {
    if (!getState().fdrs.some((f) => f.id === params.id)) throw notFound();
  },
  notFoundComponent: () => (
    <div className="py-10 text-center">
      <p className="text-sm font-medium">Record not found</p>
      <Link to="/registry" className="mt-2 inline-block text-xs text-primary hover:underline">Back to registry</Link>
    </div>
  ),
  head: () => ({
    meta: [
      { title: "FDR Detail — ZenithFDR" },
      { name: "description", content: "Full record view: lifecycle timeline, discrepancies, documents and decisions for one fixed deposit receipt." },
      { property: "og:title", content: "FDR Detail — ZenithFDR" },
      { property: "og:description", content: "Lifecycle timeline, discrepancies and decisions for one fixed deposit receipt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FdrDetail,
});

const SEV_TONE = { High: "text-critical", Medium: "text-warning", Low: "text-muted-foreground" };
const DECISIONS: FlagDecision[] = ["Open", "Confirmed discrepancy", "Resolved", "Requires institution clarification", "False positive"];

function FdrDetail() {
  const { id } = Route.useParams();
  const s = useStore((st) => st);
  const f = s.fdrs.find((x) => x.id === id);

  const [dialog, setDialog] = useState<null | "edit" | "assign" | "upload" | "renewal" | "release">(null);
  const [flagId, setFlagId] = useState<string | null>(null);
  const [trans, setTrans] = useState<null | { to: Lifecycle; title: string; description: string; confirm: string; destructive?: boolean }>(null);

  if (!f) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm font-medium">This record no longer exists in the demo data.</p>
        <Link to="/registry" className="mt-2 inline-block text-xs text-primary hover:underline">Back to registry</Link>
      </div>
    );
  }

  const reviewer = can(s.role, "reviewer");
  const approver = can(s.role, "approver");
  const operator = can(s.role, "operator");
  const flags = openFlags(f);
  const score = priorityScore(f, s.releases, s.renewals);
  const d = daysToMaturity(f.maturityDate);
  const pendingVerification = isPendingVerification(f);
  const activeRenewal = s.renewals.find((r) => r.oldId === f.id && ["Under Review", "Recommended", "Approved"].includes(r.stage));
  const activeRelease = s.releases.find((r) => r.fdrId === f.id && ["Submitted", "Under Review", "Approved", "Completed"].includes(r.stage));
  const renewalEligible =
    !CLOSED_STATES.includes(f.lifecycle) &&
    !activeRenewal &&
    (f.lifecycle === "Renewal Due" || (f.lifecycle === "Active" && d <= 30));
  const releaseEligible = !CLOSED_STATES.includes(f.lifecycle) && !activeRelease && ["Active", "Renewal Due"].includes(f.lifecycle);
  const editAllowed = pendingVerification ? operator : reviewer;

  const doTransition = (to: Lifecycle, title: string, description: string, confirm: string, destructive = false) =>
    setTrans({ to, title, description, confirm, destructive });

  return (
    <>
      <Link to="/registry" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" /> Back to registry</Link>

      <PageHeader
        title={`${f.ref} · ${f.fdrNumber}`}
        subtitle={`${f.institution} · ${f.bank}, ${f.branch}`}
        actions={
          <>
            <ScoreBadge score={score.score} factors={score.factors} />
            <LifecycleBadge s={f.lifecycle} />
            <VerificationBadge s={f.verification} />
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {f.lifecycle === "Submitted" && (
          <>
            <Button size="sm" disabled={!reviewer} onClick={() => doTransition("Under Scrutiny", "Move to scrutiny", "The record enters the scrutiny stage for document checks.", "Move to scrutiny")}><ShieldCheck /> Move to scrutiny</Button>
            <Button size="sm" variant="outline" disabled={!reviewer} onClick={() => doTransition("Correction Requested", "Request correction", "The institution must resubmit with corrections.", "Request correction")}><Clock /> Request correction</Button>
            <Button size="sm" variant="destructive" disabled={!approver} onClick={() => doTransition("Rejected", "Reject submission", "The submission is rejected and the record is closed.", "Reject submission", true)}><Ban /> Reject</Button>
          </>
        )}
        {f.lifecycle === "Under Scrutiny" && (
          <>
            <Button size="sm" disabled={!reviewer} onClick={() => doTransition("Verified", "Mark verified", flags.length ? `${flags.length} open discrepancy flag(s) will remain on record. Continue anyway?` : "Registered values match the document. Issuer confirmation will be requested.", "Mark verified")}><CircleCheck /> Mark verified</Button>
            <Button size="sm" variant="outline" disabled={!reviewer} onClick={() => doTransition("Correction Requested", "Request correction", "The institution must resubmit with corrections.", "Request correction")}><Clock /> Request correction</Button>
          </>
        )}
        {f.lifecycle === "Correction Requested" && (
          <Button size="sm" disabled={!operator} onClick={() => doTransition("Under Scrutiny", "Resubmit after correction", "The corrected record goes back to scrutiny.", "Resubmit")}><RefreshCcw /> Resubmit after correction</Button>
        )}
        {f.lifecycle === "Verified" && (
          <Button size="sm" disabled={!approver} onClick={() => doTransition("Active", "Activate instrument", "The verified instrument enters the active portfolio.", "Activate")}><CircleCheck /> Activate instrument</Button>
        )}
        {renewalEligible && (
          <Button size="sm" variant="outline" disabled={!operator} onClick={() => setDialog("renewal")}><RefreshCcw /> Create renewal</Button>
        )}
        {releaseEligible && (
          <Button size="sm" variant="outline" disabled={!operator} onClick={() => setDialog("release")}><HandCoins /> Request release / refund</Button>
        )}
        {f.lifecycle === "Released" && (
          <Button size="sm" disabled={!approver} onClick={() => doTransition("Closed", "Close instrument", "All conditions are satisfied; the record is closed.", "Close instrument")}><XCircle /> Close instrument</Button>
        )}
        {(pendingVerification || can(s.role, "reviewer")) && (
          <>
            <Button size="sm" variant="ghost" disabled={!editAllowed} onClick={() => setDialog("edit")}><Pencil /> Edit record</Button>
            <Button size="sm" variant="ghost" disabled={!reviewer} onClick={() => setDialog("assign")}><UserPlus /> {f.officer ? "Reassign officer" : "Assign officer"}</Button>
          </>
        )}
        <Button size="sm" variant="ghost" disabled={!operator} onClick={() => setDialog("upload")}><FileUp /> Upload document</Button>
        <Button asChild size="sm" variant="ghost"><Link to="/dossiers"><Download /> Audit dossier</Link></Button>
      </div>

      {(activeRenewal || activeRelease) && (
        <p className="mt-2 text-xs text-muted-foreground">
          In-flight {activeRenewal ? <Link to="/renewals" className="text-primary hover:underline">renewal {activeRenewal.ref}</Link> : null}
          {activeRenewal && activeRelease ? " and " : ""}
          {activeRelease ? <Link to="/releases" className="text-primary hover:underline">{activeRelease.kind.toLowerCase()} request {activeRelease.ref}</Link> : null} pending for this instrument.
        </p>
      )}
      {!reviewer && !approver && <p className="mt-2 text-[11px] text-muted-foreground">You are acting as {minLabel("operator")}. Approvals and scrutiny need higher demo roles.</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Instrument" className="lg:col-span-2">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-3">
            <Field label="Principal"><span className="num">{fmtINR(f.principal)}</span></Field>
            <Field label="Interest rate"><span className="num">{f.rate.toFixed(2)}% p.a.</span></Field>
            <Field label="Tenure"><span className="num">{f.tenureMonths} months</span></Field>
            <Field label="Issue date"><span className="num">{fmtDate(f.issueDate)}</span></Field>
            <Field label="Maturity date"><span className="num">{fmtDate(f.maturityDate)}</span>{!CLOSED_STATES.includes(f.lifecycle) && <span className="num ml-2 text-xs text-muted-foreground">{d < 0 ? `${-d}d overdue` : `${d}d left`}</span>}</Field>
            <Field label="Officer"><span>{f.officer ?? "Unassigned"}</span></Field>
            <Field label="Next action" className="sm:col-span-2">{f.nextAction}{f.actionDue && <> · due <span className="num">{fmtDate(f.actionDue)}</span></>}</Field>
            <Field label="Submitted"><span className="num">{fmtDate(f.submittedAt)}</span></Field>
            {f.renewedFromId && <Field label="Renewal of" className="sm:col-span-3"><RelationshipLink id={f.renewedFromId} label="previous instrument" /></Field>}
            {f.renewedToId && <Field label="Renewed into" className="sm:col-span-3"><RelationshipLink id={f.renewedToId} label="replacement instrument" /></Field>}
          </dl>
        </Panel>

        <Panel title="Verification progress">
          <ol className="space-y-3">
            {VERIFICATIONS.map((v, i) => {
              const current = VERIFICATIONS.indexOf(f.verification);
              const done = i < current;
              const isCurrent = i === current;
              return (
                <li key={v} className="flex items-start gap-2.5 text-sm">
                  {done ? <CircleCheck className="mt-0.5 size-4 text-success" /> : <CircleDashed className={isCurrent ? "mt-0.5 size-4 text-primary" : "mt-0.5 size-4 text-muted-foreground/50"} />}
                  <span className={isCurrent ? "font-medium" : done ? "" : "text-muted-foreground"}>{v}</span>
                </li>
              );
            })}
          </ol>
          {reviewer && (
            <div className="mt-3 space-y-1">
              <Label className="text-xs">Set verification stage</Label>
              <Select value={f.verification} onValueChange={(v) => { actions.setVerification(f.id, v, "Verification stage updated manually."); toast.success(`Verification: ${v}`); }}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{VERIFICATIONS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </Panel>
      </div>

      <Panel title={`Discrepancy flags (${f.flags.length})`} className="mt-4" bodyClass="p-3">
        {f.flags.length === 0 ? (
          <Empty title="No flags on this record" hint="Rule checks run at registration and on edits." />
        ) : (
          <ul className="space-y-2.5">
            {f.flags.map((fl) => {
              const open = fl.decision === "Open" || fl.decision === "Requires institution clarification";
              return (
                <li key={fl.id} className={open ? "rounded-md border border-warning/30 bg-warning-soft/50 p-3" : "rounded-md border p-3"}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium"><span className={SEV_TONE[fl.severity]}>●</span> {fl.type} <span className="text-xs text-muted-foreground">({fl.field})</span></p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{fl.decision}</span>
                      {reviewer && open && (
                        <Button size="sm" variant="outline" onClick={() => setFlagId(fl.id)}>Decide…</Button>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{fl.reason}</p>
                  <p className="mt-1 text-xs"><span className="text-muted-foreground">Expected:</span> <span className="num">{fl.expected}</span> · <span className="text-muted-foreground">Observed:</span> <span className="num">{fl.observed}</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">Suggestion: {fl.suggestion}</p>
                  {fl.decisionNote && <p className="mt-1 text-xs"><span className="text-muted-foreground">Decision note:</span> {fl.decisionNote}{fl.decidedBy && ` — ${fl.decidedBy}`}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title={`Documents (${f.documents.length})`} bodyClass="p-2">
          <ul className="divide-y">
            {f.documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-2 px-2 py-2 text-xs">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{doc.name}</span>
                  <span className="text-muted-foreground">{doc.kind} · {doc.size} · {fmtDateTime(doc.uploadedAt)} · {doc.uploadedBy}</span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => toast("Download is simulated in this prototype", { description: doc.name })}><Download /></Button>
              </li>
            ))}
            {f.documents.length === 0 && <li className="p-4 text-center text-xs text-muted-foreground">No documents attached.</li>}
          </ul>
        </Panel>

        <Panel title={`Lifecycle timeline (${f.timeline.length})`} bodyClass="p-2">
          <ol className="relative space-y-3 px-2 py-1">
            {f.timeline.map((ev) => (
              <li key={ev.id} className="flex gap-3">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-border" />
                <span className="min-w-0 text-xs">
                  <span className="block font-medium">{ev.title}</span>
                  <span className="block text-muted-foreground">{fmtDateTime(ev.at)} · {ev.actor}</span>
                  <span className="block text-muted-foreground">{ev.remarks}</span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      {/* ------- dialogs ------- */}
      <EditDialog f={f} open={dialog === "edit"} onOpenChange={(o) => !o && setDialog(null)} />
      <Dialog open={dialog === "assign"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Assign officer</DialogTitle><DialogDescription>Assignment is recorded on the timeline.</DialogDescription></DialogHeader>
          <AssignForm f={f} onDone={() => setDialog(null)} />
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === "upload"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Upload document</DialogTitle><DialogDescription>Metadata only in this prototype — no real file is stored.</DialogDescription></DialogHeader>
          <UploadForm f={f} onDone={() => setDialog(null)} />
        </DialogContent>
      </Dialog>
      <RenewalDialog f={f} open={dialog === "renewal"} onOpenChange={(o) => !o && setDialog(null)} />
      <ReleaseDialog f={f} open={dialog === "release"} onOpenChange={(o) => !o && setDialog(null)} />

      <RemarksDialog
        open={!!trans}
        onOpenChange={(o) => !o && setTrans(null)}
        title={trans?.title ?? ""}
        description={trans?.description}
        confirmLabel={trans?.confirm ?? "Confirm"}
        destructive={trans?.destructive}
        onConfirm={(remarks) => { actions.transition(f.id, trans.to, trans.title, remarks); toast.success(trans.title); }}
      />

      <FlagDialog fdrId={f.id} flagId={flagId} onOpenChange={(o) => !o && setFlagId(null)} />
    </>
  );
}

function RelationshipLink({ id, label }: { id: string; label: string }) {
  const other = useStore((s) => s.fdrs.find((f) => f.id === id));
  if (!other) return <span className="text-xs text-muted-foreground">{label} (not found)</span>;
  return (
    <Link to="/fdr/$id" params={{ id }} className="num text-xs text-primary hover:underline">{other.ref} · {other.fdrNumber} — {label}</Link>
  );
}

function EditDialog({ f, open, onOpenChange }) {
  const [form, setForm] = useState({
    principal: String(f.principal), rate: String(f.rate), issueDate: f.issueDate, maturityDate: f.maturityDate,
    branch: f.branch, institution: f.institution, bank: f.bank,
  });
  const [remarks, setRemarks] = useState("");
  const save = () => {
    actions.editFDR(f.id, {
      principal: Number(form.principal), rate: Number(form.rate), issueDate: form.issueDate, maturityDate: form.maturityDate,
      branch: form.branch, institution: form.institution, bank: form.bank,
    }, remarks);
    toast.success("Record modified");
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit record</DialogTitle><DialogDescription>Rule checks re-run automatically where the record is still under verification.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>Principal (₹)</Label><Input className="num" value={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.value })} /></div>
          <div className="space-y-1"><Label>Rate (%)</Label><Input className="num" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></div>
          <div className="space-y-1"><Label>Issue date</Label><Input type="date" className="num" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} /></div>
          <div className="space-y-1"><Label>Maturity date</Label><Input type="date" className="num" value={form.maturityDate} onChange={(e) => setForm({ ...form, maturityDate: e.target.value })} /></div>
          <div className="space-y-1"><Label>Institution</Label>
            <Select value={form.institution} onValueChange={(v) => setForm({ ...form, institution: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{INSTITUTIONS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Bank</Label>
            <Select value={form.bank} onValueChange={(v) => setForm({ ...form, bank: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2"><Label>Branch</Label><Input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Remarks (mandatory)</Label><Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Reason for the change" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={remarks.trim().length < 5 || !form.principal || !form.rate} onClick={save}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignForm({ f, onDone }) {
  const [officer, setOfficer] = useState(f.officer ?? OFFICERS[0]);
  return (
    <>
      <div className="space-y-1">
        <Label>Officer</Label>
        <Select value={officer} onValueChange={setOfficer}>
          <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{OFFICERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <DialogFooter><Button onClick={() => { actions.assignOfficer([f.id], officer); toast.success(`Assigned to ${officer}`); onDone(); }}>Assign</Button></DialogFooter>
    </>
  );
}

function UploadForm({ f, onDone }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("FDR Original");
  return (
    <>
      <div className="space-y-3">
        <div className="space-y-1"><Label>File name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. FDR_Scan_2026.pdf" /></div>
        <div className="space-y-1"><Label>Document kind</Label>
          <Select value={kind} onValueChange={setKind}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["FDR Original", "Covering Letter", "Renewal Advice", "Release Request", "Bank Advice", "Other"].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Cancel</Button>
        <Button disabled={!name.trim()} onClick={() => { actions.addDocument(f.id, name.trim(), kind, "Uploaded (demo)"); toast.success("Document recorded"); onDone(); }}>Upload</Button>
      </DialogFooter>
    </>
  );
}

function RenewalDialog({ f, open, onOpenChange }) {
  const [data, setData] = useState({
    fdrNumber: `${f.fdrNumber}-N1`,
    principal: f.principal,
    rate: f.rate,
    bank: f.bank,
    tenureMonths: f.tenureMonths,
    issueDate: f.maturityDate,
    maturityDate: addMonths(f.maturityDate, f.tenureMonths),
  });
  const [remarks, setRemarks] = useState("");
  const submit = () => {
    try {
      actions.createRenewal(f.id, { ...data, principal: Number(data.principal), rate: Number(data.rate), tenureMonths: Number(data.tenureMonths) }, remarks || "Renewal requested.");
      toast.success("Renewal created", { description: "Replacement registered and chain opened." });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create renewal");
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create renewal from {f.ref}</DialogTitle><DialogDescription>A replacement FDR is registered and linked; the old instrument moves to Renewal Pending until approved.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>New FDR number</Label><Input className="num" value={data.fdrNumber} onChange={(e) => setData({ ...data, fdrNumber: e.target.value })} /></div>
          <div className="space-y-1"><Label>Principal (₹)</Label><Input type="number" className="num" value={data.principal} onChange={(e) => setData({ ...data, principal: Number(e.target.value) })} /></div>
          <div className="space-y-1"><Label>Rate (%)</Label><Input type="number" step="0.05" className="num" value={data.rate} onChange={(e) => setData({ ...data, rate: Number(e.target.value) })} /></div>
          <div className="space-y-1"><Label>Tenure (months)</Label><Input type="number" className="num" value={data.tenureMonths} onChange={(e) => setData({ ...data, tenureMonths: Number(e.target.value) })} /></div>
          <div className="space-y-1"><Label>Issue date</Label><Input type="date" className="num" value={data.issueDate} onChange={(e) => setData({ ...data, issueDate: e.target.value })} /></div>
          <div className="space-y-1"><Label>Maturity date</Label><Input type="date" className="num" value={data.maturityDate} onChange={(e) => setData({ ...data, maturityDate: e.target.value })} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>Remarks</Label><Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Renewal for same tenure at revised rate" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onOpenChange}>Cancel</Button>
          <Button onClick={submit}>Create renewal</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReleaseDialog({ f, open, onOpenChange }) {
  const [kind, setKind] = useState("Release");
  const [reason, setReason] = useState("");
  const [docs, setDocs] = useState("Release_Request_Letter.pdf");
  const submit = () => {
    try {
      actions.createRelease(f.id, kind, reason, docs.split(",").map((x) => x.trim()).filter(Boolean));
      toast.success("Request submitted", { description: "Track it under Release & Refunds." });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create request");
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Request {kind.toLowerCase()} — {f.ref}</DialogTitle><DialogDescription>The instrument moves to Release Pending with three standard conditions.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Type</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Release">Release</SelectItem><SelectItem value="Refund">Refund</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Reason (mandatory)</Label><Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why the funds are being released or refunded" /></div>
          <div className="space-y-1"><Label>Supporting documents (comma-separated)</Label><Input value={docs} onChange={(e) => setDocs(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onOpenChange}>Cancel</Button>
          <Button disabled={reason.trim().length < 5} onClick={submit}>Submit request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FlagDialog({ fdrId, flagId, onOpenChange }) {
  const s = useStore((st) => st);
  const f = s.fdrs.find((x) => x.id === fdrId);
  const fl = f?.flags.find((x) => x.id === flagId);
  const [decision, setDecision] = useState<FlagDecision>("Resolved");
  const [note, setNote] = useState("");
  useEffect(() => {
    if (fl) setDecision(fl.decision);
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagId]);
  return (
    <Dialog open={!!fl} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Decide discrepancy</DialogTitle><DialogDescription>{fl ? `${fl.type} — ${fl.reason}` : ""}</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Decision</Label>
            <Select value={decision} onValueChange={(v) => setDecision(v as FlagDecision)}>
              <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DECISIONS.map((dd) => <SelectItem key={dd} value={dd}>{dd}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Remarks (mandatory)</Label><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Basis for this decision" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={note.trim().length < 5}
            onClick={() => { actions.decideFlag(fdrId, flagId, decision, note.trim()); toast.success(`Discrepancy marked: ${decision}`); onOpenChange(false); }}
          >
            Record decision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
