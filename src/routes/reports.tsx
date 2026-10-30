// @ts-nocheck
import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/fdr/ui";
import { KpiCard, BarRow } from "@/components/fdr/shared";
import { useStore } from "@/lib/fdr/store";
import { isOpen, openFlags, LIFECYCLES } from "@/lib/fdr/rules";
import { DEMO_TODAY, addMonths, daysToMaturity, monthLabel } from "@/lib/fdr/format";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Analytics — ZenithFDR" },
      { name: "description", content: "Portfolio distributions, maturity cash-flow and discrepancy statistics with CSV export." },
      { property: "og:title", content: "Reports & Analytics — ZenithFDR" },
      { property: "og:description", content: "Portfolio distributions, maturity cash-flow and discrepancy statistics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Reports,
});

const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;

function Reports() {
  const s = useStore((st) => st);
  const open = s.fdrs.filter(isOpen);
  const total = s.fdrs.reduce((a, f) => a + f.principal, 0);
  const activeValue = open.reduce((a, f) => a + f.principal, 0);

  const byInstitution = useMemo(() => {
    const m = new Map<string, { n: number; v: number }>();
    for (const f of open) {
      const e = m.get(f.institution) ?? { n: 0, v: 0 };
      m.set(f.institution, { n: e.n + 1, v: e.v + f.principal });
    }
    return [...m.entries()].sort((a, b) => b[1].v - a[1].v);
  }, [open]);

  const byBank = useMemo(() => {
    const m = new Map<string, { n: number; v: number }>();
    for (const f of open) {
      const e = m.get(f.bank) ?? { n: 0, v: 0 };
      m.set(f.bank, { n: e.n + 1, v: e.v + f.principal });
    }
    return [...m.entries()].sort((a, b) => b[1].v - a[1].v);
  }, [open]);

  const byLifecycle = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of s.fdrs) m.set(f.lifecycle, (m.get(f.lifecycle) ?? 0) + 1);
    return LIFECYCLES.map((l) => [l, m.get(l) ?? 0]);
  }, [s.fdrs]);

  const cashflow = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => monthLabel(addMonths(DEMO_TODAY, i)));
    const sums = months.map((mo) => open.filter((f) => monthLabel(f.maturityDate) === mo).reduce((a, f) => a + f.principal, 0));
    return months.map((mo, i) => ({ mo, v: sums[i], n: open.filter((f) => monthLabel(f.maturityDate) === mo).length }));
  }, [open]);

  const flagTypes = useMemo(() => {
    const m = new Map<string, number>();
    for (const f of s.fdrs) for (const fl of openFlags(f)) m.set(fl.type, (m.get(fl.type) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [s.fdrs]);

  const avgRate = open.length ? open.reduce((a, f) => a + f.rate, 0) / open.length : 0;

  const exportCsv = () => {
    const head = ["Ref", "FDR Number", "Institution", "Bank", "Principal", "Rate", "Issue Date", "Maturity Date", "Tenure (months)", "Lifecycle", "Verification", "Officer", "Next Action"].map(esc).join(",");
    const lines = s.fdrs.map((f) =>
      [f.ref, f.fdrNumber, f.institution, f.bank, f.principal, f.rate, f.issueDate, f.maturityDate, f.tenureMonths, f.lifecycle, f.verification, f.officer ?? "", f.nextAction].map(esc).join(","),
    );
    const blob = new Blob([[head, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zenithfdr-registry.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported", { description: `${s.fdrs.length} records exported.` });
  };

  return (
    <>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Distributions over the demo dataset. Charts are rendered as simple bars — no tracking or external analytics service."
        actions={<Button size="sm" variant="outline" onClick={exportCsv}><Download /> Export registry CSV</Button>}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Records on file" value={s.fdrs.length} sub={`All-time value ${fmtShort(total)}`} />
        <KpiCard label="Open instruments" value={open.length} sub={fmtShort(activeValue)} />
        <KpiCard label="Average open rate" value={`${avgRate.toFixed(2)}%`} />
        <KpiCard label="Open discrepancies" value={s.fdrs.reduce((a, f) => a + openFlags(f).length, 0)} warn />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Open value by institution">
          <div className="space-y-3">
            {byInstitution.map(([name, { n, v }]) => (
              <BarRow key={name} label={`${name} (${n})`} value={v} max={byInstitution[0][1].v} right={fmtShort(v)} />
            ))}
          </div>
        </Panel>
        <Panel title="Open value by bank">
          <div className="space-y-3">
            {byBank.map(([name, { n, v }]) => (
              <BarRow key={name} label={`${name} (${n})`} value={v} max={byBank[0][1].v} right={fmtShort(v)} tone="neutral" />
            ))}
          </div>
        </Panel>
        <Panel title="Lifecycle distribution">
          <div className="space-y-3">
            {byLifecycle.map(([l, n]) => (
              <BarRow key={l} label={l} value={n} max={Math.max(...byLifecycle.map((x) => x[1]), 1)} right={String(n)} tone={n > 0 ? "info" : "neutral"} />
            ))}
          </div>
        </Panel>
        <Panel title="Maturity cash-flow — next 6 months">
          <div className="space-y-3">
            {cashflow.map(({ mo, v, n }) => (
              <BarRow key={mo} label={`${mo} (${n})`} value={v} max={Math.max(...cashflow.map((x) => x.v), 1)} right={fmtShort(v)} tone="warning" />
            ))}
            <p className="text-[11px] text-muted-foreground">Value maturing per month across open instruments.</p>
          </div>
        </Panel>
        <Panel title="Open discrepancies by rule" className="lg:col-span-2">
          {flagTypes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No open discrepancies on file.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {flagTypes.map(([type, n]) => (
                <BarRow key={type} label={type} value={n} max={flagTypes[0][1]} right={String(n)} tone="critical" />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function fmtShort(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}
