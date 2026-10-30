// @ts-nocheck
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Send, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ask, EXAMPLES, type Answer } from "@/lib/fdr/assistant";
import { getState } from "@/lib/fdr/store";
import { daysToMaturity, fmtDate, fmtINR } from "@/lib/fdr/format";
import { LifecycleBadge } from "./ui";

interface Turn { q: string; a: Answer }

export function AssistantPanel({ onNavigate }: { onNavigate?: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const run = (query: string) => {
    if (!query.trim()) return;
    setTurns((t) => [...t, { q: query, a: ask(query, getState()) }]);
    setQ("");
  };
  return (
    <div className="flex h-full flex-col">
      <div className="rounded-md border border-warning/25 bg-warning-soft px-3 py-2 text-[11px] text-warning">
        Answers are computed by fixed rules from demo records — no language model is connected. A production deployment must respect the signed-in user's permissions and keep answers auditable.
      </div>
      <div className="mt-3 flex-1 space-y-4 overflow-y-auto pr-1">
        {turns.length === 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Try asking</p>
            <div className="flex flex-col gap-1.5">
              {EXAMPLES.map((e) => (
                <button key={e} onClick={() => run(e)} className="rounded-md border bg-card px-3 py-2 text-left text-sm hover:border-primary/40 hover:bg-accent">{e}</button>
              ))}
            </div>
          </div>
        )}
        {turns.map((t, i) => (
          <div key={i} className="space-y-2">
            <div className="ml-auto w-fit max-w-[90%] rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">{t.q}</div>
            <div className="rounded-md border bg-card p-3 text-sm">
              <div className="flex gap-2"><Bot className="mt-0.5 size-4 shrink-0 text-teal" /><p>{t.a.text}</p></div>
              <p className="mt-2 text-[11px] text-muted-foreground"><span className="font-medium">How this was computed:</span> {t.a.method}</p>
              {t.a.records.length > 0 && (
                <ul className="mt-2 divide-y rounded border">
                  {t.a.records.slice(0, 8).map((f) => (
                    <li key={f.id}>
                      <Link to="/fdr/$id" params={{ id: f.id }} onClick={onNavigate} className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs hover:bg-accent">
                        <span><span className="num font-medium text-primary">{f.fdrNumber}</span> <span className="text-muted-foreground">· {f.institution}</span></span>
                        <span className="flex shrink-0 items-center gap-2"><span className="num">{fmtINR(f.principal)}</span><span className="text-muted-foreground">{fmtDate(f.maturityDate)} ({daysToMaturity(f.maturityDate)}d)</span><LifecycleBadge s={f.lifecycle} /></span>
                      </Link>
                    </li>
                  ))}
                  {t.a.records.length > 8 && <li className="px-2 py-1.5 text-xs text-muted-foreground">+{t.a.records.length - 8} more</li>}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {t.a.followUps.map((f) => <button key={f} onClick={() => run(f)} className="rounded-full border px-2 py-0.5 text-[11px] hover:bg-accent">{f}</button>)}
              </div>
            </div>
          </div>
        ))}
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); run(q); }}>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your FDR records…" aria-label="Ask a question" />
        <Button type="submit" size="icon" aria-label="Send"><Send /></Button>
      </form>
    </div>
  );
}
