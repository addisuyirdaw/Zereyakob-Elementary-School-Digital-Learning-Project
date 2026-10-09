"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CalendarCheck2,
  Check,
  CheckCircle2,
  CheckCheck,
  Clock,
  FileEdit,
  Filter,
  HelpCircle,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { useDashboard } from "@/lib/dashboard-context";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { cn, initials, todayInput } from "@/lib/utils";
import type { AttendanceStatus } from "@/lib/attendance";
import type { Database } from "@/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];
type Status = AttendanceStatus;
type FilterStatus = "all" | Status | "unmarked";

const statuses: Status[] = ["present", "absent", "late", "excused"];

const statusStyles: Record<Status, string> = {
  present:
    "border-emerald-300 bg-emerald-50/70 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-100",
  absent:
    "border-red-300 bg-red-50/70 text-red-700 hover:border-red-500 hover:bg-red-100",
  late:
    "border-amber-300 bg-amber-50/70 text-amber-700 hover:border-amber-500 hover:bg-amber-100",
  excused:
    "border-royal-300 bg-royal-50/70 text-royal-700 hover:border-royal-500 hover:bg-royal-100",
};

const activeStyles: Record<Status, string> = {
  present: "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/30",
  absent: "border-red-600 bg-red-600 text-white shadow-md shadow-red-600/30",
  late: "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/30",
  excused: "border-royal-700 bg-royal-700 text-white shadow-md shadow-royal-700/30",
};

