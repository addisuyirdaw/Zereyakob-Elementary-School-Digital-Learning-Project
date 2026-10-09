"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  FileCode,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  Link2,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { downloadCsv, downloadJson } from "@/lib/csv";
import { cn, formatDate } from "@/lib/utils";
import {
  getKhanExportData,
  getKhanImportById,
  getKhanLearningRecords,
  getSignedHtmlUrl,
  type KhanImportDetailResponse,
  type KhanLearningRecordItem,
} from "../actions";

export default function KhanImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const importId = resolvedParams.id;
  const { t, lang } = useLang();
  const router = useRouter();

  const [importData, setImportData] = useState<KhanImportDetailResponse | null>(null);
  const [loadingImport, setLoadingImport] = useState(true);

  // Records state
  const [records, setRecords] = useState<KhanLearningRecordItem[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [filterStudent, setFilterStudent] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Export state
  const [exporting, setExporting] = useState<string | null>(null);

  const loadImportDetails = useCallback(async () => {
    setLoadingImport(true);
    const res = await getKhanImportById(importId);
    if (res.success) {
      setImportData(res);
    } else {
      toast.error(res.error || "Failed to load import details.");
    }
    setLoadingImport(false);
  }, [importId]);

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    const res = await getKhanLearningRecords({
      importId,
      studentName: filterStudent.trim() || undefined,
      status: filterStatus === "all" ? undefined : filterStatus,
      search: searchKeyword.trim() || undefined,
      page,
      pageSize,
    });

    if (res.success) {
      setRecords(res.records);
      setTotalCount(res.totalCount);
      setTotalPages(res.totalPages);
    } else {
      toast.error(res.error || "Failed to load records.");
    }
    setLoadingRecords(false);
  }, [importId, filterStudent, filterStatus, searchKeyword, page, pageSize]);

  useEffect(() => {
    loadImportDetails();
  }, [loadImportDetails]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleExportCsv = async () => {
    setExporting("csv");
    toast.info(t("khan.preparingExport"));
    const res = await getKhanExportData({
      importId,
      studentName: filterStudent.trim() || undefined,
      status: filterStatus === "all" ? undefined : filterStatus,
    });

    if (res.success && res.rows && res.filename) {
      downloadCsv(`${res.filename}.csv`, res.rows as unknown as Record<string, string | number | null>[]);
      toast.success(`Exported ${res.rows.length} records as CSV!`);
    } else {
      toast.error(res.error || "Failed to export data.");
    }
    setExporting(null);
  };

  const handleExportJson = async () => {
    setExporting("json");
    toast.info(t("khan.preparingExport"));
    const res = await getKhanExportData({
      importId,
      studentName: filterStudent.trim() || undefined,
      status: filterStatus === "all" ? undefined : filterStatus,
    });

    if (res.success && res.jsonData && res.filename) {
      downloadJson(`${res.filename}.json`, res.jsonData);
      toast.success("Exported structured dataset as JSON!");
    } else {
      toast.error(res.error || "Failed to export data.");
    }
    setExporting(null);
  };

  const handleDownloadHtml = async () => {
    setExporting("html");
    const res = await getSignedHtmlUrl(importId);
    if (res.success && res.signedUrl) {
      const link = document.createElement("a");
      link.href = res.signedUrl;
      link.download = res.filename || "khan-report.html";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download started for raw HTML report.");
    } else {
      toast.error(res.error || "Failed to generate download URL.");
    }
    setExporting(null);
  };

  if (loadingImport) {
    return (
      <div className="py-24 text-center text-sm text-slate-400">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-royal-600 mb-2" />
        {t("common.loading")}
      </div>
    );
  }

  if (!importData || !importData.import) {
    return (
      <div className="py-24 text-center space-y-4">
        <Database className="h-10 w-10 text-slate-300 mx-auto" />
        <p className="text-base font-semibold text-slate-700">Import not found</p>
        <Link href="/dashboard/khan-data">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Khan Data
          </Button>
        </Link>
      </div>
    );
  }

  const imp = importData.import;
  const stats = importData.stats;

  return (
    <div className="space-y-6">
      {/* Back link & breadcrumbs */}
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/khan-data"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition hover:text-royal-700"
        >
          <ArrowLeft className="h-4 w-4" />
          {lang === "en" ? "Back to Khan Imports" : "ወደ ካን ሪፖርቶች ተመለስ"}
        </Link>
      </div>

      {/* Hero / Header Card */}
      <Card className="border-slate-200/80 bg-gradient-to-r from-white via-royal-50/20 to-white shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-royal-100 px-3 py-1 text-xs font-bold text-royal-800">
                  {imp.subject}
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {imp.grade}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {imp.original_filename}
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900">
                {imp.school_class_name}
              </h1>
              <p className="text-xs text-slate-500 flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>Report Date: <strong className="text-slate-700 font-mono">{imp.report_date}</strong></span>
                <span>·</span>
                <span>Imported: {formatDate(imp.created_at.slice(0, 10), lang)}</span>
              </p>
            </div>

            {/* Quick Export Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={exporting !== null}
                className="gap-1.5 text-xs text-emerald-700 hover:bg-emerald-50 hover:border-emerald-500"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {lang === "en" ? "Export CSV" : "CSV አውርድ"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportJson}
                disabled={exporting !== null}
                className="gap-1.5 text-xs text-royal-700 hover:bg-royal-50 hover:border-royal-500"
              >
                <FileCode className="h-4 w-4" />
                {lang === "en" ? "Export JSON" : "JSON አውርድ"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadHtml}
                disabled={exporting !== null}
                className="gap-1.5 text-xs text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" />
                {lang === "en" ? "Raw HTML" : "HTML አውርድ"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aggregate Statistics */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                Total Records
              </span>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">
                {stats.totalRecords.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                across {stats.skillCount} distinct skills
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                Students Assessed
              </span>
              <p className="mt-1 text-2xl font-extrabold text-emerald-700">
                {stats.studentCount}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate" title={stats.students.join(", ")}>
                {stats.students.join(", ")}
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                Attempted / Completed
              </span>
              <p className="mt-1 text-2xl font-extrabold text-royal-700">
                {stats.attemptedCount.toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {stats.viewedCount} viewed · {stats.unattemptedCount} unattempted
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 block">
                Average Score
              </span>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">
                {stats.avgScore !== null ? `${stats.avgScore}%` : "—"}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {stats.scoredRecordsCount} scored items
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filterable Learning Records Table for this Import */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardContent className="p-0">
          <div className="border-b border-slate-100 p-4 sm:p-5 flex flex-col md:flex-row gap-3 md:items-center md:justify-between bg-slate-50/50 rounded-t-xl">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[200px] flex-1 sm:flex-none">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter student name…"
                  value={filterStudent}
                  onChange={(e) => {
                    setFilterStudent(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-3 text-xs text-slate-700 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
              >
                <option value="all">All Statuses</option>
                <option value="attempted">Attempted</option>
                <option value="viewed">Viewed</option>
                <option value="unattempted">Unattempted</option>
              </select>

              <input
                type="text"
                placeholder="Search skill keyword…"
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20 min-w-[180px]"
              />
            </div>

            <div className="text-xs font-medium text-slate-500">
              {totalCount.toLocaleString()} matching records
            </div>
          </div>

          {loadingRecords ? (
            <div className="py-20 text-center text-sm text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-royal-600 mb-2" />
              {t("common.loading")}
            </div>
          ) : records.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-400">
              No learning records found matching the filters.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 sticky top-0 shadow-sm border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Student</th>
                    <th className="px-5 py-3">Category / Level</th>
                    <th className="px-5 py-3">Activity / Skill</th>
                    <th className="px-5 py-3 text-center">Score %</th>
                    <th className="px-5 py-3 text-center">Progress</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-royal-50/25 transition">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-slate-900">{r.khan_student_name}</p>
                        {r.official_student_name ? (
                          <p className="text-[11px] text-emerald-700 flex items-center gap-1">
                            <Link2 className="h-3 w-3" />
                            {r.official_student_name} ({r.official_student_code})
                          </p>
                        ) : (
                          <span className="text-[10px] text-amber-600 font-medium">Unmapped</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-600 font-medium">
                        {r.category_level}
                      </td>
                      <td className="px-5 py-3 text-xs text-slate-800 max-w-[280px] truncate" title={r.activity_skill}>
                        {r.activity_skill}
                      </td>
                      <td className="px-5 py-3 text-center">
                        {r.score_percentage !== null ? (
                          <span
                            className={cn(
                              "font-bold font-mono text-xs px-2 py-0.5 rounded-md",
                              r.score_percentage >= 80
                                ? "bg-emerald-50 text-emerald-700"
                                : r.score_percentage >= 50
                                ? "bg-royal-50 text-royal-700"
                                : "bg-slate-100 text-slate-700"
                            )}
                          >
                            {r.score_percentage}%
                          </span>
                        ) : (
                          <span className="text-slate-300 font-mono text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center font-mono text-xs text-slate-600">
                        {r.progress_current !== null && r.progress_total !== null
                          ? `${r.progress_current}/${r.progress_total}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {r.status === "attempted" && (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                            Attempted
                          </span>
                        )}
                        {r.status === "viewed" && (
                          <span className="inline-flex rounded-full bg-royal-100 px-2.5 py-0.5 text-xs font-semibold text-royal-800">
                            Viewed
                          </span>
                        )}
                        {r.status === "unattempted" && (
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                            Unattempted
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="border-t border-slate-100 px-5 py-3.5 flex items-center justify-between bg-slate-50/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loadingRecords}
                className="gap-1 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </Button>

              <div className="text-xs font-medium text-slate-600">
                Page {page} of {totalPages}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loadingRecords}
                className="gap-1 text-xs"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
