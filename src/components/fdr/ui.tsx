// @ts-nocheck
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { LIFECYCLE_TONE, VERIFICATION_TONE, scoreTone, type ScoreFactor, type Tone } from "@/lib/fdr/rules";
import type { Lifecycle, Verification } from "@/lib/fdr/types";
import { relDays } from "@/lib/fdr/format";

export function ToneBadge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <Badge variant={tone} className={className}>
      {children}
    </Badge>
  );
}

export const LifecycleBadge = ({ s }: { s: Lifecycle }) => <ToneBadge tone={LIFECYCLE_TONE[s]}>{s}</ToneBadge>;
export const VerificationBadge = ({ s }: { s: Verification }) => <ToneBadge tone={VERIFICATION_TONE[s]}>{s.replace("Issuer Verification ", "Issuer ")}</ToneBadge>;

export function DaysChip({ d, closed }: { d: number; closed?: boolean }) {
  if (closed) return <span className="num text-xs text-muted-foreground">—</span>;
  const tone = d < 0 ? "text-critical font-semibold" : d <= 7 ? "text-critical" : d <= 15 ? "text-warning" : d <= 30 ? "text-foreground" : "text-muted-foreground";
  return <span className={cn("num text-xs", tone)}>{relDays(d)}</span>;
}

export function ScoreBadge({ score, factors }: { score: number; factors?: ScoreFactor[] }) {
  const tone = scoreTone(score);
  const cls = { critical: "bg-critical text-destructive-foreground", warning: "bg-warning text-primary-foreground", info: "bg-info-soft text-primary", neutral: "bg-muted text-muted-foreground", success: "", teal: "" }[tone];
  const chip = <span className={cn("num inline-flex h-6 min-w-9 items-center justify-center rounded px-1.5 text-xs font-semibold", cls)}>{score}</span>;
  if (!factors) return chip;
  return (
    <HoverCard openDelay={100}>
      <HoverCardTrigger asChild>
        <button type="button" aria-label={`Priority score ${score}, show factors`}>{chip}</button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 text-xs">
        <p className="mb-2 font-semibold">Why score {score}?</p>
        {factors.length === 0 ? <p className="text-muted-foreground">No contributing factors.</p> : (
          <ul className="space-y-1">
            {factors.map((f) => (
              <li key={f.label} className="flex justify-between gap-2"><span>{f.label}</span><span className="num text-muted-foreground">+{f.points}</span></li>
            ))}
          </ul>
        )}
        <p className="mt-2 border-t pt-2 text-muted-foreground">Operational prioritisation aid — not a credit rating, fraud probability or risk prediction.</p>
      </HoverCardContent>
    </HoverCard>
  );
}

export function PageHeader({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className, bodyClass }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cn("panel flex flex-col", className)}>
      {title && (
        <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      <div className={cn("p-4", bodyClass)}>{children}</div>
    </section>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed px-4 py-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function DemoNote({ children }: { children: ReactNode }) {
  return <p className="text-[11px] text-muted-foreground">{children}</p>;
}

/** Dialog that requires remarks before confirming. */
export function RemarksDialog({
  open, onOpenChange, title, description, confirmLabel, destructive, required = true, onConfirm, children,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; confirmLabel: string; destructive?: boolean; required?: boolean;
  onConfirm: (remarks: string) => void; children?: ReactNode;
}) {
  const [remarks, setRemarks] = useState("");
  const [err, setErr] = useState("");
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setRemarks(""); setErr(""); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <div className="space-y-1.5">
          <Label htmlFor="remarks">Remarks{required && " (mandatory)"}</Label>
          <Textarea id="remarks" value={remarks} onChange={(e) => { setRemarks(e.target.value); setErr(""); }} rows={3} placeholder="Record the basis for this decision" />
          {err && <p className="text-xs text-critical">{err}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => {
              if (required && remarks.trim().length < 5) return setErr("Please enter at least 5 characters of remarks.");
              onConfirm(remarks.trim());
              setRemarks("");
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}
