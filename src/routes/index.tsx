// @ts-nocheck
import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bot, ScanLine, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Empty, LifecycleBadge } from "@/components/fdr/ui";
import { KpiCard, BarRow, FdrRow } from "@/components/fdr/shared";
import { useStore } from "@/lib/fdr/store";
import { isOpen, isOverdue, isPendingVerification, maturityWindow, openFlags, priorityScore, WINDOW_LABEL, type MaturityWindow } from "@/lib/fdr/rules";
import { fmtINR, fmtINRShort } from "@/lib/fdr/format";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Command Center — ZenithFDR" },
      { name: "description", content: "Portfolio overview and the priority action queue for fixed deposit receipt management." },
      { property: "og:title", content: "Command Center — ZenithFDR" },
      { property: "og:description", content: "Portfolio overview and the priority action queue for fixed deposit receipt management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CommandCenter,
});

const WINDOW_ORDER: MaturityWindow[] = ["matured", "1-7", "8-15", "16-30", "31-90", "90+"];

function CommandCenter() {
  const s = useStore((st) => st);

  const open = useMemo(() => s.fdrs.filter(isOpen), [s.fdrs]);
  const openValue = open.reduce((a, f) => a + f.principal, 0);
  const maturing = open.filter((f) => {
    const d = maturityWindow(f);
    return d === "matured" || d === "1-7" || d === "8-15" || d === "16-30";
  });
  const maturingValue = maturing.reduce((a, f) => a + f.principal, 0);
  const pending = s.fdrs.filter(isPendingVerification);
  const flagged = s.fdrs.flatMap((f) => openFlags(f).map((fl) => ({ f, fl })));
  const overdue = open.filter(isOverdue);

  const queue = useMemo(
    () =>
      open
        .map((f) => ({ f, ...priorityScore(f, s.releases, s.renewals) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8),
    [open, s.releases, s.renewals],
  );

  const windows = WINDOW_ORDER.map((w) => ({ w, items: open.filter((f) => maturityWindow(f) === w) }));
  const maxWin = Math.max(...windows.map((x) => x.items.length), 1);

  const byType = useMemo(() => {
    const m = new Map<string, number>();
    for (const { fl } of flagged) m.set(fl.type, (m.get(fl.type) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [flagged]);

  return (
    <>
      <PageHeader
        title="Command Center"
        subtitle={`Demo date 30 Oct 2026 · ${open.length} open instruments worth ${fmtINRShort(openValue)}`}
        actions={
          <>
            <Button asChild size="sm">
              <Link to="/scanner"><ScanLine /> New FDR via scanner</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/verification"><ShieldCheck /> Verification queue{pending.length > 0 ? ` (${pending.length})` : ""}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/assistant"><Bot /> Ask your records</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open instruments" value={open.length} sub={`Portfolio ${fmtINRShort(openValue)}`} />
        <KpiCard label="Maturing in 30 days" value={maturing.length} sub={`${fmtINRShort(maturingValue)} maturing or matured`} warn={maturing.length > 0} to="/radar" />
        <KpiCard label="Pending verification" value={pending.length} sub="Submitted, under scrutiny or correction" to="/verification" />
        <KpiCard label="Open discrepancies" value={flagged.length} sub={`${overdue.length} action(s) past due date`} warn={flagged.length > 0} to="/verification" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          title="Priority Action Queue"
          className="lg:col-span-2"
          bodyClass="p-2"
          action={<Link to="/registry" className="text-xs text-primary hover:underline">Full registry <ArrowRight className="inline size-3" /></Link>}
        >
          {queue.length === 0 ? (
            <Empty title="Nothing needs attention" hint="All open instruments are in good standing." />
          ) : (
            <div className="divide-y">
              {queue.map(({ f, score }) => (
                <div key={f.id} className="relative">
                  <FdrRow f={f} />
                  <p className="px-2 pb-2 text-[11px] text-muted-foreground">
                    <span className="num mr-1 font-medium text-foreground">Score {score}</span> — {f.nextAction}
                  </p>
                </div>
              ))}
            </div>
          )}
          <p className="px-2 pt-1 text-[10px] text-muted-foreground">Scores are an operational prioritisation aid — not a credit rating or fraud probability.</p>
        </Panel>

        <div className="space-y-4">
          <Panel title="Maturity Radar" action={<Link to="/radar" className="text-xs text-primary hover:underline">Open radar</Link>}>
            <div className="space-y-3">
              {windows.map(({ w, items }) => (
                <BarRow key={w} label={WINDOW_LABEL[w]} value={items.length} max={maxWin} right={String(items.length)} tone={w === "matured" || w === "1-7" ? "critical" : w === "8-15" ? "warning" : "info"} />
              ))}
            </div>
          </Panel>
          <Panel title="Discrepancies by rule">
            {byType.length === 0 ? (
              <Empty title="No open discrepancies" />
            ) : (
              <ul className="space-y-2">
                {byType.map(([type, n]) => (
                  <li key={type} className="flex items-center justify-between gap-2 text-xs">
                    <span>{type}</span>
                    <span className="num rounded bg-warning-soft px-1.5 py-0.5 font-semibold text-warning">{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Recent decisions">
            <ul className="space-y-2">
              {s.audit.slice(0, 5).map((a) => (
                <li key={a.id} className="text-xs">
                  <p className="font-medium">{a.action}</p>
                  <p className="text-muted-foreground">
                    {a.recordRef ? `${a.recordRef} · ` : ""}{a.actor}
                  </p>
                </li>
              ))}
              {s.audit.length === 0 && <Empty title="No activity yet" />}
            </ul>
            <Link to="/dossiers" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">Audit trail <ArrowRight className="size-3" /></Link>
          </Panel>
        </div>
      </div>

      <Panel title="Recently submitted" className="mt-4" bodyClass="p-2">
        {s.fdrs.filter((f) => isPendingVerification(f)).slice(0, 5).map((f) => (
          <Link key={f.id} to="/fdr/$id" params={{ id: f.id }} className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent">
            <span className="num w-24 text-[13px] font-medium">{f.ref}</span>
            <span className="num hidden text-xs text-muted-foreground sm:block">{f.fdrNumber}</span>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{f.institution} · {fmtINR(f.principal)}</span>
            <LifecycleBadge s={f.lifecycle} />
          </Link>
        ))}
        {pending.length === 0 && <Empty title="Verification queue is clear" />}
      </Panel>
    </>
  );
}
