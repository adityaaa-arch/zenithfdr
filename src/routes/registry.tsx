// @ts-nocheck
import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, Panel, Empty, LifecycleBadge, DaysChip } from "@/components/fdr/ui";
import { useStore } from "@/lib/fdr/store";
import { LIFECYCLES, openFlags, priorityScore, maturityWindow, WINDOW_LABEL, type MaturityWindow } from "@/lib/fdr/rules";
import { INSTITUTIONS, BANKS } from "@/lib/fdr/seed";
import { daysToMaturity, fmtDate, fmtINR } from "@/lib/fdr/format";

export const Route = createFileRoute("/registry")({
  validateSearch: (search: Record<string, unknown>) => ({ q: typeof search.q === "string" ? search.q : "" }),
  head: () => ({
    meta: [
      { title: "FDR Registry — ZenithFDR" },
      { name: "description", content: "Search, filter and inspect every fixed deposit receipt on record." },
      { property: "og:title", content: "FDR Registry — ZenithFDR" },
      { property: "og:description", content: "Search, filter and inspect every fixed deposit receipt on record." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Registry,
});

type Sort = "maturity" | "principal" | "score" | "recent";

function Registry() {
  const s = useStore((st) => st);
  const navigate = useNavigate();
  const initial = Route.useSearch({ select: (p) => p.q });
  const [q, setQ] = useState(initial);
  const [lifecycle, setLifecycle] = useState("all");
  const [institution, setInstitution] = useState("all");
  const [bank, setBank] = useState("all");
  const [sort, setSort] = useState<Sort>("maturity");

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    let list = s.fdrs.filter((f) =>
      (!t || [f.fdrNumber, f.ref, f.bank, f.institution].some((v) => v.toLowerCase().includes(t))) &&
      (lifecycle === "all" || f.lifecycle === lifecycle) &&
      (institution === "all" || f.institution === institution) &&
      (bank === "all" || f.bank === bank),
    );
    const score = (f) => priorityScore(f, s.releases, s.renewals).score;
    list = [...list].sort((a, b) => {
      if (sort === "principal") return b.principal - a.principal;
      if (sort === "score") return score(b) - score(a);
      if (sort === "recent") return b.submittedAt.localeCompare(a.submittedAt);
      return a.maturityDate.localeCompare(b.maturityDate);
    });
    return list;
  }, [s.fdrs, s.releases, s.renewals, q, lifecycle, institution, bank, sort]);

  const filtersActive = lifecycle !== "all" || institution !== "all" || bank !== "all";

  return (
    <>
      <PageHeader title="FDR Registry" subtitle={`${rows.length} of ${s.fdrs.length} instruments shown`}>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Number, reference, bank, institution…"
              className="h-9 pl-8"
              aria-label="Filter registry"
            />
          </div>
          <Select value={lifecycle} onValueChange={setLifecycle}>
            <SelectTrigger className="h-9 w-44" aria-label="Lifecycle filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All lifecycles</SelectItem>
              {LIFECYCLES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={institution} onValueChange={setInstitution}>
            <SelectTrigger className="h-9 w-52" aria-label="Institution filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All institutions</SelectItem>
              {INSTITUTIONS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={bank} onValueChange={setBank}>
            <SelectTrigger className="h-9 w-48" aria-label="Bank filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All banks</SelectItem>
              {BANKS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="h-9 w-44" aria-label="Sort order"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="maturity">Sort: maturity date</SelectItem>
              <SelectItem value="principal">Sort: principal</SelectItem>
              <SelectItem value="score">Sort: priority score</SelectItem>
              <SelectItem value="recent">Sort: recently submitted</SelectItem>
            </SelectContent>
          </Select>
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={() => { setLifecycle("all"); setInstitution("all"); setBank("all"); }}>
              Clear filters
            </Button>
          )}
        </div>
      </PageHeader>

      <Panel bodyClass="p-0">
        {rows.length === 0 ? (
          <div className="p-4"><Empty title="No instruments match" hint="Adjust the filters or search text." /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead className="hidden md:table-cell">Institution</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead className="hidden sm:table-cell">Rate</TableHead>
                <TableHead>Maturity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Flags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((f) => {
                const d = daysToMaturity(f.maturityDate);
                const w: MaturityWindow = maturityWindow(f);
                const flags = openFlags(f).length;
                return (
                  <TableRow
                    key={f.id}
                    onClick={() => navigate({ to: "/fdr/$id", params: { id: f.id } })}
                    className="cursor-pointer"
                  >
                    <TableCell>
                      <span className="num block text-[13px] font-medium">{f.ref}</span>
                      <span className="num block text-xs text-muted-foreground">{f.fdrNumber}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="block text-xs">{f.institution}</span>
                      <span className="block text-xs text-muted-foreground">{f.bank}</span>
                    </TableCell>
                    <TableCell className="num text-xs">{fmtINR(f.principal)}</TableCell>
                    <TableCell className="num hidden text-xs sm:table-cell">{f.rate.toFixed(2)}%</TableCell>
                    <TableCell>
                      <span className="num block text-xs">{fmtDate(f.maturityDate)}</span>
                      <DaysChip d={d} closed={f.lifecycle === "Renewed" || f.lifecycle === "Closed" || f.lifecycle === "Released"} />
                      <span className="sr-only">{WINDOW_LABEL[w]}</span>
                    </TableCell>
                    <TableCell><LifecycleBadge s={f.lifecycle} /></TableCell>
                    <TableCell className="text-right">
                      {flags > 0
                        ? <span className="num rounded bg-warning-soft px-1.5 py-0.5 text-xs font-semibold text-warning">{flags}</span>
                        : <span className="num text-xs text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
      <p className="mt-2 text-[11px] text-muted-foreground">Click a row to open the instrument. Data lives in this browser for the demo and resets from the profile menu.</p>
    </>
  );
}
