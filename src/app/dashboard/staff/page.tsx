"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Search, Trash2, ShieldAlert } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { useDashboard } from "@/lib/dashboard-context";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { PageHeader, TableHead, TableShell } from "@/components/ui/layout";
import { StaffFormModal } from "@/components/dashboard/staff-form";
import { initials } from "@/lib/utils";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Role = Profile["role"];

const ROLE_ORDER: Role[] = ["super_admin", "admin", "teacher", "staff"];

export default function StaffPage() {
  const { t, lang } = useLang();
  const { profile, user, isSuperAdmin } = useDashboard();

  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .in("role", ["super_admin", "admin", "teacher", "staff"])
      .order("role")
      .order("first_name");
    setMembers(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members.filter(
      (m) =>
        !needle ||
        `${m.first_name} ${m.last_name}`.toLowerCase().includes(needle) ||
        m.email.toLowerCase().includes(needle) ||
        `${m.role}`.includes(needle)
    );
  }, [members, query]);

  const changeRole = async (member: Profile, role: Role) => {
    if (role === member.role) return;
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: member.id, role }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.message ?? t("common.error"));
      return;
    }
    toast.success(t("sf.roleUpdated"));
    load();
  };

  const remove = async (member: Profile) => {
    if (member.role === "super_admin") return;
    if (!window.confirm(`${t("common.deleteConfirm")}: ${member.email}?`)) return;
    const res = await fetch("/api/staff", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: member.id }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.message ?? t("common.error"));
      return;
    }
    toast.success(t("sf.deleted"));
    load();
  };

  const roleTone = (role: Role) =>
    role === "super_admin" ? "violet" : role === "admin" ? "royal" : role === "teacher" ? "green" : "amber";

  if (loading) {
    return <div className="py-24 text-center text-sm text-slate-400">{t("common.loading")}</div>;
  }

  const sorted = [...filtered].sort(
    (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role)
  );

  return (
    <div>
      <PageHeader
        title={t("sf.title")}
        subtitle={t("sf.subtitle")}
        actions={
          isSuperAdmin ? (
            <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
              <Plus className="h-4 w-4" aria-hidden />
              {t("sf.add")}
            </Button>
          ) : undefined
        }
      />

      {!isSuperAdmin && profile?.role === "admin" && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
          {t("sf.superAdminOnly")}
        </div>
      )}

      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${t("common.search")}…`}
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/30"
          />
        </div>
      </div>

      <TableShell>
        <TableHead>
          <tr>
            <th className="px-4 py-3 font-semibold">{lang === "en" ? "Member" : "አባል"}</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">{t("sf.email")}</th>
            <th className="px-4 py-3 font-semibold">
              {lang === "en" ? "Role" : "ሚና"}
            </th>
            {isSuperAdmin && (
              <th className="px-4 py-3 text-right font-semibold">{t("common.actions")}</th>
            )}
          </tr>
        </TableHead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((member) => {
            const self = member.id === user?.id;
            return (
              <tr key={member.id} className="transition hover:bg-royal-50/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {member.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={member.avatar_url}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white"
                      />
                    ) : (
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-royal-100 text-xs font-bold text-royal-800">
                        {initials(member.first_name, member.last_name)}
                      </span>
                    )}
                    <div>
                      <p className="font-bold text-slate-900">
                        {[member.first_name, member.last_name].filter(Boolean).join(" ") || "—"}
                      </p>
                      <p className="text-xs text-slate-400 md:hidden">{member.email}</p>
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                  {member.email}
                </td>
                <td className="px-4 py-3">
                  {isSuperAdmin && member.role !== "super_admin" && !self ? (
                    <Select
                      value={member.role}
                      onChange={(e) => changeRole(member, e.target.value as Role)}
                      className="h-9 w-40"
                    >
                      <option value="admin">{t("role.admin")}</option>
                      <option value="teacher">{t("role.teacher")}</option>
                      <option value="staff">{t("role.staff")}</option>
                    </Select>
                  ) : (
                    <Badge tone={roleTone(member.role)}>
                      {t(`role.${member.role}`)}
                      {self ? ` · ${lang === "en" ? "You" : "እርስዎ"}` : ""}
                    </Badge>
                  )}
                </td>
                {isSuperAdmin && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditing(member); setModalOpen(true); }}
                        disabled={self}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-royal-50 hover:text-royal-700 disabled:cursor-not-allowed disabled:opacity-40"
                        title={t("common.edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(member)}
                        disabled={self || member.role === "super_admin"}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                        title={t("common.delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </TableShell>

      {sorted.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-400">{t("sf.noStaff")}</p>
      )}

      <StaffFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        member={editing}
        onSaved={load}
      />
    </div>
  );
}