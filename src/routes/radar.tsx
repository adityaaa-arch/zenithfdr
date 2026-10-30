// @ts-nocheck
import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Switch } from "@/components/ui/switch";
import { PageHeader, Panel } from "@/components/fdr/ui";
import { KpiCard, FdrRow, GateNote } from "@/components/fdr/shared";
import { useStore, actions } from "@/lib/fdr/store";
import { isOpen, isOverdue, maturityWindow, WINDOW_LABEL, type MaturityWindow } from "@/lib/fdr/rules";
import { fmtINRShort } from "@/lib/fdr/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/radar")({
  head: () => ({
    meta: [
      { title: "Maturity Radar — ZenithFDR" },
      { name: "description", content: "Instruments grouped by time to maturity, with renewal-window reminders." },
      { property: "og:title", content: "Maturity Radar — ZenithFDR" },
      { property: "og:description", content: "Instruments grouped by time to maturity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Radar,
});

const ORDER: MaturityWindow[] = ["matured", "1-7", "8-15", "16-30", "31-90", "90+"];
const WINDOW_TONE: Record<MaturityWindow, string> = {
  matured: "border-critical/40",
  "1-7": "border-critical/40",
  "8-15": "border-warning/40",
  "16-30": "border-primary/30",
  "31-90": "border-border",
  "90+": "border-border",
};

function Radar() {
  const s = useStore((st) => st);
  const open = useMemo(() => s.fdrs.filter(isOpen), [s.fdrs]);

  const groups = ORDER.map((w) => {
    const items = open.filter((f) => maturityWindow(f) === w);
    return { w, items, value: items.reduce((a, f) => a + f.principal, 0) };
  });

  const overdue = open.filter(isOverdue);

  const toggleReminder = (d: number, on: boolean) => {
    const next = on ? [...s.reminderDays, d].sort((a, b) => b - a) : s.reminderDays.filter((x) => x !== d);
    actions.setReminderDays(next);
  };

  return (
    <>
      <PageHeader title="Maturity Radar" subtitle="Open instruments grouped by days to maturity (demo date 30 Oct 2026)" />

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Open instruments" value={open.length} sub={fmtINRShort(open.reduce((a, f) => a + f.principal, 0))} />
        <KpiCard label="Matured, not closed" value={groups.find((g) => g.w === "matured")?.items.length ?? 0} warn />
        <KpiCard label="Actions past due" value={overdue.length} warn={overdue.length > 0} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map(({ w, items, value }) => (
          <Panel key={w} className={cn("min-h-40", WINDOW_TONE[w])} bodyClass="p-2">
            <div className="flex items-baseline justify-between px-1 pb-1">
              <h2 className="text-sm font-semibold">{WINDOW_LABEL[w]}</h2>
              <span className="text-[11px] text-muted-foreground"><span className="num font-semibold text-foreground">{items.length}</span> · {fmtINRShort(value)}</span>
            </div>
            {items.length === 0 ? (
              <p className="px-1 py-4 text-xs text-muted-foreground">No instruments in this window.</p>
            ) : (
              <div className="divide-y">
                {items.map((f) => <FdrRow key={f.id} f={f} />)}
              </div>
            )}
          </Panel>
        ))}
      </div>

      <Panel title="Reminder windows" className="mt-4 max-w-xl">
        <p className="text-xs text-muted-foreground">In-app reminders fire when an open instrument enters these windows before maturity. Email and push are not connected in this prototype.</p>
        <div className="mt-3 space-y-2.5">
          {[30, 15, 7, 1].map((d) => (
            <label key={d} className="flex items-center justify-between gap-3 text-sm">
              <span>{d === 1 ? "1 day before maturity" : `${d} days before maturity`}</span>
              <Switch checked={s.reminderDays.includes(d)} onCheckedChange={(on) => toggleReminder(d, on)} aria-label={`Toggle ${d} day reminder`} />
            </label>
          ))}
        </div>
        <GateNote role={s.role} min="approver" />
      </Panel>

      {overdue.length > 0 && (
        <Panel title="Past-due actions" className="mt-4" bodyClass="p-2">
          <div className="divide-y">
            {overdue.map((f) => <FdrRow key={f.id} f={f} />)}
          </div>
        </Panel>
      )}
    </>
  );
}
