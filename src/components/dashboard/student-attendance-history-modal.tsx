"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Search,
  User,
  X,
} from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { downloadCsv } from "@/lib/csv";
import { formatGradeDisplay } from "@/lib/grades";
import { initials } from "@/lib/utils";
import type { AttendanceRecord, AttendanceStatus } from "@/lib/attendance";
import type { Database } from "@/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];

interface StudentAttendanceHistoryModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  /** Optional preloaded records for this student */
  initialRecords?: AttendanceRecord[];
}

export function StudentAttendanceHistoryModal({
  student,
  isOpen,
  onClose,
  initialRecords,
}: StudentAttendanceHistoryModalProps) {
  const { t, lang } = useLang();
  const [records, setRecords] = useState<AttendanceRecord[]>(initialRecords ?? []);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const loadStudentRecords = useCallback(async (studentId: string) => {
    setLoading(true);
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("attendance")
      .select("*")
      .eq("student_id", studentId)
      .order("date", { ascending: false });

    if (!error && data) {
      setRecords(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen && student) {
      setStatusFilter("all");
      setSearchQuery("");
      loadStudentRecords(student.id);
    } else {
      setRecords([]);
    }
  }, [isOpen, student, loadStudentRecords]);

  // Comprehensive aggregate stats from actual records
  const stats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    for (const r of records) {
      if (r.status === "present") present++;
      else if (r.status === "absent") absent++;
      else if (r.status === "late") late++;
      else if (r.status === "excused") excused++;
    }

    const totalRecorded = present + absent + late + excused;
    const denominator = present + late + absent;
    const rate = denominator > 0 ? Math.round(((present + late) / denominator) * 100) : null;

    return {
      present,
      absent,
      late,
      excused,
      totalRecorded,
      rate,
    };
  }, [records]);

  // Filtered date-by-date list
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      const matchStatus = statusFilter === "all" || r.status === statusFilter;
      const matchQuery =
        !q ||
        r.date.includes(q) ||
        (r.note && r.note.toLowerCase().includes(q));
      return matchStatus && matchQuery;
    });
  }, [records, statusFilter, searchQuery]);

  const exportStudentCsv = () => {
    if (!student || records.length === 0) return;
    const rows = records.map((r) => ({
      Date: r.date,
      "Student ID": student.student_code,
      Student: `${student.first_name} ${student.last_name}`,
      Grade: formatGradeDisplay(student.grade),
      Section: student.section || "",
      Status: r.status,
      Note: r.note || "",
      "Recorded At": r.created_at,
    }));
    downloadCsv(
      `attendance-${student.student_code}-${student.first_name}-${student.last_name}.csv`,
      rows
    );
  };

  if (!isOpen || !student) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal Dialog */}
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-royal-50/70 via-white to-slate-50/50 p-5 sm:p-6">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-royal-600 text-sm font-extrabold text-white shadow-md shadow-royal-600/30">
              {initials(student.first_name, student.last_name)}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-extrabold text-slate-900">
                  {student.first_name} {student.last_name}
                </h2>
                <Badge tone="royal" className="font-mono text-xs font-semibold">
                  {student.student_code}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                {formatGradeDisplay(student.grade)}
                {student.section ? ` · Section ${student.section}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/students/${student.id}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-royal-300 hover:text-royal-700 shadow-sm transition"
              title="Open full student profile"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Profile</span>
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Attendance Statistics Grid */}
        <div className="border-b border-slate-100 bg-slate-50/60 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {/* Present */}
            <div className="rounded-2xl border border-emerald-200/80 bg-white p-3 text-center shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                {t("att.present")}
              </span>
              <p className="mt-1 text-2xl font-extrabold text-emerald-700">
                {stats.present}
              </p>
            </div>

            {/* Absent */}
            <div className="rounded-2xl border border-red-200/80 bg-white p-3 text-center shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                {t("att.absent")}
              </span>
              <p className="mt-1 text-2xl font-extrabold text-red-600">
                {stats.absent}
              </p>
            </div>

            {/* Late */}
            <div className="rounded-2xl border border-amber-200/80 bg-white p-3 text-center shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600">
                {t("att.late")}
              </span>
              <p className="mt-1 text-2xl font-extrabold text-amber-600">
                {stats.late}
              </p>
            </div>

            {/* Excused */}
            <div className="rounded-2xl border border-royal-200/80 bg-white p-3 text-center shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-royal-700">
                {t("att.excused")}
              </span>
              <p className="mt-1 text-2xl font-extrabold text-royal-700">
                {stats.excused}
              </p>
            </div>

            {/* Total Recorded */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-3 text-center shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Total Days
              </span>
              <p className="mt-1 text-2xl font-extrabold text-slate-800">
                {stats.totalRecorded}
              </p>
            </div>

            {/* Attendance Rate */}
            <div className="rounded-2xl border border-royal-300 bg-gradient-to-br from-royal-600 to-royal-800 p-3 text-center text-white shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-royal-100">
                {t("att.rate")}
              </span>
              <p className="mt-1 text-2xl font-black font-mono">
                {stats.rate !== null ? `${stats.rate}%` : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Toolbar: Search, Status Filter, Export */}
        <div className="flex flex-col gap-2.5 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between bg-white">
          <div className="flex flex-wrap items-center gap-1.5">
            {["all", "present", "absent", "late", "excused"].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition capitalize ${
                  statusFilter === status
                    ? "bg-royal-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {status === "all" ? (lang === "en" ? "All records" : "ሁሉም") : t(`att.${status}`)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search date, notes…"
                className="w-full rounded-xl border border-slate-200 py-1 pl-8 pr-2.5 text-xs focus:border-royal-500 focus:outline-none"
              />
            </div>
            {records.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportStudentCsv}
                className="gap-1 h-7 text-xs"
                title="Download student attendance log"
              >
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </Button>
            )}
          </div>
        </div>

        {/* Date-by-date attendance records table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {loading ? (
            <div className="py-16 text-center text-xs font-semibold text-slate-400">
              {t("common.loading")}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarCheck2 className="h-10 w-10 text-slate-300 mb-2" />
              <p className="text-sm font-bold text-slate-700">
                {records.length === 0
                  ? "No recorded attendance days for this student yet."
                  : "No attendance records match your filter."}
              </p>
              <p className="mt-1 text-xs text-slate-400 max-w-sm">
                {records.length === 0
                  ? "When attendance is saved for this student on school days, dates and notes will appear here."
                  : "Try clearing your search query or selecting 'All records'."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200/80">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-4 py-3">Note / Reason</th>
                    <th className="px-4 py-3 text-right">Recorded Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredRecords.map((r) => {
                    const statusTone =
                      r.status === "present"
                        ? "green"
                        : r.status === "absent"
                        ? "red"
                        : r.status === "late"
                        ? "amber"
                        : "royal";

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/70 transition">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {r.date}
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={statusTone} className="capitalize font-bold text-[11px]">
                            {t(`att.${r.status}`)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {r.note ? (
                            <span className="font-medium text-slate-800 bg-slate-50 px-2 py-1 rounded-md border border-slate-200/60 inline-block max-w-md">
                              {r.note}
                            </span>
                          ) : (
                            <span className="text-slate-300 italic">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-400">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-5 py-3">
          <span className="text-xs text-slate-500 font-medium">
            Showing {filteredRecords.length} of {records.length} recorded school days
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      </div>
    </div>
  );
}
