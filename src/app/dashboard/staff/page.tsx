"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Globe,
  GripVertical,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { useDashboard } from "@/lib/dashboard-context";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { PageHeader, TableHead, TableShell } from "@/components/ui/layout";
import { StaffFormModal } from "@/components/dashboard/staff-form";
import { cn, initials } from "@/lib/utils";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type Role = Profile["role"];

const ROLE_ORDER: Role[] = ["super_admin", "admin", "teacher", "staff"];

function OrderCell({
  member,
  isSuperAdmin,
  onUpdateOrder,
}: {
  member: Profile;
  isSuperAdmin: boolean;
  onUpdateOrder: (member: Profile, newOrder: number) => Promise<void>;
}) {
  const [val, setVal] = useState(member.display_order ?? 100);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setVal(member.display_order ?? 100);
  }, [member.display_order]);

  const commit = async (newVal: number) => {
    const parsed = Math.max(1, Math.min(999, newVal));
    if (parsed === member.display_order || isNaN(parsed)) return;
    setSaving(true);
    await onUpdateOrder(member, parsed);
    setSaving(false);
  };

  if (!isSuperAdmin) {
    return (
      <span className="inline-flex h-7 w-8 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600">
        {member.display_order}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input
        type="number"
        min={1}
        max={999}
        value={val}
        onChange={(e) => setVal(parseInt(e.target.value) || 1)}
        onBlur={() => commit(val)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        disabled={saving}
        className="h-7 w-12 rounded-lg border border-slate-300 bg-white px-1 text-center text-xs font-bold text-slate-800 shadow-sm transition hover:border-royal-400 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20 disabled:opacity-50"
        title="Directly assign position (1, 2, 3...)"
      />

      <div className="flex flex-col">
        <button
          type="button"
          onClick={() => {
            const next = Math.max(1, (member.display_order ?? 100) - 1);
            setVal(next);
            commit(next);
          }}
          disabled={saving || (member.display_order ?? 100) <= 1}
          className="flex h-3 w-3.5 items-center justify-center rounded text-slate-400 hover:bg-royal-50 hover:text-royal-700 disabled:opacity-20"
          title="Move up (-1)"
        >
          <ChevronUp className="h-2.5 w-2.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            const next = (member.display_order ?? 100) + 1;
            setVal(next);
            commit(next);
          }}
          disabled={saving}
          className="flex h-3 w-3.5 items-center justify-center rounded text-slate-400 hover:bg-royal-50 hover:text-royal-700 disabled:opacity-20"
          title="Move down (+1)"
        >
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}

