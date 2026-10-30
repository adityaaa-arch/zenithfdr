// @ts-nocheck
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Table2, ScanLine, Radar, ShieldCheck, RefreshCcw, HandCoins, FileArchive, BarChart3, Users, Bell, Search,
  ChevronsLeft, ChevronsRight, Bot, RotateCcw, BookOpen, LogOut, Settings, Menu, Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { actions, hydrateStore, useStore } from "@/lib/fdr/store";
import { ROLE_LABEL, ROLE_USER } from "@/lib/fdr/seed";
import { fmtDateTime } from "@/lib/fdr/format";
import type { Role } from "@/lib/fdr/types";
import { AssistantPanel } from "./Assistant";
import { LifecycleBadge } from "./ui";

const NAV = [
  { to: "/", label: "Command Center", icon: LayoutDashboard },
  { to: "/registry", label: "FDR Registry", icon: Table2 },
  { to: "/scanner", label: "Smart Scanner", icon: ScanLine },
  { to: "/radar", label: "Maturity Radar", icon: Radar },
  { to: "/verification", label: "Verification Queue", icon: ShieldCheck },
  { to: "/renewals", label: "Renewals & Replacements", icon: RefreshCcw },
  { to: "/releases", label: "Release & Refunds", icon: HandCoins },
  { to: "/dossiers", label: "Audit Dossiers", icon: FileArchive },
  { to: "/reports", label: "Reports & Analytics", icon: BarChart3 },
  { to: "/users", label: "User Management", icon: Users },
] as const;

const GUIDE = [
  ["Command Center", "Spot an FDR maturing soon in the Maturity Radar or Priority Action Queue."],
  ["Smart Scanner", "Load the sample document and run the demo extraction."],
  ["Verification step", "Notice the duplicate-number and amount-mismatch flags with exact reasons."],
  ["Verification Queue", "Open the case and resolve or escalate each discrepancy with remarks."],
  ["Renewals", "Create a renewal from an FDR and view the old → new relationship chain."],
  ["FDR Detail", "Review the lifecycle timeline and approval history."],
  ["Audit Dossier", "Generate and download the PDF dossier for the instrument."],
];

