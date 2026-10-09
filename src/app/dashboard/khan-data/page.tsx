"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Eye,
  FileCode,
  FileSpreadsheet,
  FileText,
  Filter,
  GraduationCap,
  Layers,
  Link2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { downloadCsv, downloadJson } from "@/lib/csv";
import { cn, formatDate } from "@/lib/utils";
import {
  getKhanExportData,
  getKhanImports,
  getKhanLearningRecords,
  getSignedHtmlUrl,
  parseKhanUpload,
  saveKhanImport,
  type KhanExportRow,
  type KhanImportSummary,
  type KhanLearningRecordItem,
} from "./actions";
import type { ParseResult } from "@/lib/khan-parser";

type Tab = "history" | "explorer" | "upload";

export default function KhanDataPage() {
  const { t, lang } = useLang();

  const [activeTab, setActiveTab] = useState<Tab>("history");
  const [imports, setImports] = useState<KhanImportSummary[]>([]);
  const [loadingImports, setLoadingImports] = useState(true);

  // Upload & preview state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);

  // Explorer & pagination state
  const [records, setRecords] = useState<KhanLearningRecordItem[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [selectedImportId, setSelectedImportId] = useState<string>("all");
  const [filterStudent, setFilterStudent] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  // Export loading state
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [downloadingHtmlId, setDownloadingHtmlId] = useState<string | null>(null);

  // ───────────────────────────────────────────────────────────────────────────
  // Data Loading
  // ───────────────────────────────────────────────────────────────────────────

  const loadImports = useCallback(async () => {
    setLoadingImports(true);
    const res = await getKhanImports();
    if (res.success) {
      setImports(res.imports);
    } else {
      toast.error(res.error || t("common.error"));
    }
    setLoadingImports(false);
  }, [t]);

  const loadRecords = useCallback(async () => {
    setLoadingRecords(true);
    const res = await getKhanLearningRecords({
      importId: selectedImportId === "all" ? undefined : selectedImportId,
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
      toast.error(res.error || t("common.error"));
    }
    setLoadingRecords(false);
  }, [selectedImportId, filterStudent, filterStatus, searchKeyword, page, pageSize, t]);

  useEffect(() => {
    loadImports();
  }, [loadImports]);

  useEffect(() => {
    if (activeTab === "explorer") {
      loadRecords();
    }
  }, [activeTab, loadRecords]);

  // Aggregate stats
  const totalLearningRecords = useMemo(
    () => imports.reduce((acc, imp) => acc + (imp.records_count || 0), 0),
    [imports]
  );
  const uniqueClasses = useMemo(
    () => Array.from(new Set(imports.map((i) => i.school_class_name))).filter(Boolean),
    [imports]
  );
  const uniqueSubjects = useMemo(
    () => Array.from(new Set(imports.map((i) => i.subject))).filter(Boolean),
    [imports]
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Upload Handlers
  // ───────────────────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      const type = selected.type;
      const isZip =
        type === "application/zip" ||
        type === "application/x-zip-compressed" ||
        selected.name.toLowerCase().endsWith(".zip");
      const isHtml = type === "text/html" || selected.name.toLowerCase().endsWith(".html");

      if (!isZip && !isHtml) {
        toast.error("Invalid file type. Please select an HTML or ZIP file.");
        return;
      }
      setUploadFile(selected);
      setParseResult(null);
    }
  };

  const handleParse = async () => {
    if (!uploadFile) return;

    setParsing(true);
    const formData = new FormData();
    formData.append("file", uploadFile);

    const res = await parseKhanUpload(formData);

    if (res.success && res.result) {
      setParseResult(res.result);
      toast.success("File validated and parsed successfully!");
    } else {
      toast.error(res.error || "Failed to parse file.");
    }
    setParsing(false);
  };

  const handleSave = async () => {
    if (!uploadFile || saving) return;

    setSaving(true);
    const formData = new FormData();
    formData.append("file", uploadFile);

    const res = await saveKhanImport(formData);

    if (res.success) {
      toast.success(`Success! Imported ${res.records_inserted || 0} learning records.`);
      setParseResult(null);
      setUploadFile(null);
      // Automatically refresh imports and navigate to History tab
      await loadImports();
      setActiveTab("history");
    } else {
      switch (res.status) {
        case "duplicate":
          toast.error("This exact Khan report has already been imported.");
          break;
        case "validation_error":
          toast.error(res.message || "Import validation failed.");
          break;
        case "unauthorized":
          toast.error("You must be authenticated to perform this action.");
          break;
        case "storage_error":
          toast.error("The file could not be securely stored. Import was aborted.");
          break;
        case "unexpected_error":
          toast.error("Import status is uncertain due to a network or server issue. Do not retry immediately.");
          break;
        default:
          toast.error("An unknown error occurred.");
      }
    }
    setSaving(false);
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Export & Download Handlers (for Engineer Abiy & Staff)
  // ───────────────────────────────────────────────────────────────────────────

  const handleExportCsv = async (importId?: string) => {
    const key = importId || "global-csv";
    setExportingId(key);
    toast.info(t("khan.preparingExport"));

    const res = await getKhanExportData({
      importId: importId || (selectedImportId === "all" ? undefined : selectedImportId),
      studentName: filterStudent.trim() || undefined,
      status: filterStatus === "all" ? undefined : filterStatus,
    });

    if (res.success && res.rows && res.filename) {
      downloadCsv(`${res.filename}.csv`, res.rows as unknown as Record<string, string | number | null>[]);
      toast.success(`Exported ${res.rows.length} learning records as CSV!`);
    } else {
      toast.error(res.error || "Failed to export data.");
    }
    setExportingId(null);
  };

  const handleExportJson = async (importId?: string) => {
    const key = importId || "global-json";
    setExportingId(key);
    toast.info(t("khan.preparingExport"));

    const res = await getKhanExportData({
      importId: importId || (selectedImportId === "all" ? undefined : selectedImportId),
      studentName: filterStudent.trim() || undefined,
      status: filterStatus === "all" ? undefined : filterStatus,
    });

    if (res.success && res.jsonData && res.filename) {
      downloadJson(`${res.filename}.json`, res.jsonData);
      toast.success("Exported structured learning dataset as JSON!");
    } else {
      toast.error(res.error || "Failed to export data.");
    }
    setExportingId(null);
  };

  const handleDownloadHtml = async (importId: string) => {
    setDownloadingHtmlId(importId);
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
    setDownloadingHtmlId(null);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={t("khan.title")}
          subtitle={t("khan.subtitle")}
        />
        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/dashboard/khan-data/mappings">
            <Button variant="outline" className="gap-2">
              <Link2 className="h-4 w-4 text-royal-600" aria-hidden />
              {lang === "en" ? "Student Mappings" : "የተማሪ ማገናኛ"}
            </Button>
          </Link>
          <Button
            onClick={() => setActiveTab("upload")}
            className="gap-2 shadow-lg shadow-royal-700/20"
          >
            <Plus className="h-4 w-4" aria-hidden />
            {t("khan.tab.upload")}
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="border-slate-200/70 bg-gradient-to-br from-white to-royal-50/20 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("khan.stats.totalImports")}
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-royal-100 text-royal-700">
                <Database className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">
              {loadingImports ? "…" : imports.length}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {lang === "en" ? "Stored HTML reports" : "የተቀመጡ ሪፖርቶች"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/70 bg-gradient-to-br from-white to-emerald-50/20 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("khan.stats.totalRecords")}
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Layers className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-emerald-950 sm:text-3xl">
              {loadingImports ? "…" : totalLearningRecords.toLocaleString()}
            </p>
            <p className="mt-0.5 text-xs text-emerald-600 font-medium">
              {lang === "en" ? "Granular skill datapoints" : "ዝርዝር የመማር ነጥቦች"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/70 bg-gradient-to-br from-white to-violet-50/20 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t("khan.stats.classes")}
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <GraduationCap className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">
              {loadingImports ? "…" : uniqueClasses.length}
            </p>
            <p className="mt-0.5 text-xs text-slate-400 truncate" title={uniqueClasses.join(", ")}>
              {uniqueClasses.join(", ") || (lang === "en" ? "None" : "ምንም")}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/70 bg-gradient-to-br from-white to-amber-50/20 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {lang === "en" ? "Subjects" : "ትምህርቶች"}
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <BookOpen className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">
              {loadingImports ? "…" : uniqueSubjects.length}
            </p>
            <p className="mt-0.5 text-xs text-slate-400 truncate" title={uniqueSubjects.join(", ")}>
              {uniqueSubjects.join(", ") || "ELA, Books, Math"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-sm">
          <button
            onClick={() => setActiveTab("history")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
              activeTab === "history"
                ? "bg-royal-700 text-white shadow-md shadow-royal-700/20"
                : "text-slate-600 hover:bg-slate-50 hover:text-royal-700"
            )}
          >
            <Database className="h-4 w-4" aria-hidden />
            {t("khan.tab.history")}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                activeTab === "history" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              )}
            >
              {imports.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("explorer")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
              activeTab === "explorer"
                ? "bg-royal-700 text-white shadow-md shadow-royal-700/20"
                : "text-slate-600 hover:bg-slate-50 hover:text-royal-700"
            )}
          >
            <Search className="h-4 w-4" aria-hidden />
            {t("khan.tab.explorer")}
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                activeTab === "explorer" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
              )}
            >
              {totalCount > 0 ? totalCount.toLocaleString() : totalLearningRecords.toLocaleString()}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("upload")}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition",
              activeTab === "upload"
                ? "bg-royal-700 text-white shadow-md shadow-royal-700/20"
                : "text-slate-600 hover:bg-slate-50 hover:text-royal-700"
            )}
          >
            <Upload className="h-4 w-4" aria-hidden />
            {t("khan.tab.upload")}
          </button>
        </div>

        {activeTab === "history" && (
          <Button
            variant="outline"
            size="sm"
            onClick={loadImports}
            disabled={loadingImports}
            className="gap-1.5 text-xs"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loadingImports && "animate-spin")} />
            {lang === "en" ? "Refresh History" : "አድስ"}
          </Button>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: IMPORTS HISTORY                                                  */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="p-0">
            <div className="border-b border-slate-100 p-5 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-slate-50/50 rounded-t-xl">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  {lang === "en" ? "Completed Khan Academy Imports" : "የተጠናቀቁ የካን አካዳሚ ሪፖርቶች"}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {lang === "en"
                    ? "Verified records stored in PostgreSQL with raw HTML preserved in secure storage."
                    : "በዳታቤዝ ውስጥ የተቀመጡ ሪፖርቶች ዝርዝር።"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportCsv()}
                  disabled={imports.length === 0 || exportingId === "global-csv"}
                  className="gap-1.5 text-xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  {lang === "en" ? "Export All CSV" : "ሁሉንም በCSV አውርድ"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExportJson()}
                  disabled={imports.length === 0 || exportingId === "global-json"}
                  className="gap-1.5 text-xs"
                >
                  <FileCode className="h-3.5 w-3.5 text-royal-600" />
                  {lang === "en" ? "Export All JSON" : "ሁሉንም በJSON አውርድ"}
                </Button>
              </div>
            </div>

            {loadingImports ? (
              <div className="py-20 text-center text-sm text-slate-400">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-royal-600 mb-2" />
                {t("common.loading")}
              </div>
            ) : imports.length === 0 ? (
              <div className="py-20 text-center px-4">
                <Database className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <p className="text-base font-semibold text-slate-700">{t("khan.noImports")}</p>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {lang === "en"
                    ? "Upload your first HTML or ZIP report export to see learning analytics here."
                    : "የመጀመሪያውን ሪፖርት በማስገባት ይጀምሩ።"}
                </p>
                <Button
                  onClick={() => setActiveTab("upload")}
                  className="mt-4 gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {t("khan.tab.upload")}
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">{t("khan.reportDate")}</th>
                      <th className="px-5 py-3.5">{t("khan.classGrade")}</th>
                      <th className="px-5 py-3.5">{t("khan.subject")}</th>
                      <th className="px-5 py-3.5 text-center">{t("khan.recordCount")}</th>
                      <th className="px-5 py-3.5">{t("khan.originalFile")}</th>
                      <th className="px-5 py-3.5">{t("khan.importedAt")}</th>
                      <th className="px-5 py-3.5 text-right">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {imports.map((imp) => (
                      <tr key={imp.id} className="hover:bg-royal-50/30 transition">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-royal-100 text-royal-700">
                              <Calendar className="h-3.5 w-3.5" />
                            </span>
                            <span className="font-bold text-slate-900 font-mono">
                              {imp.report_date}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div>
                            <p className="font-semibold text-slate-800">{imp.school_class_name}</p>
                            <p className="text-xs text-slate-400">{imp.grade}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                            {imp.subject}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 font-mono">
                            <CheckCircle2 className="h-3 w-3" />
                            {imp.records_count.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className="text-xs text-slate-500 font-mono truncate max-w-[180px] block"
                            title={imp.original_filename}
                          >
                            {imp.original_filename}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-xs">
                            <p className="font-medium text-slate-700">
                              {formatDate(imp.created_at.slice(0, 10), lang)}
                            </p>
                            <p className="text-slate-400">by {imp.uploader_name}</p>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href={`/dashboard/khan-data/${imp.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2.5 text-xs gap-1 hover:border-royal-500 hover:text-royal-700"
                                title={t("khan.viewDetails")}
                              >
                                <Eye className="h-3.5 w-3.5 text-royal-600" />
                                {lang === "en" ? "Explore" : "ዝርዝር"}
                              </Button>
                            </Link>

                            <Button
                              variant="outline"
                              size="sm"
                              disabled={exportingId === imp.id}
                              onClick={() => handleExportCsv(imp.id)}
                              className="h-8 px-2 text-xs text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50"
                              title="Download CSV"
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5" />
                              CSV
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              disabled={exportingId === imp.id}
                              onClick={() => handleExportJson(imp.id)}
                              className="h-8 px-2 text-xs text-royal-700 hover:border-royal-500 hover:bg-royal-50"
                              title="Download JSON"
                            >
                              <FileCode className="h-3.5 w-3.5" />
                              JSON
                            </Button>

                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={downloadingHtmlId === imp.id}
                              onClick={() => handleDownloadHtml(imp.id)}
                              className="h-8 px-2 text-xs text-slate-500 hover:text-slate-900"
                              title={t("khan.downloadHtml")}
                            >
                              <Download className="h-3.5 w-3.5" />
                              HTML
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: RECORDS EXPLORER (Paginated, Filterable, Scalable)               */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTab === "explorer" && (
        <div className="space-y-4">
          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">
                      {lang === "en" ? "Filter by Import Report" : "በሪፖርት አጣራ"}
                    </label>
                    <select
                      value={selectedImportId}
                      onChange={(e) => {
                        setSelectedImportId(e.target.value);
                        setPage(1);
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
                    >
                      <option value="all">
                        {lang === "en" ? "All Imports (Global View)" : "ሁሉም ሪፖርቶች"}
                      </option>
                      {imports.map((imp) => (
                        <option key={imp.id} value={imp.id}>
                          {imp.report_date} · {imp.school_class_name} ({imp.subject})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">
                      {lang === "en" ? "Student Name" : "የተማሪ ስም"}
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder={t("khan.filterStudent")}
                        value={filterStudent}
                        onChange={(e) => {
                          setFilterStudent(e.target.value);
                          setPage(1);
                        }}
                        className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-8 pr-3 text-xs text-slate-700 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">
                      {t("khan.filterStatus")}
                    </label>
                    <select
                      value={filterStatus}
                      onChange={(e) => {
                        setFilterStatus(e.target.value);
                        setPage(1);
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
                    >
                      <option value="all">{t("khan.filterAll")}</option>
                      <option value="attempted">{t("khan.status.attempted")}</option>
                      <option value="viewed">{t("khan.status.viewed")}</option>
                      <option value="unattempted">{t("khan.status.unattempted")}</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1">
                      {lang === "en" ? "Activity / Skill Search" : "የክህሎት ፍለጋ"}
                    </label>
                    <input
                      type="text"
                      placeholder={lang === "en" ? "Search activity keyword…" : "የተግባር ቃል ፈልግ…"}
                      value={searchKeyword}
                      onChange={(e) => {
                        setSearchKeyword(e.target.value);
                        setPage(1);
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
                    />
                  </div>
                </div>

                {/* Bulk Exports for filtered dataset */}
                <div className="flex items-center gap-2 pt-2 lg:pt-5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportCsv()}
                    disabled={totalCount === 0 || exportingId === "global-csv"}
                    className="gap-1.5 text-xs text-emerald-700 hover:bg-emerald-50 hover:border-emerald-500"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    {t("khan.exportCsv")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportJson()}
                    disabled={totalCount === 0 || exportingId === "global-json"}
                    className="gap-1.5 text-xs text-royal-700 hover:bg-royal-50 hover:border-royal-500"
                  >
                    <FileCode className="h-3.5 w-3.5" />
                    {t("khan.exportJson")}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Paginated Records Table */}
          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="p-0">
              <div className="border-b border-slate-100 px-5 py-3.5 flex items-center justify-between bg-slate-50/50">
                <span className="text-xs font-semibold text-slate-600">
                  {totalCount > 0 ? (
                    t("khan.showingRecords")
                      .replace("{from}", String((page - 1) * pageSize + 1))
                      .replace("{to}", String(Math.min(page * pageSize, totalCount)))
                      .replace("{total}", totalCount.toLocaleString())
                  ) : (
                    t("khan.noRecords")
                  )}
                </span>
                {totalPages > 1 && (
                  <span className="text-xs font-mono text-slate-400">
                    {t("khan.page")} {page} {t("khan.of")} {totalPages}
                  </span>
                )}
              </div>

              {loadingRecords ? (
                <div className="py-24 text-center text-sm text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-royal-600 mb-2" />
                  {t("common.loading")}
                </div>
              ) : records.length === 0 ? (
                <div className="py-20 text-center px-4">
                  <Filter className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">{t("khan.noRecords")}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {lang === "en" ? "Try clearing search filters or selecting another import." : "እባክዎ ማጣሪያውን ይቀይሩ።"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[620px]">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 sticky top-0 shadow-sm border-b border-slate-200/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-5 py-3">Student</th>
                        <th className="px-5 py-3">Class / Date</th>
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
                            <div>
                              <p className="font-semibold text-slate-900">{r.khan_student_name}</p>
                              {r.official_student_name ? (
                                <p className="text-[11px] text-emerald-700 flex items-center gap-1">
                                  <Link2 className="h-3 w-3" />
                                  {r.official_student_name} ({r.official_student_code})
                                </p>
                              ) : (
                                <span className="text-[10px] text-amber-600 font-medium">Unmapped</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="text-xs">
                              <p className="font-medium text-slate-700">{r.school_class_name || "—"}</p>
                              <p className="text-slate-400 font-mono">{r.report_date} · {r.subject}</p>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-600 font-medium">
                            {r.category_level}
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-800 max-w-[260px] truncate" title={r.activity_skill}>
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
                                {t("khan.status.attempted")}
                              </span>
                            )}
                            {r.status === "viewed" && (
                              <span className="inline-flex rounded-full bg-royal-100 px-2.5 py-0.5 text-xs font-semibold text-royal-800">
                                {t("khan.status.viewed")}
                              </span>
                            )}
                            {r.status === "unattempted" && (
                              <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                                {t("khan.status.unattempted")}
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
                    {t("khan.prev")}
                  </Button>

                  <div className="text-xs font-medium text-slate-600">
                    {t("khan.page")} {page} {t("khan.of")} {totalPages}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loadingRecords}
                    className="gap-1 text-xs"
                  >
                    {t("khan.next")}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: UPLOAD REPORT & PREVIEW                                          */}
      {/* ─────────────────────────────────────────────────────────────────────── */}
      {activeTab === "upload" && (
        <div className="space-y-6">
          {!parseResult ? (
            <Card className="border-slate-200/80 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="mb-4 rounded-2xl bg-royal-50 p-4 shadow-inner">
                  <Upload className="h-8 w-8 text-royal-600" />
                </div>
                <CardTitle className="mb-2 text-xl font-bold text-slate-900">
                  Upload Khan Academy Export
                </CardTitle>
                <CardDescription className="mb-6 max-w-md text-xs text-slate-500">
                  Select an HTML or single-file ZIP export from Khan Academy Kids. The file will be securely validated and previewed before saving into the database.
                </CardDescription>

                <div className="flex flex-col items-center gap-4 w-full max-w-md">
                  <label className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/80 px-6 py-5 transition hover:bg-slate-100/80 hover:border-royal-400">
                    <FileCode className="h-6 w-6 text-royal-600 shrink-0" />
                    <span className="font-semibold text-slate-700 text-sm truncate">
                      {uploadFile ? uploadFile.name : "Choose HTML or ZIP Report File"}
                    </span>
                    <input
                      type="file"
                      accept=".html,text/html,.zip,application/zip,application/x-zip-compressed"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>

                  <Button
                    onClick={handleParse}
                    disabled={!uploadFile || parsing}
                    className="w-full gap-2 shadow-lg shadow-royal-700/20"
                  >
                    {parsing ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Validating & Parsing…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Parse & Preview File
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-3">
                <Card className="md:col-span-2 border-slate-200/80 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      <h3 className="font-bold text-slate-900">Verified Report Metadata</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-slate-500 block text-xs">File:</span>
                        <span className="font-semibold text-slate-900 text-xs font-mono truncate block">
                          {uploadFile?.name}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs">Report Date:</span>
                        <span className="font-semibold text-slate-900">{parseResult.metadata.reportDate}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs">Subject:</span>
                        <span className="font-semibold text-slate-900">{parseResult.metadata.subject || "General"}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs">Grade:</span>
                        <span className="font-semibold text-slate-900">{parseResult.metadata.grade}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs">Class:</span>
                        <span className="font-semibold text-slate-900">{parseResult.metadata.className}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs">Students Detected:</span>
                        <span className="font-semibold text-emerald-700">{parseResult.students.length} students</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200/80 shadow-sm">
                  <CardContent className="p-6 flex flex-col justify-center h-full text-center">
                    <div className="mb-2">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900">
                      {parseResult.totalParsedRecords.toLocaleString()}
                    </div>
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
                      Learning Records
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      across {parseResult.totalParsedRows} activity skills
                    </div>
                  </CardContent>
                </Card>
              </div>

              {parseResult.warnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center gap-2 text-amber-800 font-semibold mb-2">
                    <AlertTriangle className="h-5 w-5" />
                    Parser Warnings ({parseResult.warnings.length})
                  </div>
                  <ul className="text-xs text-amber-700 list-disc pl-5 space-y-1">
                    {parseResult.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Ephemeral Preview Table */}
              <Card className="border-slate-200/80 shadow-sm">
                <CardContent className="p-0">
                  <div className="border-b border-slate-100 p-4 flex items-center justify-between bg-slate-50/50 rounded-t-xl">
                    <h3 className="font-semibold text-slate-800 text-sm">
                      Parsed Preview (First 50 rows shown)
                    </h3>
                    <span className="text-xs text-slate-400 font-mono">
                      Total {parseResult.records.length} records ready to commit
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-[480px]">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 sticky top-0 shadow-sm text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3">Student</th>
                          <th className="px-4 py-3">Level</th>
                          <th className="px-4 py-3">Activity / Skill</th>
                          <th className="px-4 py-3 text-center">Progress</th>
                          <th className="px-4 py-3 text-center">Score</th>
                          <th className="px-4 py-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parseResult.records.slice(0, 50).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition">
                            <td className="px-4 py-2.5 font-semibold text-slate-800">{r.student}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-500">{r.level}</td>
                            <td className="px-4 py-2.5 text-xs text-slate-700 truncate max-w-[240px]" title={r.activitySkill}>
                              {r.activitySkill}
                            </td>
                            <td className="px-4 py-2.5 text-center text-xs font-mono text-slate-600">
                              {r.progressCurrent !== null ? `${r.progressCurrent}/${r.progressTotal}` : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-center text-xs font-mono font-semibold">
                              {r.scorePercentage !== null ? `${r.scorePercentage}%` : "—"}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {r.status === "attempted" && (
                                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                                  Attempted
                                </span>
                              )}
                              {r.status === "viewed" && (
                                <span className="inline-flex rounded-full bg-royal-100 px-2 py-0.5 text-xs font-semibold text-royal-800">
                                  Viewed
                                </span>
                              )}
                              {r.status === "unattempted" && (
                                <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                                  Unattempted
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    setParseResult(null);
                    setUploadFile(null);
                  }}
                  disabled={saving}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !uploadFile}
                  className="gap-2 shadow-lg shadow-royal-700/20"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Saving to Database…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Confirm & Save to Database
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
