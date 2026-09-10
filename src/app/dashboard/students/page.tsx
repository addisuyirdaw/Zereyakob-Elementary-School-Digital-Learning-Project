"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { useDashboard } from "@/lib/dashboard-context";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/card";
import { PageHeader, TableHead, TableShell } from "@/components/ui/layout";
import { StudentFormModal } from "@/components/dashboard/student-form";
import { formatDate, initials } from "@/lib/utils";
import type { Database } from "@/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];

export default function StudentsPage() {
  const { t, lang } = useLang();
  const { isAdmin } = useDashboard();

  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);

  const load = async () => {
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const [studentsRes, attendanceRes] = await Promise.all([
      supabase.from("students").select("*").order("grade").order("first_name"),
      supabase.from("attendance").select("*"),
    ]);
    setStudents(studentsRes.data ?? []);
    setAttendance(attendanceRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const grades = useMemo(
    () => [...new Set(students.map((s) => s.grade))].sort((a, b) => a.localeCompare(b, "en", { numeric: true })),
    [students]
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return students.filter((s) => {
      const matchesQuery =
        !needle ||
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(needle) ||
        s.student_code.toLowerCase().includes(needle) ||
        s.guardian_name.toLowerCase().includes(needle);
      const matchesGrade = grade === "all" || s.grade === grade;
      return matchesQuery && matchesGrade;
    });
  }, [students, query, grade]);

  const rateFor = (studentId: string) => {
    const records = attendance.filter((a) => a.student_id === studentId);
    if (!records.length) return null;
    return Math.round((records.filter((r) => r.status !== "absent").length / records.length) * 100);
  };

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (student: Student) => {
    setEditing(student);
    setModalOpen(true);
  };

  const remove = async (student: Student) => {
    if (!window.confirm(`${t("common.deleteConfirm")}: ${student.first_name} ${student.last_name}?`)) return;
    const supabase = createClient();
    if (!supabase) return;
    const { error } = await supabase.from("students").delete().eq("id", student.id);
    if (error) {
      toast.error(t("common.error"));
      return;
    }
    toast.success(t("stu.deleted"));
    load();
  };

  if (loading) {
    return <div className="py-24 text-center text-sm text-slate-400">{t("common.loading")}</div>;
  }

  return (
    <div>
      <PageHeader
        title={t("stu.title")}
        subtitle={t("stu.subtitle")}
        actions={
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4" aria-hidden />
            {t("stu.add")}
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_160px]">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`${t("common.search")}…`}
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/30"
          />
        </div>
        <Select value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="all">{t("stu.grade.all")}</option>
          {grades.map((g) => (
            <option key={g} value={g}>
              {t("stu.grade")} {g}
            </option>
          ))}
        </Select>
      </div>

      <TableShell>
        <TableHead>
          <tr>
            <th className="px-4 py-3 font-semibold">{lang === "en" ? "Name" : "ስም"}</th>
            <th className="hidden px-4 py-3 font-semibold md:table-cell">{t("stu.grade")}</th>
            <th className="hidden px-4 py-3 font-semibold lg:table-cell">{t("stu.attendanceRate")}</th>
            <th className="px-4 py-3 text-right font-semibold">{t("common.actions")}</th>
          </tr>
        </TableHead>
        <tbody className="divide-y divide-slate-100">
          {filtered.map((student) => {
            const rate = rateFor(student.id);
            return (
              <tr key={student.id} className="transition hover:bg-royal-50/40">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-royal-100 text-xs font-bold text-royal-800">
                      {initials(student.first_name, student.last_name)}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">
                        {student.first_name} {student.last_name}
                      </p>
                      <p className="text-xs text-slate-400">{student.student_code}</p>
                    </div>
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-slate-600 md:table-cell">
                  {t("stu.grade")} {student.grade}
                  {student.section ? ` · ${student.section}` : ""}
                </td>
                <td className="hidden px-4 py-3 lg:table-cell">
                  {rate === null ? (
                    <span className="text-slate-300">{t("common.none")}</span>
                  ) : (
                    <Badge tone={rate >= 90 ? "green" : rate >= 70 ? "amber" : "red"}>{rate}%</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/dashboard/students/${student.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-royal-50 hover:text-royal-700"
                      title={t("common.view")}
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => openEdit(student)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-royal-50 hover:text-royal-700"
                      title={t("common.edit")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => remove(student)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        title={t("common.delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </TableShell>

      {filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-400">{t("common.noData")}</p>
      )}

      <StudentFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        student={editing}
        onSaved={() => {
          toast.success(t("stu.saved"));
          load();
        }}
      />
    </div>
  );
}