export default function StaffPage() {
  const { t, lang } = useLang();
  const { profile, user, isSuperAdmin } = useDashboard();

  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filterSection, setFilterSection] = useState<"all" | "core" | "contributor">("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);

  // Drag and drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

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
      .order("display_order", { ascending: true })
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
    return members
      .filter((m) => {
        if (filterSection === "core" && (!m.is_public || m.section === "contributor")) return false;
        if (filterSection === "contributor" && (!m.is_public || m.section !== "contributor")) return false;
        if (!needle) return true;
        return (
          `${m.first_name} ${m.last_name}`.toLowerCase().includes(needle) ||
          m.email.toLowerCase().includes(needle) ||
          `${m.role}`.includes(needle) ||
          `${m.profession || ""}`.toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => {
        const orderA = a.display_order ?? 100;
        const orderB = b.display_order ?? 100;
        if (orderA !== orderB) return orderA - orderB;
        const roleA = ROLE_ORDER.indexOf(a.role);
        const roleB = ROLE_ORDER.indexOf(b.role);
        const diff = (roleA === -1 ? 99 : roleA) - (roleB === -1 ? 99 : roleB);
        if (diff !== 0) return diff;
        return (a.first_name || "").localeCompare(b.first_name || "");
      });
  }, [members, query, filterSection]);

  const updateSingleOrder = async (member: Profile, newOrder: number) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === member.id ? { ...m, display_order: newOrder } : m))
    );
    const res = await fetch("/api/staff", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: member.id, display_order: newOrder }),
    });
    if (!res.ok) {
      toast.error(t("common.error"));
      load();
    } else {
      const name =
        [member.first_name, member.last_name].filter(Boolean).join(" ") ||
        member.email;
      toast.success(
        lang === "en"
          ? `Updated order for ${name} to #${newOrder}`
          : `የ${name} ቅደም ተከተል ወደ #${newOrder} ተቀናብሯል`
      );
    }
  };

  const handleDrop = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const currentList = [...filtered];
    const fromIndex = currentList.findIndex((m) => m.id === draggedId);
    const toIndex = currentList.findIndex((m) => m.id === targetId);

    if (fromIndex === -1 || toIndex === -1) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const [moved] = currentList.splice(fromIndex, 1);
    currentList.splice(toIndex, 0, moved);

    const reorderPayload: Array<{ id: string; display_order: number }> = [];
    const updatedMap = new Map<string, number>();

    currentList.forEach((m, idx) => {
      const newOrder = idx + 1;
      if (m.display_order !== newOrder) {
        reorderPayload.push({ id: m.id, display_order: newOrder });
        updatedMap.set(m.id, newOrder);
      }
    });

    // Optimistically update
    setMembers((prev) =>
      prev.map((m) =>
        updatedMap.has(m.id) ? { ...m, display_order: updatedMap.get(m.id)! } : m
      )
    );

    setDraggedId(null);
    setDragOverId(null);

    if (reorderPayload.length === 0) return;

    try {
      const res = await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reorder: reorderPayload }),
      });
      if (!res.ok) {
        toast.error(t("common.error"));
        load();
      } else {
        toast.success(
          lang === "en"
            ? `Moved ${moved.first_name || "member"} to #${toIndex + 1}`
            : `የ${moved.first_name || "አባል"} ቅደም ተከተል ወደ #${toIndex + 1} ተቀይሯል`
        );
      }
    } catch {
      toast.error(t("common.error"));
      load();
    }
  };

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
    role === "super_admin"
      ? "violet"
      : role === "admin"
      ? "royal"
      : role === "teacher"
      ? "green"
      : "amber";

  if (loading) {
    return <div className="py-24 text-center text-sm text-slate-400">{t("common.loading")}</div>;
  }

  const coreCount = members.filter((m) => m.is_public && (m.section === "core" || !m.section)).length;
  const contributorCount = members.filter((m) => m.is_public && m.section === "contributor").length;

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

      {isSuperAdmin && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-royal-100 bg-gradient-to-r from-royal-50/80 to-indigo-50/50 p-3 text-xs text-royal-900">
          <div className="flex items-center gap-2">
            <GripVertical className="h-4 w-4 text-royal-600 shrink-0" />
            <span>
              {lang === "en" ? (
                <>
                  <strong>Flexible Section Ordering:</strong> Each public member is assigned to either <strong>Core Team</strong> or <strong>Contributors & Interns</strong>. Type an order number directly (<strong>1, 2, 3...</strong>) or <strong>drag & drop</strong> rows using the grip handle to sort display priority within that section.
                </>
              ) : (
                <>
                  <strong>የክፍል ቅደም ተከተል ማስተካከያ:</strong> እያንዳንዱ አባል ለ<strong>ዋና ቡድን</strong> ወይም ለ<strong>አስተዋፅዖ አበርካቾች</strong> ይመደባል። ቁጥር (<strong>1, 2, 3...</strong>) በቀጥታ በማስገባት ወይም ረድፎችን በመጎተት በክፍሉ ውስጥ ያለውን ቅደም ተከተል ያደራጁ።
                </>
              )}
            </span>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {/* Filter buttons */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setFilterSection("all")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              filterSection === "all"
                ? "bg-royal-700 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Users className="h-3.5 w-3.5" />
            {lang === "en" ? "All Staff" : "ሁሉም አባላት"}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                filterSection === "all" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              )}
            >
              {members.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFilterSection("core")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              filterSection === "core"
                ? "bg-royal-700 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Globe className="h-3.5 w-3.5" />
            {lang === "en" ? "Core Team" : "ዋና ቡድን"}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                filterSection === "core" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              )}
            >
              {coreCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setFilterSection("contributor")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
              filterSection === "contributor"
                ? "bg-royal-700 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Globe className="h-3.5 w-3.5" />
            {lang === "en" ? "Contributors & Interns" : "አስተዋፅዖ አበርካቾች"}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                filterSection === "contributor" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              )}
            >
              {contributorCount}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${t("common.search")}…`}
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-xs shadow-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/30"
          />
        </div>
      </div>

      <TableShell>
        <TableHead>
          <tr>
            {isSuperAdmin && <th className="w-8 px-2 py-3 text-center"></th>}
            <th className="px-4 py-3 font-semibold">{lang === "en" ? "Order" : "ቅደም ተከተል"}</th>
            <th className="px-4 py-3 font-semibold">{lang === "en" ? "Member" : "አባል"}</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">{t("sf.email")}</th>
            <th className="px-4 py-3 font-semibold">{lang === "en" ? "Role" : "ሚና"}</th>
            {isSuperAdmin && (
              <th className="px-4 py-3 text-right font-semibold">{t("common.actions")}</th>
            )}
          </tr>
        </TableHead>
        <tbody className="divide-y divide-slate-100">
          {filtered.map((member) => {
            const self = member.id === user?.id;
            const canDrag = isSuperAdmin && !query.trim();

            return (
              <tr
                key={member.id}
                draggable={canDrag}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", member.id);
                  e.dataTransfer.effectAllowed = "move";
                  setDraggedId(member.id);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverId !== member.id) {
                    setDragOverId(member.id);
                  }
                }}
                onDragLeave={() => {
                  if (dragOverId === member.id) {
                    setDragOverId(null);
                  }
                }}
                onDragEnd={() => {
                  setDraggedId(null);
                  setDragOverId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(member.id);
                }}
                className={cn(
                  "transition",
                  draggedId === member.id && "opacity-30 bg-royal-50/80",
                  dragOverId === member.id && draggedId !== member.id && "border-t-2 border-royal-600 bg-royal-100/60",
                  draggedId !== member.id && "hover:bg-royal-50/40"
                )}
              >
                {isSuperAdmin && (
                  <td className="w-8 px-2 py-3 text-center">
                    <button
                      type="button"
                      disabled={!canDrag}
                      className={cn(
                        "p-1 transition",
                        canDrag
                          ? "cursor-grab active:cursor-grabbing text-slate-300 hover:text-royal-600"
                          : "cursor-not-allowed opacity-30 text-slate-300"
                      )}
                      title={
                        canDrag
                          ? lang === "en"
                            ? "Drag to reorder"
                            : "ቅደም ተከተል ለመቀየር ይጎትቱ"
                          : undefined
                      }
                    >
                      <GripVertical className="h-4 w-4" />
                    </button>
                  </td>
                )}

                <td className="px-4 py-3">
                  <OrderCell
                    member={member}
                    isSuperAdmin={isSuperAdmin}
                    onUpdateOrder={updateSingleOrder}
                  />
                </td>

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
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-900 leading-snug">
                          {[member.first_name, member.last_name].filter(Boolean).join(" ") || "—"}
                        </p>
                        {member.is_public && (
                          <Badge
                            tone={member.section === "contributor" ? "violet" : "amber"}
                            className="px-1.5 py-0 text-[10px]"
                          >
                            {member.section === "contributor"
                              ? (lang === "en" ? "Contributor" : "አስተዋፅዖ አበርካች")
                              : (lang === "en" ? "Core Team" : "ዋና ቡድን")}
                          </Badge>
                        )}
                      </div>
                      {member.profession && (
                        <p className="text-xs text-royal-700 font-semibold leading-snug">
                          {member.profession}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 md:hidden">{member.email}</p>
                    </div>
                  </div>
                </td>

                <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                  {member.email}
                </td>

                <td className="px-4 py-3">
                  {isSuperAdmin &&
                  member.role !== "super_admin" &&
                  !self &&
                  member.email !== "addisulal@gmail.com" &&
                  member.email !== "addisul@gmail.com" ? (
                    <Select
                      value={member.role}
                      onChange={(e) => changeRole(member, e.target.value as Role)}
                      className="h-8 w-36 text-xs"
                    >
                      <option value="admin">{t("role.admin")}</option>
                      <option value="teacher">{t("role.teacher")}</option>
                      <option value="staff">{t("role.staff")}</option>
                    </Select>
                  ) : (
                    <Badge tone={roleTone(member.role)}>
                      {t(`role.${member.role}`)}
                      {self ? ` · ${lang === "en" ? "You" : "እርስዎ"}` : ""}
                      {(member.email === "addisulal@gmail.com" || member.email === "addisul@gmail.com") && (
                        <span className="ml-1.5 px-1.5 py-0 text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700">
                          {lang === "en" ? "Locked" : "የተዘጋ"}
                        </span>
                      )}
                    </Badge>
                  )}
                </td>

                {isSuperAdmin && (
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setEditing(member); setModalOpen(true); }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-royal-50 hover:text-royal-700"
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

      {filtered.length === 0 && (
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