function Sidebar({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const counts = useStore((s) => ({
    ver: s.fdrs.filter((f) => ["Submitted", "Under Scrutiny", "Correction Requested"].includes(f.lifecycle)).length,
  }));
  return (
    <nav className="flex h-full flex-col bg-sidebar text-sidebar-foreground" aria-label="Main">
      <div className={cn("flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4", collapsed && "justify-center px-0")}>
        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">Z</div>
        {!collapsed && (
          <div className="leading-tight">
            <p className="text-sm font-semibold text-sidebar-accent-foreground">ZenithFDR</p>
            <p className="text-[10px] uppercase tracking-wider text-sidebar-muted">FDR Management System</p>
          </div>
        )}
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {NAV.map((n) => {
          const active = n.to === "/" ? path === "/" : path.startsWith(n.to) || (n.to === "/registry" && path.startsWith("/fdr"));
          return (
            <li key={n.to}>
              <Link
                to={n.to}
                onClick={onNavigate}
                title={collapsed ? n.label : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-[inset_2px_0_0_var(--sidebar-primary)]",
                  collapsed && "justify-center",
                )}
              >
                <n.icon className="size-4 shrink-0" />
                {!collapsed && <span className="flex-1 truncate">{n.label}</span>}
                {!collapsed && n.to === "/verification" && counts.ver > 0 && <span className="num rounded bg-sidebar-primary px-1.5 text-[10px] text-sidebar-primary-foreground">{counts.ver}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
      {!collapsed && (
        <div className="border-t border-sidebar-border p-3 text-[10px] leading-relaxed text-sidebar-muted">
          Prototype. Role permissions are simulated in the browser and are not production-grade security.
        </div>
      )}
    </nav>
  );
}

function crumbs(path: string, fdrRef?: string) {
  const item = NAV.find((n) => n.to !== "/" && path.startsWith(n.to));
  if (path === "/") return ["Command Center"];
  if (path.startsWith("/fdr/")) return ["FDR Registry", fdrRef ?? "Detail"];
  if (path.startsWith("/assistant")) return ["Ask Your Records"];
  return [item?.label ?? "Page"];
}

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const fdrs = useStore((s) => s.fdrs);
  const navigate = useNavigate();
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return fdrs.filter((f) => [f.fdrNumber, f.ref, f.bank, f.institution].some((v) => v.toLowerCase().includes(t))).slice(0, 8);
  }, [q, fdrs]);
  return (
    <Popover open={open && q.length > 0} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => { setQ(e.target.value); setOpen(true); }}
            onKeyDown={(e) => { if (e.key === "Enter" && results[0]) { navigate({ to: "/fdr/$id", params: { id: results[0].id } }); setOpen(false); setQ(""); } }}
            placeholder="Search FDR number, bank, institution, reference"
            className="h-8 pl-8 text-sm"
            aria-label="Global search"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] min-w-80 p-1" onOpenAutoFocus={(e) => e.preventDefault()}>
        {results.length === 0 ? <p className="px-3 py-4 text-center text-xs text-muted-foreground">No matching records</p> : results.map((f) => (
          <button key={f.id} onClick={() => { navigate({ to: "/fdr/$id", params: { id: f.id } }); setOpen(false); setQ(""); }} className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent">
            <span><span className="num font-medium">{f.fdrNumber}</span> <span className="text-muted-foreground">{f.ref} · {f.institution}</span></span>
            <LifecycleBadge s={f.lifecycle} />
          </button>
        ))}
        <Link to="/registry" search={{ q }} onClick={() => setOpen(false)} className="block border-t px-2 py-1.5 text-xs text-primary hover:underline">View all in registry</Link>
      </PopoverContent>
    </Popover>
  );
}

