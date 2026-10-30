// @ts-nocheck
import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ScanLine, FileCheck2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, DemoNote } from "@/components/fdr/ui";
import { useStore, actions } from "@/lib/fdr/store";
import { detectFlags, type Candidate } from "@/lib/fdr/rules";
import { INSTITUTIONS, BANKS, OFFICERS } from "@/lib/fdr/seed";
import { DEMO_TODAY, addDays, addMonths, fmtDate, fmtINR } from "@/lib/fdr/format";

export const Route = createFileRoute("/scanner")({
  head: () => ({
    meta: [
      { title: "Smart Scanner — ZenithFDR" },
      { name: "description", content: "Simulated document extraction with transparent rule checks before an FDR is registered." },
      { property: "og:title", content: "Smart Scanner — ZenithFDR" },
      { property: "og:description", content: "Simulated extraction and rule checks before registration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Scanner,
});

const SEV_TONE = { High: "text-critical", Medium: "text-warning", Low: "text-muted-foreground" };

const SAMPLE: Candidate & { branch: string; tenureMonths: number } = {
  fdrNumber: "UMB/2024/004512",
  institution: "Northfield Institute of Technology",
  bank: "Union Meridian Bank",
  branch: "Connaught Place, New Delhi",
  principal: 1450000,
  rate: 7.1,
  tenureMonths: 24,
  issueDate: addMonths(addDays(DEMO_TODAY, 730), -24),
  maturityDate: addDays(DEMO_TODAY, 730),
  hasDocument: true,
  extracted: { principal: 1250000, institution: "Northfield Institute of Technology", maturityDate: addDays(DEMO_TODAY, 730) },
};

const BLANK = { ...SAMPLE, fdrNumber: "", principal: NaN, rate: NaN, extracted: undefined, hasDocument: false };

function Scanner() {
  const s = useStore((st) => st);
  const navigate = useNavigate();
  const [form, setForm] = useState<typeof BLANK | null>(null);
  const [officer, setOfficer] = useState<string>("none");

  const candidate = form ? { ...form, hasDocument: form.hasDocument, officer: officer === "none" ? null : officer } : null;
  const flags = useMemo(() => (candidate ? detectFlags(candidate, s.fdrs) : []), [candidate, s.fdrs]);

  const set = (patch: Partial<NonNullable<typeof form>>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const register = () => {
    if (!candidate) return;
    try {
      const created = actions.registerFDR(
        { ...candidate, officer: candidate.officer },
        form.hasDocument
          ? [{ name: `FDR_${candidate.fdrNumber.replace(/[^A-Z0-9]/gi, "_")}.pdf`, kind: "FDR Original", size: "340 KB" }]
          : [],
        "Smart Scanner",
      );
      toast.success(`Registered ${created.ref}`, { description: `${flags.length} rule flag(s) raised at submission.` });
      navigate({ to: "/fdr/$id", params: { id: created.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not register the FDR");
    }
  };

  return (
    <>
      <PageHeader
        title="Smart Scanner"
        subtitle="Load a document, review the extracted fields, run the transparent rule checks, then register."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => { setForm({ ...SAMPLE }); setOfficer("none"); }}>
              <ScanLine /> Load sample document
            </Button>
            <Button size="sm" disabled={!form} onClick={() => { setForm(null); }} variant="ghost">Clear</Button>
          </>
        }
      />

      {!form ? (
        <Panel title="No document loaded">
          <Emptyish />
          <DemoNote>
            This prototype simulates OCR extraction with a fixed sample document — no scanner hardware or AI service is connected. The sample intentionally carries a duplicate FDR number and an amount mismatch so you can see the rule flags.
          </DemoNote>
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <Panel title="Extracted & editable fields" className="lg:col-span-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldL label="FDR number"><Input value={form.fdrNumber} onChange={(e) => set({ fdrNumber: e.target.value })} className="num" /></FieldL>
              <FieldL label="Institution">
                <Select value={form.institution} onValueChange={(v) => set({ institution: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{INSTITUTIONS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
              </FieldL>
              <FieldL label="Bank">
                <Select value={form.bank} onValueChange={(v) => set({ bank: v, branch: "Connaught Place, New Delhi" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </FieldL>
              <FieldL label="Branch"><Input value={form.branch} onChange={(e) => set({ branch: e.target.value })} /></FieldL>
              <FieldL label="Principal (₹)">
                <Input type="number" className="num" value={Number.isNaN(form.principal) ? "" : form.principal} onChange={(e) => set({ principal: e.target.value === "" ? NaN : Number(e.target.value) })} />
              </FieldL>
              <FieldL label="Interest rate (%)">
                <Input type="number" step="0.05" className="num" value={Number.isNaN(form.rate) ? "" : form.rate} onChange={(e) => set({ rate: e.target.value === "" ? NaN : Number(e.target.value) })} />
              </FieldL>
              <FieldL label="Tenure (months)">
                <Input type="number" className="num" value={form.tenureMonths} onChange={(e) => set({ tenureMonths: Number(e.target.value) })} />
              </FieldL>
              <FieldL label="Issue date"><Input type="date" className="num" value={form.issueDate} onChange={(e) => set({ issueDate: e.target.value })} /></FieldL>
              <FieldL label="Maturity date"><Input type="date" className="num" value={form.maturityDate} onChange={(e) => set({ maturityDate: e.target.value })} /></FieldL>
              <FieldL label="Assign officer (optional)">
                <Select value={officer} onValueChange={setOfficer}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Assign later</SelectItem>
                    {OFFICERS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </FieldL>
            </div>
            <label className="mt-3 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
              <span>FDR original attached (demo scan)</span>
              <Switch checked={form.hasDocument} onCheckedChange={(on) => set({ hasDocument: on })} aria-label="Toggle FDR original attachment" />
            </label>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={register} disabled={!form.fdrNumber.trim() || Number.isNaN(form.principal)}><FileCheck2 /> Register FDR</Button>
              <span className="text-xs text-muted-foreground">Registering submits the record to the verification queue with these rule flags attached.</span>
            </div>
          </Panel>

          <Panel title="Document (simulated)" className="lg:col-span-2">
            <div className="rounded-md border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground">
              <p className="num mb-1 font-semibold text-foreground">UNION MERIDIAN BANK</p>
              <p className="num">Fixed Deposit Receipt — {form.fdrNumber || "(number not read)"}</p>
              <p className="mt-2">In favour of: Northfield Institute of Technology</p>
              <p className="num">Principal: ₹12,50,000 · Rate: 7.10% p.a.</p>
              <p className="num">Maturity: {fmtDate(SAMPLE.maturityDate)}</p>
              <p className="mt-2 italic">(Simulated scan — values above are fixed demo text, not OCR output.)</p>
            </div>
            {form.extracted && (
              <p className="mt-3 text-xs text-muted-foreground">
                Extraction step recorded: principal <span className="num">{fmtINR(form.extracted.principal ?? 0)}</span>, maturity <span className="num">{fmtDate(form.extracted.maturityDate ?? "")}</span>, institution {form.extracted.institution}.
              </p>
            )}

            <div className="mt-4 rounded-md border p-3">
              <p className="flex items-center gap-2 text-sm font-semibold"><TriangleAlert className="size-4 text-warning" /> Live rule checks</p>
              {flags.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">No discrepancies detected by the configured rules.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {flags.map((fl) => (
                    <li key={fl.id} className="text-xs">
                      <p className="font-medium"><span className={SEV_TONE[fl.severity]}>●</span> {fl.type}</p>
                      <p className="mt-0.5 text-muted-foreground">{fl.reason}</p>
                      <p className="mt-0.5"><span className="text-muted-foreground">Expected:</span> <span className="num">{fl.expected}</span> · <span className="text-muted-foreground">Observed:</span> <span className="num">{fl.observed}</span></p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <DemoNote>Flags are transparent, rule-based administrative checks — every decision on them is recorded in the audit trail.</DemoNote>
          </Panel>
        </div>
      )}
    </>
  );
}

function FieldL({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Emptyish() {
  return (
    <div className="mb-4 flex flex-col items-center justify-center rounded-md border border-dashed px-4 py-10 text-center">
      <ScanLine className="mb-2 size-6 text-muted-foreground" />
      <p className="text-sm font-medium">Load the sample document to see extraction and rule checks</p>
    </div>
  );
}