export default function AttendancePage() {
  const { t, lang } = useLang();
  const { user } = useDashboard();

  const [students, setStudents] = useState<Student[]>([]);
  const [date, setDate] = useState(todayInput());
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");

  // Selections state (student_id -> status)
  const [selections, setSelections] = useState<Record<string, Status>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Note Modal state
  const [noteModalStudent, setNoteModalStudent] = useState<Student | null>(null);
  const [tempNote, setTempNote] = useState("");

  const loadStudents = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;
    const { data } = await supabase
      .from("students")
      .select("*")
      .order("grade")
      .order("section")
      .order("first_name");
    setStudents(data ?? []);
  }, []);

  const loadDay = useCallback(async (targetDate: string) => {
    const supabase = createClient();
    if (!supabase) return;
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("date", targetDate);

    const records = data ?? [];
    setExisting(records);

    const nextSelections: Record<string, Status> = {};
    const nextNotes: Record<string, string> = {};

    for (const record of records) {
      nextSelections[record.student_id] = record.status as Status;
      if (record.note) nextNotes[record.student_id] = record.note;
    }

    setSelections(nextSelections);
    setNotes(nextNotes);
  }, []);

  useEffect(() => {
    (async () => {
      await loadStudents();
      await loadDay(todayInput());
      setLoading(false);
    })();
  }, [loadStudents, loadDay]);

  const onDateChange = (next: string) => {
    setDate(next);
    loadDay(next);
    setStatusFilter("all");
  };

  const setStatus = (studentId: string, status: Status) => {
    setSelections((prev) => {
      if (prev[studentId] === status) {
        const next = { ...prev };
        delete next[studentId];
        return next;
      }
      return { ...prev, [studentId]: status };
    });
  };

  // Determine if a student has unsaved changes compared to existing DB records
  const isStudentModified = useCallback(
    (studentId: string) => {
      const currentStatus = selections[studentId];
      const currentNote = notes[studentId] || "";
      const savedRecord = existing.find((e) => e.student_id === studentId);

      if (!savedRecord) {
        return !!currentStatus || !!currentNote;
      }
      return savedRecord.status !== currentStatus || (savedRecord.note || "") !== currentNote;
    },
    [selections, notes, existing]
  );

  const hasUnsavedChanges = useMemo(() => {
    return students.some((s) => isStudentModified(s.id));
  }, [students, isStudentModified]);

  // Unique grades and sections
  const grades = useMemo(() => {
    return Array.from(new Set(students.map((s) => s.grade)))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [students]);

  const sections = useMemo(() => {
    const list = selectedGrade === "all" ? students : students.filter((s) => s.grade === selectedGrade);
    return Array.from(new Set(list.map((s) => s.section))).filter(Boolean).sort();
  }, [students, selectedGrade]);

  // All active students in currently selected class (grade & section)
  const scopedStudents = useMemo(() => {
    return students.filter((s) => {
      if (s.status && s.status !== "active") return false;
      const matchGrade = selectedGrade === "all" || s.grade === selectedGrade;
      const matchSection = selectedSection === "all" || s.section === selectedSection;
      return matchGrade && matchSection;
    });
  }, [students, selectedGrade, selectedSection]);

  // Summary counts across the scoped students
  const summary = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;
    let unmarked = 0;

    for (const s of scopedStudents) {
      const status = selections[s.id];
      if (status === "present") present++;
      else if (status === "absent") absent++;
      else if (status === "late") late++;
      else if (status === "excused") excused++;
      else unmarked++;
    }

    const recordedCount = present + absent + late + excused;
    const denominator = present + late + absent;
    const rate = denominator > 0 ? Math.round(((present + late) / denominator) * 100) : null;
    const completionPercent = scopedStudents.length > 0 ? Math.round((recordedCount / scopedStudents.length) * 100) : 0;

    return {
      present,
      absent,
      late,
      excused,
      unmarked,
      recordedCount,
      total: scopedStudents.length,
      rate,
      completionPercent,
      isFullyRecorded: scopedStudents.length > 0 && unmarked === 0,
      isPartiallyRecorded: recordedCount > 0 && unmarked > 0,
    };
  }, [scopedStudents, selections]);

  // Filtered student list displayed in table
  const displayedStudents = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return scopedStudents.filter((s) => {
      const status = selections[s.id];
      // Status Filter from Card clicks
      let matchStatus = true;
      if (statusFilter === "unmarked") {
        matchStatus = !status;
      } else if (statusFilter !== "all") {
        matchStatus = status === statusFilter;
      }

      const matchQuery =
        !needle ||
        `${s.first_name} ${s.last_name}`.toLowerCase().includes(needle) ||
        s.student_code.toLowerCase().includes(needle);

      return matchStatus && matchQuery;
    });
  }, [scopedStudents, selections, statusFilter, searchQuery]);

  // Toggle summary card filter
  const toggleStatusFilter = (clickedStatus: FilterStatus) => {
    setStatusFilter((prev) => (prev === clickedStatus ? "all" : clickedStatus));
  };

  const markAllVisiblePresent = () => {
    const next = { ...selections };
    for (const student of displayedStudents) {
      next[student.id] = "present";
    }
    setSelections(next);
    toast.success(`${t("att.markAllPresent")} (${displayedStudents.length})`);
  };

  // Note Modal handlers
  const openNoteModal = (student: Student) => {
    setNoteModalStudent(student);
    setTempNote(notes[student.id] || "");
  };

  const saveNoteModal = () => {
    if (!noteModalStudent) return;
    setNotes((prev) => ({ ...prev, [noteModalStudent.id]: tempNote.trim() }));
    setNoteModalStudent(null);
  };

  // Save changes to database
  const save = async () => {
    if (scopedStudents.length === 0) return;
    setSaving(true);
    const supabase = createClient();
    if (!supabase) {
      setSaving(false);
      toast.error(t("common.error"));
      return;
    }

    const rowsToUpsert = [];
    for (const student of scopedStudents) {
      const status = selections[student.id];
      if (!status) continue; // Unmarked students are never fabricated as absent or present

      rowsToUpsert.push({
        student_id: student.id,
        date,
        status,
        note: notes[student.id]?.trim() || "",
        recorded_by: user?.id ?? null,
      });
    }

    if (rowsToUpsert.length === 0) {
      setSaving(false);
      toast.info(lang === "en" ? "No marked students to save." : "የተመዘገበ ተማሪ የለም።");
      return;
    }

    const { error } = await supabase
      .from("attendance")
      .upsert(rowsToUpsert, { onConflict: "student_id,date" })
      .select();

    setSaving(false);

    if (error) {
      if (String(error.code) === "23505") {
        toast.error(t("att.duplicate"));
      } else {
        toast.error(error.message || t("common.error"));
        console.error("Attendance save error:", error);
      }
      return;
    }

    toast.success(t("att.saved"));
    await loadDay(date);
  };

  if (loading) {
    return <div className="py-24 text-center text-sm text-slate-400">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("att.title")}
        subtitle={t("att.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="primary"
              loading={saving}
              onClick={save}
              disabled={scopedStudents.length === 0}
              className="gap-2 shadow-lg shadow-royal-700/20 font-bold"
            >
              <Save className="h-4 w-4" aria-hidden />
              {t("att.saveAll")}
            </Button>
          </div>
        }
      />

      {/* Date & Class Filter Toolbar */}
      <Card className="border-slate-200/80 shadow-sm bg-gradient-to-br from-white to-slate-50/50">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            {/* Date Picker */}
            <div>
              <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <span className="flex items-center gap-1.5">
                  <CalendarCheck2 className="h-3.5 w-3.5 text-royal-600" aria-hidden />
                  {t("att.date")}
                </span>
              </label>
              <input
                type="date"
                value={date}
                max={todayInput()}
                onChange={(e) => onDateChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
              />
            </div>

            {/* Grade Selector */}
            <div>
              <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-royal-600" aria-hidden />
                  {t("stu.grade")}
                </span>
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => {
                  setSelectedGrade(e.target.value);
                  setSelectedSection("all");
                  setStatusFilter("all");
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
              >
                <option value="all">{t("att.allClasses")}</option>
                {grades.map((g) => (
                  <option key={g} value={g}>
                    {g.toLowerCase().startsWith("kg") || g.toLowerCase().startsWith("grade") || g.toLowerCase().startsWith("pre")
                      ? g
                      : `${t("stu.grade")} ${g}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Section Selector */}
            <div>
              <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("stu.section")}
              </label>
              <select
                value={selectedSection}
                onChange={(e) => {
                  setSelectedSection(e.target.value);
                  setStatusFilter("all");
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
              >
                <option value="all">{t("att.allSections")}</option>
                {sections.map((s) => (
                  <option key={s} value={s}>
                    {t("stu.section")} {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div>
              <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("common.search")}
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`${t("common.search")}…`}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Clickable Summary KPI Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        {/* Present Card */}
        <button
          type="button"
          onClick={() => toggleStatusFilter("present")}
          className={cn(
            "flex items-center justify-between p-4 rounded-2xl border text-left transition transform active:scale-[0.98]",
            statusFilter === "present"
              ? "border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500 shadow-md"
              : "border-slate-200/80 bg-white hover:border-emerald-300 hover:bg-emerald-50/30"
          )}
        >
          <div>
            <span className="text-2xl font-extrabold text-emerald-700">{summary.present}</span>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">{t("att.present")}</p>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            {summary.total ? Math.round((summary.present / summary.total) * 100) : 0}%
          </span>
        </button>

        {/* Late Card */}
        <button
          type="button"
          onClick={() => toggleStatusFilter("late")}
          className={cn(
            "flex items-center justify-between p-4 rounded-2xl border text-left transition transform active:scale-[0.98]",
            statusFilter === "late"
              ? "border-amber-500 bg-amber-50/90 ring-2 ring-amber-400 shadow-md"
              : "border-slate-200/80 bg-white hover:border-amber-300 hover:bg-amber-50/30"
          )}
        >
          <div>
            <span className="text-2xl font-extrabold text-amber-600">{summary.late}</span>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">{t("att.late")}</p>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
            {summary.total ? Math.round((summary.late / summary.total) * 100) : 0}%
          </span>
        </button>

        {/* Excused Card */}
        <button
          type="button"
          onClick={() => toggleStatusFilter("excused")}
          className={cn(
            "flex items-center justify-between p-4 rounded-2xl border text-left transition transform active:scale-[0.98]",
            statusFilter === "excused"
              ? "border-royal-600 bg-royal-50/90 ring-2 ring-royal-500 shadow-md"
              : "border-slate-200/80 bg-white hover:border-royal-300 hover:bg-royal-50/30"
          )}
        >
          <div>
            <span className="text-2xl font-extrabold text-royal-700">{summary.excused}</span>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">{t("att.excused")}</p>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-royal-100 text-royal-800">
            {summary.total ? Math.round((summary.excused / summary.total) * 100) : 0}%
          </span>
        </button>

        {/* Absent Card */}
        <button
          type="button"
          onClick={() => toggleStatusFilter("absent")}
          className={cn(
            "flex items-center justify-between p-4 rounded-2xl border text-left transition transform active:scale-[0.98]",
            statusFilter === "absent"
              ? "border-red-600 bg-red-50/90 ring-2 ring-red-500 shadow-md"
              : "border-slate-200/80 bg-white hover:border-red-300 hover:bg-red-50/30"
          )}
        >
          <div>
            <span className="text-2xl font-extrabold text-red-600">{summary.absent}</span>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">{t("att.absent")}</p>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800">
            {summary.total ? Math.round((summary.absent / summary.total) * 100) : 0}%
          </span>
        </button>

        {/* Unmarked Card */}
        <button
          type="button"
          onClick={() => toggleStatusFilter("unmarked")}
          className={cn(
            "flex items-center justify-between p-4 rounded-2xl border text-left transition transform active:scale-[0.98]",
            statusFilter === "unmarked"
              ? "border-slate-600 bg-slate-100 ring-2 ring-slate-400 shadow-md"
              : "border-slate-200/80 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-100/50"
          )}
        >
          <div>
            <span className="text-2xl font-extrabold text-slate-600">{summary.unmarked}</span>
            <p className="text-xs font-semibold text-slate-600 mt-0.5">{t("att.unmarked")}</p>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
            {summary.total ? Math.round((summary.unmarked / summary.total) * 100) : 0}%
          </span>
        </button>

        {/* Rate & Completion Card */}
        <div className="flex flex-col justify-between p-4 rounded-2xl border border-royal-200 bg-gradient-to-br from-royal-50/70 to-white shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-royal-900">{t("att.rate")}</p>
            <span className="text-xs font-extrabold text-royal-800 font-mono">
              {summary.rate !== null ? `${summary.rate}%` : "—"}
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span>{summary.recordedCount} of {summary.total} recorded</span>
              <span className="font-semibold text-royal-700">{summary.completionPercent}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-royal-600 transition-all duration-300"
                style={{ width: `${summary.completionPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Status Bar & Batch Controls */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardContent className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Global Unsaved Changes Warning */}
            {hasUnsavedChanges ? (
              <Badge tone="amber" className="flex items-center gap-1.5 py-1 px-2.5">
                <Clock className="h-3.5 w-3.5" />
                <span>{t("att.savedState.unsaved")}</span>
              </Badge>
            ) : summary.isFullyRecorded ? (
              <Badge tone="green" className="flex items-center gap-1.5 py-1 px-2.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{t("att.savedState.saved")} ({summary.recordedCount}/{summary.total})</span>
              </Badge>
            ) : summary.isPartiallyRecorded ? (
              <Badge tone="royal" className="flex items-center gap-1.5 py-1 px-2.5">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>{t("att.savedState.partial")} ({summary.recordedCount}/{summary.total})</span>
              </Badge>
            ) : (
              <Badge className="flex items-center gap-1.5 py-1 px-2.5 text-slate-500 bg-slate-100">
                <HelpCircle className="h-3.5 w-3.5" />
                <span>{t("att.savedState.none")}</span>
              </Badge>
            )}

            {/* Active Card Filter Tag */}
            {statusFilter !== "all" && (
              <div className="inline-flex items-center gap-1.5 rounded-full bg-royal-100 px-3 py-1 text-xs font-semibold text-royal-800">
                <span>
                  {lang === "en" ? "Filter:" : "ማጣሪያ:"} {t(statusFilter === "unmarked" ? "att.unmarked" : `att.${statusFilter}`)} ({displayedStudents.length})
                </span>
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className="rounded-full p-0.5 hover:bg-royal-200 text-royal-700"
                  title="Clear filter"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <span className="text-xs text-slate-500">
              {displayedStudents.length} {lang === "en" ? "students in table" : "ተማሪዎች"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {statusFilter !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusFilter("all")}
                className="gap-1 text-xs text-slate-600 hover:text-slate-900"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {lang === "en" ? "Show All" : "ሁሉንም አሳይ"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={markAllVisiblePresent}
              disabled={displayedStudents.length === 0}
              className="gap-1.5 text-xs text-slate-700 hover:border-emerald-500 hover:text-emerald-700"
            >
              <CheckCheck className="h-4 w-4 text-emerald-600" aria-hidden />
              {t("att.markAllPresent")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50/90 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
              <tr>
                <th className="px-5 py-3.5">{t("att.student")}</th>
                <th className="px-5 py-3.5">{t("stu.grade")}</th>
                <th className="px-5 py-3.5">{t("att.status")}</th>
                <th className="px-5 py-3.5">{t("att.note")}</th>
                <th className="px-5 py-3.5 text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedStudents.map((student) => {
                const currentStatus = selections[student.id];
                const studentNote = notes[student.id];
                const isModified = isStudentModified(student.id);
                const isSavedInDb = existing.some((e) => e.student_id === student.id);

                return (
                  <tr key={student.id} className="hover:bg-royal-50/20 transition">
                    {/* Student Info Column */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-royal-100 text-xs font-bold text-royal-800">
                          {initials(student.first_name, student.last_name)}
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-bold text-slate-900">
                              {student.first_name} {student.last_name}
                            </p>
                            {isModified ? (
                              <span className="h-2 w-2 rounded-full bg-amber-500" title="Unsaved edit" />
                            ) : isSavedInDb ? (
                              <span title="Saved in database">
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              </span>
                            ) : null}
                          </div>
                          <p className="text-xs font-mono text-slate-400">{student.student_code}</p>
                        </div>
                      </div>
                    </td>

                    {/* Grade / Section */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                        {t("stu.grade")} {student.grade}
                        {student.section ? ` · ${student.section}` : ""}
                      </span>
                    </td>

                    {/* Status Button Selector Column */}
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {statuses.map((status) => {
                          const isSelected = currentStatus === status;
                          return (
                            <button
                              key={status}
                              type="button"
                              onClick={() => setStatus(student.id, status)}
                              className={cn(
                                "rounded-lg border px-3 py-1.5 text-xs font-bold transition",
                                isSelected
                                  ? activeStyles[status]
                                  : statusStyles[status]
                              )}
                            >
                              {t(`att.${status}`)}
                            </button>
                          );
                        })}
                        {!currentStatus && (
                          <span className="text-[11px] font-semibold text-slate-400 italic px-2">
                            ({t("att.unmarked")})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Note Column */}
                    <td className="px-5 py-3.5">
                      {studentNote ? (
                        <button
                          type="button"
                          onClick={() => openNoteModal(student)}
                          className="max-w-[200px] truncate text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg px-2.5 py-1.5 border border-slate-200 text-left block"
                          title={studentNote}
                        >
                          <span className="font-semibold">{studentNote}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openNoteModal(student)}
                          className="text-xs text-slate-400 hover:text-royal-700 flex items-center gap-1"
                        >
                          <FileEdit className="h-3.5 w-3.5" />
                          <span>+ {t("att.note")}</span>
                        </button>
                      )}
                    </td>

                    {/* Actions Column */}
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openNoteModal(student)}
                        className="h-8 px-2 text-xs text-slate-500 hover:text-slate-900"
                        title={t("att.editNote")}
                      >
                        <FileEdit className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {displayedStudents.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-20 text-slate-400">
            <Sparkles className="h-8 w-8 text-slate-300" aria-hidden />
            <p className="text-sm font-semibold">{t("common.noData")}</p>
            <p className="text-xs text-slate-400">
              {statusFilter !== "all"
                ? lang === "en" ? "No students matching this status filter." : "በዚህ ሁኔታ ውስጥ ያለ ተማሪ የለም።"
                : lang === "en" ? "No students found." : "ምንም ተማሪ አልተገኘም።"}
            </p>
            {statusFilter !== "all" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatusFilter("all")}
                className="mt-2 text-xs"
              >
                {lang === "en" ? "Clear Filter" : "ማጣሪያውን አጽዳ"}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Note Modal */}
      {noteModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setNoteModalStudent(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {noteModalStudent.first_name} {noteModalStudent.last_name}
                </h3>
                <p className="text-xs text-slate-400">{t("att.date")}: {date}</p>
              </div>
              <button
                type="button"
                onClick={() => setNoteModalStudent(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {t("att.note")}
                </label>
                <textarea
                  rows={3}
                  value={tempNote}
                  onChange={(e) => setTempNote(e.target.value)}
                  placeholder={t("att.notePlaceholder")}
                  className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-700 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <Button variant="outline" size="sm" onClick={() => setNoteModalStudent(null)}>
                {t("common.cancel")}
              </Button>
              <Button size="sm" onClick={saveNoteModal}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}