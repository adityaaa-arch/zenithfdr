// @ts-nocheck
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { LifecycleBadge, ScoreBadge } from "./ui";
import { daysToMaturity, fmtDate, fmtINR } from "@/lib/fdr/format";
import { priorityScore } from "@/lib/fdr/rules";
import type { FDR, ReleaseRequest, RenewalRequest } from "@/lib/fdr/types";

export function KpiCard({ label, value, sub, warn, to }: { label: string; value: ReactNode; sub?: ReactNode; warn?: boolean; to?: string }) {
  const body = (
    <div className={cn("panel px-4 py-3.5", warn && "border-warning/40", to && "transition-colors hover:border-primary/40")}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("num mt-1 text-xl font-semibold", warn && "text-warning")}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
  return to ? <Link to={to} className="block">{body}</Link> : body;
}

const TONE_CLS: Record<string, string> = {
  critical: "bg-critical",
  warning: "bg-warning",
  info: "bg-primary",
  neutral: "bg-muted-foreground/50",
  success: "bg-success",
};

export function BarRow({ label, value, max, right, tone = "info", to }: { label: string; value: number; max: number; right?: ReactNode; tone?: string; to?: string }) {
  const pct = max > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0;
  const row = (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate">{label}</span>
        {right !== undefined && <span className="num shrink-0 text-muted-foreground">{right}</span>}
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className={cn("h-2 rounded-full", TONE_CLS[tone] ?? TONE_CLS.info)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
  return to ? <Link to={to} className="block rounded hover:bg-accent/60">{row}</Link> : row;
}

export function GateNote({ role, min }: { role: string; min: "operator" | "reviewer" | "approver" }) {
  const RANK = { operator: 1, reviewer: 2, approver: 3 };
  if (RANK[role] >= RANK[min]) return null;
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Lock className="size-3" /> Action needs a higher demo role — switch roles from the profile menu.
    </p>
  );
}

/** Compact row for an FDR, used in the priority queue and radar panels. */
export function FdrRow({ f }: { f: FDR }) {
  const d = daysToMaturity(f.maturityDate);
  return (
    <Link
      to="/fdr/$id"
      params={{ id: f.id }}
      className="flex items-center gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-accent"
    >
      <ScoreBadge score={priorityScore(f, [], []).score} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="num text-[13px] font-medium">{f.ref}</span>
          <span className="num text-xs text-muted-foreground">{f.fdrNumber}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">{f.institution} · {f.bank}</span>
      </span>
      <span className="hidden w-24 shrink-0 text-right text-xs md:block">
        <span className="num block">{fmtINR(f.principal)}</span>
      </span>
      <span className="w-28 shrink-0 text-right text-xs">
        <span className="num block">{fmtDate(f.maturityDate)}</span>
        <DaysChipInline d={d} closed={f.lifecycle === "Renewed" || f.lifecycle === "Closed" || f.lifecycle === "Released"} />
      </span>
      <span className="hidden shrink-0 lg:block"><LifecycleBadge s={f.lifecycle} /></span>
    </Link>
  );
}

function DaysChipInline({ d, closed }: { d: number; closed?: boolean }) {
  if (closed) return <span className="num text-[10px] text-muted-foreground">closed</span>;
  return <span className={cn("num text-[10px]", d < 0 ? "text-critical font-semibold" : d <= 7 ? "text-critical" : d <= 15 ? "text-warning" : "text-muted-foreground")}>{d < 0 ? `${-d}d overdue` : `${d}d left`}</span>;
}

export function relationshipLabel(r: ReleaseRequest | RenewalRequest) {
  return r.ref;
}
