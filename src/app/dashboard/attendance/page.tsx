"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  History,
  Loader2,
  RotateCcw,
  Search,
  Sparkles,
  TrendingDown,
  Users,
  X,
} from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { useDashboard } from "@/lib/dashboard-context";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { cn, initials, todayInput, toLocalDateInput } from "@/lib/utils";
import {
  formatGradeDisplay,
  getSectionsForGrade,
  getStandardGradeOptions,
  isStudentInGrade,
} from "@/lib/grades";
import { StudentAttendanceHistoryModal } from "@/components/dashboard/student-attendance-history-modal";
import { AttendanceInsightsSection } from "@/components/dashboard/attendance-insights-section";
import {
  calculateAttendanceSummary,
  getDateRangeFromPreset,
  type AttendanceRecord,
  type AttendanceStatus,
  type DateRangePreset,
} from "@/lib/attendance";
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

  // Selections state (student_id -> status) for current date
  const [selections, setSelections] = useState<Record<string, Status>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoSaveState, setAutoSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [lastAutoSavedTime, setLastAutoSavedTime] = useState<string>("");
  const [savingStudentIds, setSavingStudentIds] = useState<Set<string>>(new Set());
  const inFlightCountRef = useRef<number>(0);

  // Note Modal state
  const [noteModalStudent, setNoteModalStudent] = useState<Student | null>(null);
  const [tempNote, setTempNote] = useState("");

  // Student Attendance History Modal
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);

  // Longitudinal records for Insights tab
  const [insightsPreset, setInsightsPreset] = useState<string>("last_30_days");
  const [insightsFrom, setInsightsFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return toLocalDateInput(d);
  });
  const [insightsTo, setInsightsTo] = useState(todayInput());
  const [insightsRecords, setInsightsRecords] = useState<AttendanceRecord[]>([]);

  // Load students
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

  // Load daily attendance records
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

  // Load range records for Insights
  const loadInsightsRecords = useCallback(async (fromIso: string, toIso: string) => {
    const supabase = createClient();
    if (!supabase) return;
    let query = supabase.from("attendance").select("*");
    if (fromIso) query = query.gte("date", fromIso);
    if (toIso) query = query.lte("date", toIso);
    const { data } = await query.order("date", { ascending: true });
    setInsightsRecords(data ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      await loadStudents();
      await loadDay(todayInput());
      await loadInsightsRecords(insightsFrom, insightsTo);
      setLoading(false);
    })();
  }, [loadStudents, loadDay, loadInsightsRecords, insightsFrom, insightsTo]);

  // Handle insights preset change
  const handleInsightsPreset = (preset: DateRangePreset | "all_time") => {
    setInsightsPreset(preset);
    if (preset === "all_time") {
      setInsightsFrom("");
      setInsightsTo(todayInput());
      loadInsightsRecords("", todayInput());
      return;
    }
    if (preset === "custom") return;

    const { from: f, to: tDate } = getDateRangeFromPreset(preset);
    setInsightsFrom(f);
    setInsightsTo(tDate);
    loadInsightsRecords(f, tDate);
  };

  const handleInsightsFromChange = (newFrom: string) => {
    setInsightsFrom(newFrom);
    setInsightsPreset("custom");
    loadInsightsRecords(newFrom, insightsTo);
  };

  const handleInsightsToChange = (newTo: string) => {
    setInsightsTo(newTo);
    setInsightsPreset("custom");
    loadInsightsRecords(insightsFrom, newTo);
  };

  // Standardized grade options & sections
  const gradeOptions = useMemo(() => {
    return getStandardGradeOptions(students);
  }, [students]);

  const sections = useMemo(() => {
    return getSectionsForGrade(students, selectedGrade);
  }, [students, selectedGrade]);

  // Handle Date changes — seamless real-time switch without manual save prompts
  const onDateChange = (nextDate: string) => {
    if (nextDate === date) return;
    setDate(nextDate);
    loadDay(nextDate);
    setStatusFilter("all");
  };

  // Handle Grade change — auto section reset
  const onGradeChange = (nextGrade: string) => {
    if (nextGrade === selectedGrade) return;
    setSelectedGrade(nextGrade);
    const nextAvailableSections = getSectionsForGrade(students, nextGrade);
    if (selectedSection !== "all" && !nextAvailableSections.includes(selectedSection)) {
      setSelectedSection("all");
    }
    setStatusFilter("all");
  };

  // Real-time seamless auto-save on status click (present, absent, late, excused, unmark)
  const setStatus = async (studentId: string, status: Status) => {
    const isClearing = selections[studentId] === status;
    const nextStatus: Status | null = isClearing ? null : status;

    // 1. Instant optimistic UI update
    setSelections((prev) => {
      if (isClearing) {
        const next = { ...prev };
        delete next[studentId];
        return next;
      }
      return { ...prev, [studentId]: status };
    });

    // 2. Track in-flight saving state
    setSavingStudentIds((prev) => new Set(prev).add(studentId));
    inFlightCountRef.current += 1;
    setAutoSaveState("saving");

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("No database client");

      const student = students.find((s) => s.id === studentId);

      if (nextStatus) {
        const note = notes[studentId]?.trim() || "";
        const payload = {
          student_id: studentId,
          date,
          status: nextStatus,
          note,
          recorded_by: user?.id ?? null,
          grade: student?.grade || "",
          section: student?.section || "",
        };

        const { error } = await supabase
          .from("attendance")
          .upsert(payload, { onConflict: "student_id,date" });

        if (error) throw error;

        // Sync local saved cache immediately
        setExisting((prev) => {
          const idx = prev.findIndex((e) => e.student_id === studentId);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = {
              ...copy[idx],
              status: nextStatus,
              note,
              grade: payload.grade,
              section: payload.section,
            };
            return copy;
          }
          return [...prev, { id: "", created_at: "", updated_at: "", ...payload } as Attendance];
        });
      } else {
        // Clearing / unmarking status
        const { error } = await supabase
          .from("attendance")
          .delete()
          .eq("student_id", studentId)
          .eq("date", date);

        if (error) throw error;

        setExisting((prev) => prev.filter((e) => e.student_id !== studentId));
      }
    } catch (err) {
      console.error("Auto-save attendance error:", err);
      setAutoSaveState("error");
      toast.error(
        lang === "en"
          ? "Failed to auto-save. Check connection or tap Retry."
          : "ራስ-ሰር ማስቀመጥ አልተሳካም። ግንኙነትዎን ይፈትሹ ወይም እንደገና ይሞክሩ።"
      );
    } finally {
      setSavingStudentIds((prev) => {
        const next = new Set(prev);
        next.delete(studentId);
        return next;
      });

      inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
      if (inFlightCountRef.current === 0) {
        setAutoSaveState("saved");
        const now = new Date();
        setLastAutoSavedTime(
          now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        );
      }
    }
  };

  // Scoped students in selected grade & section
  const scopedStudents = useMemo(() => {
    return students.filter((s) => {
      if (s.status && s.status !== "active") return false;
      const matchGrade = isStudentInGrade(s.grade, selectedGrade);
      const matchSection = selectedSection === "all" || (s.section || "") === selectedSection;
      return matchGrade && matchSection;
    });
  }, [students, selectedGrade, selectedSection]);

  // Under-heading summary counts across scoped students for the selected date
  // Requirements: Unmarked students are NEVER counted as absent!
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
    // Rate = (present + late) / (present + late + absent) * 100
    // Unmarked are NOT in denominator; Excused are exempted
    const rate = denominator > 0 ? Math.round(((present + late) / denominator) * 100) : null;
    const completionPercent =
      scopedStudents.length > 0 ? Math.round((recordedCount / scopedStudents.length) * 100) : 0;

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

  const toggleStatusFilter = (clickedStatus: FilterStatus) => {
    setStatusFilter((prev) => (prev === clickedStatus ? "all" : clickedStatus));
  };

  const markAllVisiblePresent = async () => {
    if (displayedStudents.length === 0) return;
    const next = { ...selections };
    for (const student of displayedStudents) {
      next[student.id] = "present";
    }
    setSelections(next);

    const idsToMark = new Set(displayedStudents.map((s) => s.id));
    setSavingStudentIds((prev) => new Set([...prev, ...idsToMark]));
    inFlightCountRef.current += 1;
    setAutoSaveState("saving");

    try {
      const supabase = createClient();
      if (!supabase) throw new Error("No database client");

      const rowsToUpsert = displayedStudents.map((student) => ({
        student_id: student.id,
        date,
        status: "present" as Status,
        note: notes[student.id]?.trim() || "",
        recorded_by: user?.id ?? null,
        grade: student.grade || "",
        section: student.section || "",
      }));

      const { error } = await supabase
        .from("attendance")
        .upsert(rowsToUpsert, { onConflict: "student_id,date" });

      if (error) throw error;

      setExisting((prev) => {
        const filtered = prev.filter((e) => !idsToMark.has(e.student_id));
        const newRecords = rowsToUpsert.map(
          (r) => ({ id: "", created_at: "", updated_at: "", ...r } as Attendance)
        );
        return [...filtered, ...newRecords];
      });

      toast.success(
        lang === "en"
          ? `Marked all present & auto-saved (${displayedStudents.length})`
          : `ሁሉም ተገኝተዋል ተብለው በራስ-ሰር ተመዝግበዋል (${displayedStudents.length})`
      );
    } catch (err) {
      console.error("Auto-save all error:", err);
      setAutoSaveState("error");
      toast.error(lang === "en" ? "Auto-save failed." : "ራስ-ሰር ማስቀመጥ አልተሳካም።");
    } finally {
      setSavingStudentIds((prev) => {
        const updated = new Set(prev);
        for (const id of idsToMark) updated.delete(id);
        return updated;
      });
      inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
      if (inFlightCountRef.current === 0) {
        setAutoSaveState("saved");
        const now = new Date();
        setLastAutoSavedTime(
          now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        );
      }
    }
  };

  // Note Modal handlers with seamless auto-save
  const openNoteModal = (student: Student) => {
    setNoteModalStudent(student);
    setTempNote(notes[student.id] || "");
  };

  const saveNoteModal = async () => {
    if (!noteModalStudent) return;
    const studentId = noteModalStudent.id;
    const trimmedNote = tempNote.trim();
    setNotes((prev) => ({ ...prev, [studentId]: trimmedNote }));
    setNoteModalStudent(null);

    const currentStatus = selections[studentId];
    if (currentStatus) {
      setSavingStudentIds((prev) => new Set(prev).add(studentId));
      inFlightCountRef.current += 1;
      setAutoSaveState("saving");
      try {
        const supabase = createClient();
        if (!supabase) throw new Error("No database client");

        const student = students.find((s) => s.id === studentId);
        const payload = {
          student_id: studentId,
          date,
          status: currentStatus,
          note: trimmedNote,
          recorded_by: user?.id ?? null,
          grade: student?.grade || "",
          section: student?.section || "",
        };
        const { error } = await supabase
          .from("attendance")
          .upsert(payload, { onConflict: "student_id,date" });

        if (error) throw error;

        setExisting((prev) => {
          const idx = prev.findIndex((e) => e.student_id === studentId);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], note: trimmedNote };
            return copy;
          }
          return [...prev, { id: "", created_at: "", updated_at: "", ...payload } as Attendance];
        });

        toast.success(lang === "en" ? "Note auto-saved" : "ማስታወሻ ተቀምጧል");
      } catch (err) {
        console.error("Auto-save note error:", err);
        setAutoSaveState("error");
      } finally {
        setSavingStudentIds((prev) => {
          const updated = new Set(prev);
          updated.delete(studentId);
          return updated;
        });
        inFlightCountRef.current = Math.max(0, inFlightCountRef.current - 1);
        if (inFlightCountRef.current === 0) {
          setAutoSaveState("saved");
          const now = new Date();
          setLastAutoSavedTime(
            now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
          );
        }
      }
    } else {
      toast.success(lang === "en" ? "Note updated" : "ማስታወሻ ተዘምኗል");
    }
  };

  // Full re-sync / retry helper if network error occurs
  const syncAll = async () => {
    if (scopedStudents.length === 0) return;
    setAutoSaveState("saving");
    const supabase = createClient();
    if (!supabase) {
      setAutoSaveState("error");
      toast.error(t("common.error"));
      return;
    }

    const rowsToUpsert = [];
    for (const student of scopedStudents) {
      const status = selections[student.id];
      if (!status) continue;

      rowsToUpsert.push({
        student_id: student.id,
        date,
        status,
        note: notes[student.id]?.trim() || "",
        recorded_by: user?.id ?? null,
        grade: student.grade || "",
        section: student.section || "",
      });
    }

    const scopedIds = new Set(scopedStudents.map((s) => s.id));
    const previouslyRecordedIds = existing
      .filter((e) => scopedIds.has(e.student_id))
      .map((e) => e.student_id);
    const currentlyMarkedIds = new Set(rowsToUpsert.map((r) => r.student_id));
    const unmarkedToDelete = previouslyRecordedIds.filter((id) => !currentlyMarkedIds.has(id));

    if (unmarkedToDelete.length > 0) {
      await supabase
        .from("attendance")
        .delete()
        .in("student_id", unmarkedToDelete)
        .eq("date", date);
    }

    if (rowsToUpsert.length > 0) {
      const { error } = await supabase
        .from("attendance")
        .upsert(rowsToUpsert, { onConflict: "student_id,date" })
        .select();

      if (error) {
        setAutoSaveState("error");
        toast.error(error.message || t("common.error"));
        console.error("Attendance sync error:", error);
        return;
      }
    }

    setAutoSaveState("saved");
    const now = new Date();
    setLastAutoSavedTime(
      now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    );

    toast.success(t("att.autoSaveSuccess"));
    await loadDay(date);
    await loadInsightsRecords(insightsFrom, insightsTo);
  };

  if (loading) {
    return <div className="py-24 text-center text-sm text-slate-400">{t("common.loading")}</div>;
  }

  // Clear page heading formatted according to selected grade
  const gradeLabel = selectedGrade === "all" ? "All Classes" : formatGradeDisplay(selectedGrade);
  const pageTitle =
    selectedSection !== "all"
      ? `Attendance — ${gradeLabel} (${t("stu.section")} ${selectedSection})`
      : `Attendance — ${gradeLabel}`;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={t("dash.attendance")}
        subtitle={t("att.subtitle")}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Real-time Auto-save status indicator */}
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition shadow-sm border",
                autoSaveState === "saving" && "border-royal-300 bg-royal-50/80 text-royal-700",
                autoSaveState === "saved" && "border-emerald-300 bg-emerald-50 text-emerald-800",
                autoSaveState === "error" && "border-red-300 bg-red-50 text-red-800",
                autoSaveState === "idle" && "border-slate-200 bg-slate-50 text-slate-600"
              )}
              title="Attendance automatically saves continuously as you mark present, absent, or late"
            >
              {autoSaveState === "saving" && (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-royal-600 shrink-0" />
                  <span>{t("att.autoSaving")}</span>
                </>
              )}
              {autoSaveState === "saved" && (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span>
                    {t("att.autoSaved")}
                    {lastAutoSavedTime ? ` · ${lastAutoSavedTime}` : ""}
                  </span>
                </>
              )}
              {autoSaveState === "error" && (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  <span>{t("att.autoSaveError")}</span>
                  <button
                    type="button"
                    onClick={syncAll}
                    className="ml-1 underline font-black hover:text-red-950"
                  >
                    {t("att.retry")}
                  </button>
                </div>
              )}
              {autoSaveState === "idle" && (
                <>
                  <Sparkles className="h-3.5 w-3.5 text-royal-500 shrink-0" />
                  <span>{t("att.autoSaveReady")}</span>
                </>
              )}
            </div>

            {/* Quick Refresh button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadDay(date);
                loadInsightsRecords(insightsFrom, insightsTo);
              }}
              title="Refresh attendance records"
              className="gap-1.5 text-xs text-slate-700 hover:text-slate-900 border-slate-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>{lang === "en" ? "Refresh" : "አድስ"}</span>
            </Button>
          </div>
        }
      />

      {/* Global Grade, Section & Date Toolbar */}
      <Card className="border-slate-200/80 shadow-sm bg-gradient-to-br from-white to-slate-50/50">
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            {/* Grade Selector (Requirement 1: KG1, KG2, KG3, Grade 1..6, All Grades) */}
            <div>
              <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <span className="flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-royal-600" aria-hidden />
                  {t("stu.grade")}
                </span>
              </label>
              <select
                value={selectedGrade}
                onChange={(e) => onGradeChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
              >
                {gradeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value === "all" ? t("att.allGrades") : opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Section Selector (shows only relevant sections for selected grade) */}
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
                disabled={sections.length === 0 && selectedGrade !== "all"}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="all">
                  {sections.length === 0 && selectedGrade !== "all"
                    ? "No Sections"
                    : t("att.allSections")}
                </option>
                {sections.map((s) => (
                  <option key={s} value={s}>
                    {t("stu.section")} {s}
                  </option>
                ))}
              </select>
            </div>

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
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold shadow-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
              />
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

      {/* Daily Attendance Overview & Marking */}
      <div className="space-y-5">
          {/* Requirement 2: Easy-to-inspect Grade Summaries under Heading */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
            {/* 1. Total Enrolled */}
            <div className="flex flex-col justify-between p-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {t("att.enrolled")}
              </span>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-3xl font-black text-slate-900">{summary.total}</span>
                <span className="text-[11px] font-bold text-slate-400">students</span>
              </div>
            </div>

            {/* 2. Present Card */}
            <button
              type="button"
              onClick={() => toggleStatusFilter("present")}
              className={cn(
                "flex flex-col justify-between p-4 rounded-2xl border text-left transition transform active:scale-[0.98]",
                statusFilter === "present"
                  ? "border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500 shadow-md"
                  : "border-slate-200/80 bg-white hover:border-emerald-300 hover:bg-emerald-50/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  {t("att.present")}
                </span>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {summary.total ? Math.round((summary.present / summary.total) * 100) : 0}%
                </span>
              </div>
              <p className="mt-2 text-3xl font-black text-emerald-700">{summary.present}</p>
            </button>

            {/* 3. Late Card */}
            <button
              type="button"
              onClick={() => toggleStatusFilter("late")}
              className={cn(
                "flex flex-col justify-between p-4 rounded-2xl border text-left transition transform active:scale-[0.98]",
                statusFilter === "late"
                  ? "border-amber-500 bg-amber-50/90 ring-2 ring-amber-400 shadow-md"
                  : "border-slate-200/80 bg-white hover:border-amber-300 hover:bg-amber-50/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
                  {t("att.late")}
                </span>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  {summary.total ? Math.round((summary.late / summary.total) * 100) : 0}%
                </span>
              </div>
              <p className="mt-2 text-3xl font-black text-amber-600">{summary.late}</p>
            </button>

            {/* 4. Excused Card */}
            <button
              type="button"
              onClick={() => toggleStatusFilter("excused")}
              className={cn(
                "flex flex-col justify-between p-4 rounded-2xl border text-left transition transform active:scale-[0.98]",
                statusFilter === "excused"
                  ? "border-royal-600 bg-royal-50/90 ring-2 ring-royal-500 shadow-md"
                  : "border-slate-200/80 bg-white hover:border-royal-300 hover:bg-royal-50/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-royal-700">
                  {t("att.excused")}
                </span>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-royal-100 text-royal-800">
                  {summary.total ? Math.round((summary.excused / summary.total) * 100) : 0}%
                </span>
              </div>
              <p className="mt-2 text-3xl font-black text-royal-700">{summary.excused}</p>
            </button>

            {/* 5. Absent Card */}
            <button
              type="button"
              onClick={() => toggleStatusFilter("absent")}
              className={cn(
                "flex flex-col justify-between p-4 rounded-2xl border text-left transition transform active:scale-[0.98]",
                statusFilter === "absent"
                  ? "border-red-600 bg-red-50/90 ring-2 ring-red-500 shadow-md"
                  : "border-slate-200/80 bg-white hover:border-red-300 hover:bg-red-50/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-red-600">
                  {t("att.absent")}
                </span>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-800">
                  {summary.total ? Math.round((summary.absent / summary.total) * 100) : 0}%
                </span>
              </div>
              <p className="mt-2 text-3xl font-black text-red-600">{summary.absent}</p>
            </button>

            {/* 6. Unmarked Card (Requirement 2: Unmarked NOT counted as absent!) */}
            <button
              type="button"
              onClick={() => toggleStatusFilter("unmarked")}
              className={cn(
                "flex flex-col justify-between p-4 rounded-2xl border text-left transition transform active:scale-[0.98]",
                statusFilter === "unmarked"
                  ? "border-slate-600 bg-slate-100 ring-2 ring-slate-400 shadow-md"
                  : "border-slate-200/80 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-100/50"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t("att.unmarked")}
                </span>
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700">
                  {summary.total ? Math.round((summary.unmarked / summary.total) * 100) : 0}%
                </span>
              </div>
              <p className="mt-2 text-3xl font-black text-slate-600">{summary.unmarked}</p>
            </button>

            {/* 7. Attendance Rate for Selected Date */}
            <div className="flex flex-col justify-between p-4 rounded-2xl border border-royal-200 bg-gradient-to-br from-royal-50/70 to-white shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-royal-900">
                  {t("att.rate")}
                </span>
                <span className="text-xs font-extrabold text-royal-800 font-mono">
                  {summary.rate !== null ? `${summary.rate}%` : "—"}
                </span>
              </div>
              <div className="mt-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span>{summary.recordedCount} / {summary.total} marked</span>
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

          {/* Filter Status Bar, Unsaved Alert, and Batch Action Controls */}
          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Auto-save & Completion Status */}
                {autoSaveState === "saving" ? (
                  <Badge tone="royal" className="flex items-center gap-1.5 py-1 px-2.5 font-bold">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-royal-600" />
                    <span>{t("att.autoSaving")}</span>
                  </Badge>
                ) : summary.isFullyRecorded ? (
                  <Badge tone="green" className="flex items-center gap-1.5 py-1 px-2.5 font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>
                      {t("att.savedState.saved")} ({summary.recordedCount}/{summary.total})
                    </span>
                  </Badge>
                ) : summary.isPartiallyRecorded ? (
                  <Badge tone="royal" className="flex items-center gap-1.5 py-1 px-2.5 font-bold">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>
                      {t("att.savedState.partial")} ({summary.recordedCount}/{summary.total})
                    </span>
                  </Badge>
                ) : (
                  <Badge className="flex items-center gap-1.5 py-1 px-2.5 text-slate-500 bg-slate-100 font-bold">
                    <HelpCircle className="h-3.5 w-3.5" />
                    <span>{t("att.savedState.none")}</span>
                  </Badge>
                )}

                {/* Active Card Filter Tag */}
                {statusFilter !== "all" && (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-royal-100 px-3 py-1 text-xs font-semibold text-royal-800">
                    <span>
                      Filter: {t(statusFilter === "unmarked" ? "att.unmarked" : `att.${statusFilter}`)} ({displayedStudents.length})
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
                  {displayedStudents.length} {lang === "en" ? "students in view" : "ተማሪዎች"}
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
                  className="gap-1.5 text-xs text-slate-700 hover:border-emerald-500 hover:text-emerald-700 font-semibold"
                >
                  <CheckCheck className="h-4 w-4 text-emerald-600" aria-hidden />
                  {t("att.markAllPresent")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Daily Attendance Table */}
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
                    const isSavingThis = savingStudentIds.has(student.id);
                    const isSavedInDb = existing.some(
                      (e) => e.student_id === student.id && e.status === currentStatus
                    );

                    return (
                      <tr key={student.id} className="hover:bg-royal-50/20 transition">
                        {/* Student Column */}
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
                                {isSavingThis ? (
                                  <span title={lang === "en" ? "Auto-saving…" : "በራስ-ሰር በማስቀመጥ ላይ…"}>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-royal-600" />
                                  </span>
                                ) : isSavedInDb && currentStatus ? (
                                  <span title={lang === "en" ? "Auto-saved in database" : "በመረጃ ቋት ተቀምጧል"}>
                                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-xs font-mono text-slate-400">
                                {student.student_code}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Grade / Section Column */}
                        <td className="px-5 py-3.5">
                          <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {formatGradeDisplay(student.grade)}
                            {student.section ? ` · ${student.section}` : ""}
                          </span>
                        </td>

                        {/* Status Buttons Column */}
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
                              className="max-w-[180px] truncate text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg px-2.5 py-1.5 border border-slate-200 text-left block"
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

                        {/* Action Column: Requirement 3 - View Attendance History */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setHistoryStudent(student)}
                              className="h-8 gap-1 px-2.5 text-xs font-bold text-royal-700 hover:bg-royal-50 hover:text-royal-900"
                              title={t("att.viewHistory")}
                            >
                              <History className="h-3.5 w-3.5" />
                              <span>{t("att.history")}</span>
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openNoteModal(student)}
                              className="h-8 px-2 text-xs text-slate-500 hover:text-slate-900"
                              title={t("att.editNote")}
                            >
                              <FileEdit className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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
                    ? lang === "en"
                      ? "No students matching this status filter."
                      : "በዚህ ሁኔታ ውስጥ ያለ ተማሪ የለም።"
                    : selectedGrade !== "all"
                    ? `No students found in ${gradeLabel}.`
                    : lang === "en"
                    ? "No students found."
                    : "ምንም ተማሪ አልተገኘም።"}
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
        </div>

      {/* Attendance Trends & Longitudinal Insights */}
      <AttendanceInsightsSection
        students={scopedStudents}
        records={insightsRecords}
        selectedGrade={selectedGrade}
        selectedSection={selectedSection}
        from={insightsFrom}
        to={insightsTo}
        onFromChange={handleInsightsFromChange}
        onToChange={handleInsightsToChange}
        onPresetSelect={handleInsightsPreset}
        currentPreset={insightsPreset}
        onOpenHistory={(student) => setHistoryStudent(student)}
      />

      {/* Student Attendance History Modal (Requirement 3) */}
      <StudentAttendanceHistoryModal
        student={historyStudent}
        isOpen={!!historyStudent}
        onClose={() => setHistoryStudent(null)}
      />

      {/* Note Edit Modal */}
      {noteModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setNoteModalStudent(null)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {noteModalStudent.first_name} {noteModalStudent.last_name}
                </h3>
                <p className="text-xs text-slate-400">
                  {t("att.date")}: {date}
                </p>
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