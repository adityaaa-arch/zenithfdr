// @ts-nocheck
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Panel, DemoNote } from "@/components/fdr/ui";
import { useStore, actions } from "@/lib/fdr/store";
import { can } from "@/lib/fdr/access";
import { INSTITUTIONS, ROLE_LABEL } from "@/lib/fdr/seed";
import type { AppUser, Role } from "@/lib/fdr/types";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "User Management — ZenithFDR" },
      { name: "description", content: "Demo users, their roles and simulated permissions for the FDR workflow." },
      { property: "og:title", content: "User Management — ZenithFDR" },
      { property: "og:description", content: "Demo users, roles and simulated permissions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Users,
});

const INSTITUTION_OPTS = [...INSTITUTIONS, "Finance Department"];

function Users() {
  const s = useStore((st) => st);
  const approver = can(s.role, "approver");
  const [editing, setEditing] = useState<AppUser | "new" | null>(null);

  return (
    <>
      <PageHeader
        title="User Management"
        subtitle="Demo accounts per role. Permissions are simulated in the browser — this is not production-grade access control."
        actions={<Button size="sm" disabled={!approver} onClick={() => setEditing("new")}><Plus /> Add user</Button>}
      />

      <Panel bodyClass="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden sm:table-cell">Institution</TableHead>
              <TableHead className="text-right">Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {s.users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="text-sm font-medium">
                  {u.name}
                  {ROLE_USER_IS(u) && <span className="ml-2 rounded bg-info-soft px-1.5 py-0.5 text-[10px] text-primary">you</span>}
                </TableCell>
                <TableCell className="num hidden text-xs text-muted-foreground md:table-cell">{u.email}</TableCell>
                <TableCell className="text-xs">{ROLE_LABEL[u.role]}</TableCell>
                <TableCell className="hidden text-xs sm:table-cell">{u.institution}</TableCell>
                <TableCell className="text-right">
                  <Switch
                    checked={u.active}
                    disabled={!approver}
                    onCheckedChange={() => { actions.toggleUser(u.id); toast.success(u.active ? "User deactivated" : "User activated"); }}
                    aria-label={`Toggle ${u.name}`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
      {!approver && <p className="mt-2 text-[11px] text-muted-foreground">Editing users needs the {ROLE_LABEL.approver} demo role — switch roles from the profile menu.</p>}

      <Panel title="Simulated permission matrix" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Capability</th>
                <th className="py-2 pr-4 font-medium">Institution Operator</th>
                <th className="py-2 pr-4 font-medium">Review Officer</th>
                <th className="py-2 font-medium">Approving Authority</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ["Register FDRs, upload documents, resubmit corrections", true, true, true],
                ["Scrutiny, flag decisions, officer assignment", false, true, true],
                ["Recommend renewals & releases", false, true, true],
                ["Approve / reject renewals & releases, close instruments", false, false, true],
                ["Manage users & reminder windows", false, false, true],
              ].map(([label, o, r, a]) => (
                <tr key={label as string}>
                  <td className="py-2 pr-4">{label}</td>
                  <td className="py-2 pr-4">{o ? "✓" : "—"}</td>
                  <td className="py-2 pr-4">{r ? "✓" : "—"}</td>
                  <td className="py-2">{a ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DemoNote>The profile menu switches your demo persona; every decision is attributed to the persona active at the time.</DemoNote>
      </Panel>

      {editing && <UserDialog key={editing === "new" ? "new" : editing.id} user={editing} onDone={() => setEditing(null)} />}
    </>
  );
}

function ROLE_USER_IS(u: AppUser) {
  return u.name === "Priya Nair" || u.name === "Rahul Iyer" || u.name === "Dr. Meera Kulkarni";
}

function UserDialog({ user, onDone }: { user: AppUser | "new" | null; onDone: () => void }) {
  const blank: AppUser = { id: "", name: "", email: "", role: "operator", institution: INSTITUTION_OPTS[0], active: true };
  const [form, setForm] = useState<AppUser>(user && user !== "new" ? user : blank);
  const isNew = user === "new";

  const save = () => {
    const u = isNew ? { ...form, id: `u-${Math.random().toString(36).slice(2, 7)}` } : form;
    actions.upsertUser(u);
    toast.success(isNew ? "User added" : "User updated");
    onDone();
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onDone()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add user" : "Edit user"}</DialogTitle>
          <DialogDescription>Demo account only — no real authentication is wired up in this prototype.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="space-y-1"><Label>Role</Label>
            <Select value={form.role} onValueChange={(v: Role) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(["operator", "reviewer", "approver"] as Role[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Institution</Label>
            <Select value={form.institution} onValueChange={(v) => setForm({ ...form, institution: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INSTITUTION_OPTS.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onDone}>Cancel</Button>
          <Button disabled={!form.name.trim() || !form.email.trim()} onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