function Notifications() {
  const notices = useStore((s) => s.notices);
  const unread = notices.filter((n) => !n.read).length;
  const navigate = useNavigate();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${unread} unread`}>
          <Bell />
          {unread > 0 && <span className="num absolute right-1 top-1 grid size-4 place-items-center rounded-full bg-critical text-[9px] text-destructive-foreground">{unread}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <button className="text-xs text-primary hover:underline" onClick={() => actions.markRead()}>Mark all read</button>
        </div>
        <ul className="max-h-96 divide-y overflow-y-auto">
          {notices.length === 0 && <li className="p-4 text-center text-xs text-muted-foreground">No notifications</li>}
          {notices.slice(0, 20).map((n) => (
            <li key={n.id}>
              <button
                className={cn("flex w-full gap-2 px-3 py-2.5 text-left hover:bg-accent", !n.read && "bg-info-soft/60")}
                onClick={() => { actions.markRead(n.id); if (n.fdrId) navigate({ to: "/fdr/$id", params: { id: n.fdrId } }); }}
              >
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} />
                <span className="flex-1">
                  <span className="block text-xs font-medium">{n.title}</span>
                  <span className="block text-xs text-muted-foreground">{n.body}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{fmtDateTime(n.at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t px-3 py-2 text-[10px] text-muted-foreground">In-app reminders only. Email and push notifications are not connected in this prototype.</p>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [guide, setGuide] = useState(false);
  const role = useStore((s) => s.role);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const fdrRef = useStore((s) => (path.startsWith("/fdr/") ? s.fdrs.find((f) => f.id === path.split("/")[2])?.ref : undefined));

  useEffect(() => { hydrateStore(); }, []);
  useEffect(() => {
    const h = () => setGuide(true);
    window.addEventListener("zenith:guide", h);
    return () => window.removeEventListener("zenith:guide", h);
  }, []);

  const bc = crumbs(path, fdrRef);
  const name = ROLE_USER[role];

  return (
    <div className="flex min-h-screen">
      <aside className={cn("no-print sticky top-0 hidden h-screen shrink-0 transition-[width] md:block", collapsed ? "w-16" : "w-60")}>
        <Sidebar collapsed={collapsed} />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 border-0 p-0">
          <SheetHeader className="sr-only"><SheetTitle>Navigation</SheetTitle><SheetDescription>Main navigation</SheetDescription></SheetHeader>
          <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card px-3 md:px-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu /></Button>
          <Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
          </Button>
          <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-xs text-muted-foreground lg:flex">
            <span>ZenithFDR</span>
            {bc.map((b, i) => (
              <span key={b} className="flex items-center gap-1.5"><span>/</span><span className={cn(i === bc.length - 1 && "font-medium text-foreground")}>{b}</span></span>
            ))}
          </nav>
          <div className="flex flex-1 justify-center px-2"><GlobalSearch /></div>
          <button onClick={() => setResetOpen(true)} className="hidden items-center gap-1.5 rounded-full border border-warning/30 bg-warning-soft px-2.5 py-0.5 text-[11px] font-medium text-warning sm:flex" title="Demo mode — click to reset data">
            <span className="size-1.5 rounded-full bg-warning" /> Demo Mode
          </button>
          <Button variant="ghost" size="icon" onClick={() => setAssistant(true)} aria-label="Open records assistant"><Bot /></Button>
          <Notifications />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-accent" aria-label="Profile menu">
                <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">{name.replace("Dr. ", "").split(" ").map((p) => p[0]).join("")}</span>
                <span className="hidden text-left leading-tight xl:block">
                  <span className="block text-xs font-medium">{name}</span>
                  <span className="block text-[10px] text-muted-foreground">{ROLE_LABEL[role]}</span>
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="text-xs">Switch demo role</DropdownMenuLabel>
              {(["operator", "reviewer", "approver"] as Role[]).map((r) => (
                <DropdownMenuItem key={r} onClick={() => { actions.setRole(r); toast.success(`Now acting as ${ROLE_LABEL[r]}`, { description: ROLE_USER[r] }); }}>
                  <Check className={cn("size-4", role !== r && "opacity-0")} />
                  <span className="flex-1">{ROLE_LABEL[r]}</span>
                  <span className="text-[10px] text-muted-foreground">{ROLE_USER[r]}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setGuide(true)}><BookOpen /> Demo walkthrough</DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/users"><Settings /> Settings & users</Link></DropdownMenuItem>
              <DropdownMenuItem onClick={() => setResetOpen(true)}><RotateCcw /> Reset demo data</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toast("Sign-out is simulated in this prototype", { description: "There is no real session to end." })}><LogOut /> Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 px-3 py-5 md:px-6 animate-in fade-in duration-200" key={path}>{children}</main>
      </div>

      <Sheet open={assistant} onOpenChange={setAssistant}>
        <SheetContent className="flex w-full flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Ask Your Records</SheetTitle>
            <SheetDescription>Rule-based answers from the demo dataset. <Link to="/assistant" onClick={() => setAssistant(false)} className="text-primary hover:underline">Open full panel</Link></SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 px-4 pb-4"><AssistantPanel onNavigate={() => setAssistant(false)} /></div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset demo data?</AlertDialogTitle>
            <AlertDialogDescription>All records, decisions and activity created in this browser will be replaced with the original sample dataset.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { actions.reset(); toast.success("Demo data reset to original state"); }}>Reset data</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={guide} onOpenChange={setGuide}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Demo walkthrough</DialogTitle>
            <DialogDescription>Suggested judging sequence. Nothing is changed automatically — you perform each step.</DialogDescription>
          </DialogHeader>
          <ol className="space-y-2.5">
            {GUIDE.map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-info-soft text-xs font-semibold text-primary">{i + 1}</span>
                <span><span className="block text-sm font-medium">{t}</span><span className="block text-xs text-muted-foreground">{d}</span></span>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">Tip: switch roles from the profile menu to see operator, reviewer and approver actions.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
