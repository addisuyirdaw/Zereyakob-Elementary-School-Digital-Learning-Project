"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  CalendarRange,
  CheckCircle2,
  Download,
  Filter,
  History,
  Info,
  Search,
  SlidersHorizontal,
  TrendingDown,
  Users,
} from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { downloadCsv } from "@/lib/csv";
import { formatGradeDisplay } from "@/lib/grades";
import { initials } from "@/lib/utils";
import {
  calculateAttendanceInsights,
  type StudentAbsenceInsight,
} from "@/lib/attendance-insights";
import type { AttendanceRecord, DateRangePreset } from "@/lib/attendance";
import type { Database } from "@/types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];

interface AttendanceInsightsSectionProps {
  students: Student[];
  records: AttendanceRecord[];
  selectedGrade: string;
  selectedSection: string;
  from: string;
  to: string;
  onFromChange: (val: string) => void;
  onToChange: (val: string) => void;
  onPresetSelect: (preset: DateRangePreset | "all_time") => void;
  currentPreset: string;
  onOpenHistory: (student: Student) => void;
}

export function AttendanceInsightsSection({
  students,
  records,
  selectedGrade,
  selectedSection,
  from,
  to,
  onFromChange,
  onToChange,
  onPresetSelect,
  currentPreset,
  onOpenHistory,
}: AttendanceInsightsSectionProps) {
  const { t, lang } = useLang();

  // Configurable monitoring thresholds
  const [rateThreshold, setRateThreshold] = useState<number>(80);
  const [minRepeatedAbsences, setMinRepeatedAbsences] = useState<number>(2);
  const [activeTab, setActiveTab] = useState<
    "all_flagged" | "consecutive" | "repeated" | "low_rate" | "all_students"
  >("all_flagged");
  const [searchQuery, setSearchQuery] = useState("");
  const [showConfig, setShowConfig] = useState(false);

  // Compute insights
  const insights = useMemo(() => {
    return calculateAttendanceInsights(students, records, {
      rateThreshold,
      minRepeatedAbsences,
      minConsecutiveAbsences: 2,
    });
  }, [students, records, rateThreshold, minRepeatedAbsences]);

  // Tab-specific list
  const tabList = useMemo(() => {
    switch (activeTab) {
      case "consecutive":
        return insights.consecutiveAbsencesList;
      case "repeated":
        return insights.repeatedAbsencesList;
      case "low_rate":
        return insights.lowRateList;
      case "all_students":
        return insights.studentInsights;
      case "all_flagged":
      default:
        return insights.studentInsights.filter((s) => s.isFlagged);
    }
  }, [insights, activeTab]);

  // Filtered by search
  const displayedInsights = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tabList;
    return tabList.filter(
      (item) =>
        `${item.student.first_name} ${item.student.last_name}`
          .toLowerCase()
          .includes(q) ||
        item.student.student_code.toLowerCase().includes(q)
    );
  }, [tabList, searchQuery]);

  const exportInsightsCsv = () => {
    const rows = insights.studentInsights.map((item) => ({
      "Student ID": item.student.student_code,
      Student: `${item.student.first_name} ${item.student.last_name}`,
      Grade: formatGradeDisplay(item.student.grade),
      Section: item.student.section || "",
      "Total Absences": item.absent,
      "Max Consecutive Absences": item.maxConsecutiveAbsences,
      "Days Present": item.present,
      "Days Late": item.late,
      "Days Excused": item.excused,
      "Total Recorded Days": item.totalRecorded,
      "Attendance Rate":
        item.attendanceRate !== null ? `${item.attendanceRate}%` : "—",
      "Flagged Status": item.isFlagged ? "Yes" : "No",
      "Monitoring Flags": item.flagReasons.join("; ") || "None",
      "From Date": from,
      "To Date": to,
    }));

    downloadCsv(`attendance-insights-${from}-to-${to}.csv`, rows);
  };

  return (
    <div className="space-y-5">
      {/* Date Range & Controls Toolbar */}
      <Card className="border-slate-200/80 shadow-sm bg-gradient-to-br from-white to-slate-50/50">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Presets */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                <CalendarRange className="h-3.5 w-3.5 text-royal-600" />
                Range:
              </span>
              {[
                { id: "today", label: "Today" },
                { id: "this_week", label: "This Week" },
                { id: "last_week", label: "Last Week" },
                { id: "this_month", label: "This Month" },
                { id: "last_30_days", label: "Last 30 Days" },
                { id: "all_time", label: "All Time" },
                { id: "custom", label: "Custom" },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() =>
                    onPresetSelect(p.id as DateRangePreset | "all_time")
                  }
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    currentPreset === p.id
                      ? "bg-royal-600 text-white shadow-sm"
                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Custom Dates & Threshold Toggle */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => onFromChange(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-royal-500 focus:outline-none"
                  title="From date"
                />
                <span className="text-xs text-slate-400">to</span>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => onToChange(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:border-royal-500 focus:outline-none"
                  title="To date"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowConfig(!showConfig)}
                className={`gap-1.5 text-xs h-8 ${
                  showConfig ? "border-royal-400 bg-royal-50 text-royal-700" : ""
                }`}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Thresholds</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={exportInsightsCsv}
                className="gap-1.5 text-xs h-8 text-slate-700"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export Insights</span>
              </Button>
            </div>
          </div>

          {/* Configurable Monitoring Threshold Drawer */}
          {showConfig && (
            <div className="mt-4 pt-4 border-t border-slate-200/80 grid gap-4 sm:grid-cols-2 rounded-2xl bg-royal-50/40 p-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Attendance Rate Monitoring Threshold:{" "}
                  <span className="text-royal-700 font-mono">
                    {rateThreshold}%
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  {[70, 75, 80, 85, 90].map((tVal) => (
                    <button
                      key={tVal}
                      type="button"
                      onClick={() => setRateThreshold(tVal)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        rateThreshold === tVal
                          ? "bg-royal-600 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {tVal}%
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                  <Info className="h-3 w-3 text-royal-600 shrink-0" />
                  Informational monitoring threshold for early student support,
                  not an official school disciplinary policy.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Repeated Absences Flag:{" "}
                  <span className="text-red-600 font-mono">
                    ≥ {minRepeatedAbsences} absences
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  {[2, 3, 4, 5].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setMinRepeatedAbsences(count)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        minRepeatedAbsences === count
                          ? "bg-red-600 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      ≥ {count}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Flags students who accumulate at least this number of recorded
                  absences in the period.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Flagged */}
        <div className="rounded-2xl border border-red-200/80 bg-gradient-to-br from-red-50/60 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-red-700">
              Students Flagged
            </span>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </div>
          <p className="mt-2 text-3xl font-black text-red-600">
            {insights.totalFlaggedStudents}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 font-medium">
            of {insights.totalAnalyzedStudents} enrolled students
          </p>
        </div>

        {/* Consecutive Absences */}
        <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/60 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Consecutive Absences
            </span>
            <TrendingDown className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-3xl font-black text-amber-600">
            {insights.consecutiveAbsenceCount}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 font-medium">
            2+ consecutive school days
          </p>
        </div>

        {/* Low Rate (< threshold) */}
        <div className="rounded-2xl border border-royal-200/80 bg-gradient-to-br from-royal-50/60 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-royal-700">
              Rate &lt; {rateThreshold}%
            </span>
            <AlertCircle className="h-4 w-4 text-royal-600" />
          </div>
          <p className="mt-2 text-3xl font-black text-royal-700">
            {insights.lowRateCount}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 font-medium">
            below monitoring threshold
          </p>
        </div>

        {/* Average Rate */}
        <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/60 to-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Scope Average Rate
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-3xl font-black text-emerald-700 font-mono">
            {insights.averageRate !== null ? `${insights.averageRate}%` : "—"}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500 font-medium">
            based on {records.length} recorded days
          </p>
        </div>
      </div>

      {/* Tabs & Search Navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/80 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            {
              id: "all_flagged",
              label: `All Flagged (${insights.totalFlaggedStudents})`,
              tone: "text-red-700",
            },
            {
              id: "consecutive",
              label: `Consecutive (${insights.consecutiveAbsenceCount})`,
              tone: "text-amber-700",
            },
            {
              id: "repeated",
              label: `Repeated Absences (${insights.repeatedAbsencesList.length})`,
              tone: "text-red-600",
            },
            {
              id: "low_rate",
              label: `Low Rate <${rateThreshold}% (${insights.lowRateCount})`,
              tone: "text-royal-700",
            },
            {
              id: "all_students",
              label: `All Students (${insights.totalAnalyzedStudents})`,
              tone: "text-slate-600",
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                activeTab === tab.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student or ID…"
            className="w-full rounded-xl border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs focus:border-royal-500 focus:outline-none shadow-sm"
          />
        </div>
      </div>

      {/* Flagged Students Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        {displayedInsights.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-2" />
            <p className="text-sm font-bold text-slate-800">
              {activeTab === "all_flagged"
                ? "No attendance concerns detected for this period!"
                : "No students matching this filter."}
            </p>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              {activeTab === "all_flagged"
                ? `All students in this scope meet the ${rateThreshold}% monitoring threshold without repeated consecutive absences.`
                : "Try expanding your date range or selecting another tab."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50/90 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                <tr>
                  <th className="px-5 py-3.5">Student</th>
                  <th className="px-4 py-3.5">Grade & Section</th>
                  <th className="px-3 py-3.5 text-center text-red-600">
                    Absences
                  </th>
                  <th className="px-3 py-3.5 text-center text-amber-600">
                    Consecutive
                  </th>
                  <th className="px-4 py-3.5 text-center font-bold">
                    Attendance Rate
                  </th>
                  <th className="px-4 py-3.5">Monitoring Reasons</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedInsights.map((item) => {
                  return (
                    <tr
                      key={item.student.id}
                      className="hover:bg-royal-50/20 transition"
                    >
                      {/* Student info */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-royal-100 text-xs font-bold text-royal-800">
                            {initials(
                              item.student.first_name,
                              item.student.last_name
                            )}
                          </span>
                          <div>
                            <p className="font-bold text-slate-900">
                              {item.student.first_name} {item.student.last_name}
                            </p>
                            <p className="font-mono text-[11px] text-slate-400">
                              {item.student.student_code}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Grade & section */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {formatGradeDisplay(item.student.grade)}
                          {item.student.section
                            ? ` · ${item.student.section}`
                            : ""}
                        </span>
                      </td>

                      {/* Absences count */}
                      <td className="px-3 py-3.5 text-center">
                        <span
                          className={`font-black font-mono text-sm ${
                            item.absent > 0 ? "text-red-600" : "text-slate-400"
                          }`}
                        >
                          {item.absent}
                        </span>
                      </td>

                      {/* Consecutive Absences */}
                      <td className="px-3 py-3.5 text-center">
                        {item.maxConsecutiveAbsences >= 2 ? (
                          <Badge tone="amber" className="font-mono font-bold text-[11px]">
                            {item.maxConsecutiveAbsences} days
                          </Badge>
                        ) : (
                          <span className="text-slate-300 font-mono">—</span>
                        )}
                      </td>

                      {/* Attendance rate */}
                      <td className="px-4 py-3.5 text-center">
                        {item.attendanceRate !== null ? (
                          <Badge
                            tone={
                              item.attendanceRate >= 90
                                ? "green"
                                : item.attendanceRate >= rateThreshold
                                ? "amber"
                                : "red"
                            }
                            className="font-mono font-bold text-xs"
                          >
                            {item.attendanceRate}%
                          </Badge>
                        ) : (
                          <span className="text-slate-300 italic text-xs">
                            —
                          </span>
                        )}
                      </td>

                      {/* Monitoring reasons / flags */}
                      <td className="px-4 py-3.5">
                        {item.flagReasons.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.flagReasons.map((reason, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center rounded-md bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-medium text-red-700"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            On track
                          </span>
                        )}
                      </td>

                      {/* Open History Button */}
                      <td className="px-4 py-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenHistory(item.student)}
                          className="gap-1.5 h-8 text-xs font-bold text-royal-700 hover:bg-royal-50 hover:text-royal-800"
                          title="Open detailed attendance profile"
                        >
                          <History className="h-3.5 w-3.5" />
                          <span>History</span>
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
