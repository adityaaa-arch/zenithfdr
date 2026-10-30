// @ts-nocheck
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { FileArchive, FileDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, Panel, Empty, DemoNote } from "@/components/fdr/ui";
import { useStore, actions, actor } from "@/lib/fdr/store";
import { fmtDate, fmtDateTime, fmtINR } from "@/lib/fdr/format";

export const Route = createFileRoute("/dossiers")({
  head: () => ({
    meta: [
      { title: "Audit Dossiers — ZenithFDR" },
      { name: "description", content: "Generate a PDF audit dossier for any instrument and browse the full decision audit trail." },
      { property: "og:title", content: "Audit Dossiers — ZenithFDR" },
      { property: "og:description", content: "PDF audit dossiers and the full decision audit trail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dossiers,
});

function Dossiers() {
  const s = useStore((st) => st);
  const [target, setTarget] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const audit = useMemo(() => {
    const t = q.trim().toLowerCase();
    return s.audit.filter((a) => !t || [a.action, a.actor, a.recordRef ?? "", a.detail].some((v) => v.toLowerCase().includes(t))).slice(0, 100);
  }, [s.audit, q]);

  const generate = async () => {
    const f = s.fdrs.find((x) => x.id === target);
    if (!f) return toast.error("Pick an instrument first");
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text("ZenithFDR — Audit Dossier", 14, 16);
      doc.setFontSize(9);
      doc.setTextColor(110);
      doc.text(`${f.ref} · ${f.fdrNumber} · generated ${fmtDateTime(new Date().toISOString())} · by ${actor()}`, 14, 22);
      doc.setTextColor(0);
      doc.setFontSize(8);
      doc.text("Demo dataset — values are illustrative and must be verified against originals before any external use.", 14, 27);
      autoTable(doc, {
        startY: 32,
        styles: { fontSize: 8 },
        head: [["Field", "Value"]],
        body: [
          ["Reference", f.ref],
          ["FDR number", f.fdrNumber],
          ["Institution", f.institution],
          ["Bank / branch", `${f.bank}, ${f.branch}`],
          ["Principal", fmtINR(f.principal)],
          ["Rate", `${f.rate.toFixed(2)}% p.a. for ${f.tenureMonths} months`],
          ["Issue date", fmtDate(f.issueDate)],
          ["Maturity date", fmtDate(f.maturityDate)],
          ["Lifecycle", f.lifecycle],
          ["Verification", f.verification],
          ["Officer", f.officer ?? "Unassigned"],
          ["Next action", `${f.nextAction}${f.actionDue ? ` (due ${fmtDate(f.actionDue)})` : ""}`],
        ],
        headStyles: { fillColor: [38, 52, 92] },
      });
      if (f.flags.length > 0) {
        autoTable(doc, {
          styles: { fontSize: 8 },
          head: [["Discrepancy", "Severity", "Decision", "Note"]],
          body: f.flags.map((fl) => [fl.type, fl.severity, fl.decision, fl.decisionNote ?? ""]),
          headStyles: { fillColor: [170, 105, 30] },
        });
      }
      autoTable(doc, {
        styles: { fontSize: 8 },
        head: [["When", "Event", "Actor", "Remarks"]],
        body: f.timeline.map((e) => [fmtDateTime(e.at), e.title, e.actor, e.remarks]),
        headStyles: { fillColor: [38, 52, 92] },
      });
      const recordAudit = s.audit.filter((a) => a.recordId === f.id).slice(0, 30);
      if (recordAudit.length > 0) {
        autoTable(doc, {
          styles: { fontSize: 8 },
          head: [["When", "Audit entry", "Actor", "Detail"]],
          body: recordAudit.map((a) => [fmtDateTime(a.at), a.action, a.actor, a.detail]),
          headStyles: { fillColor: [110, 110, 110] },
        });
      }
      doc.save(`Dossier_${f.ref.replace(/[^A-Z0-9]/gi, "_")}.pdf`);
      actions.logDossier(f.id);
      toast.success("Dossier generated", { description: "PDF downloaded and the generation logged on the record." });
    } catch {
      toast.error("Could not generate the PDF in this browser");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Audit Dossiers" subtitle="A dossier bundles the instrument summary, discrepancy decisions and the full lifecycle timeline into one PDF." />

      <Panel title="Generate dossier">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-64 flex-1">
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger aria-label="Pick instrument for dossier"><SelectValue placeholder="Pick an instrument…" /></SelectTrigger>
              <SelectContent>
                {s.fdrs.map((f) => <SelectItem key={f.id} value={f.id}>{f.ref} · {f.fdrNumber} · {f.institution}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generate} disabled={busy || !target}><FileArchive /> {busy ? "Generating…" : "Generate & download PDF"}</Button>
        </div>
        <DemoNote>The PDF is produced entirely in the browser; generation is recorded on the record's timeline and the audit trail.</DemoNote>
      </Panel>

      <Panel
        title="Audit trail"
        className="mt-4"
        bodyClass="p-0"
        action={
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by action, actor, reference…" className="h-8 pl-8 text-xs" aria-label="Filter audit trail" />
          </div>
        }
      >
        {audit.length === 0 ? (
          <div className="p-4"><Empty title="No audit entries match" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="hidden md:table-cell">Actor</TableHead>
                <TableHead>Record</TableHead>
                <TableHead className="hidden lg:table-cell">Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="num whitespace-nowrap text-xs">{fmtDateTime(a.at)}</TableCell>
                  <TableCell className="text-xs font-medium">{a.action}</TableCell>
                  <TableCell className="hidden text-xs md:table-cell">{a.actor}</TableCell>
                  <TableCell className="text-xs">
                    {a.recordId ? <Link to="/fdr/$id" params={{ id: a.recordId }} className="num text-primary hover:underline">{a.recordRef}</Link> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="hidden max-w-80 truncate text-xs text-muted-foreground lg:table-cell">{a.detail}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="px-4 py-2 text-[11px] text-muted-foreground">Showing the latest {audit.length} of {s.audit.length} entries.</p>
      </Panel>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><FileDown className="size-3.5" /> Tip: the audit trail is also filterable; every decision made across the app appears here.</p>
    </>
  );
}
