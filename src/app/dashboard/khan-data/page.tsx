"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
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
  Medal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trophy,
  Upload,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { useLang } from "@/lib/i18n/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Badge, Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/layout";
import { downloadCsv, downloadJson } from "@/lib/csv";
import { cn, formatDate } from "@/lib/utils";
import {
  getKhanDynamicFilterOptions,
  getKhanExportData,
  getKhanImports,
  getKhanLeaderboard,
  getKhanLearningRecords,
  getMonthlyProgressComparison,
  getSignedHtmlUrl,
  getStudentLearningProfile,
  parseKhanUpload,
  saveKhanImport,
  type KhanExportRow,
  type KhanImportSummary,
  type KhanLearningRecordItem,
  type LeaderboardEntry,
  type MonthlyComparisonRow,
  type StudentLearningProfile,
  type UploadActionState,
} from "./actions";
import type { ParseResult } from "@/lib/khan-parser";

type Tab = "history" | "students" | "comparison" | "leaderboard" | "explorer" | "upload";

export default function KhanDataPage() {
  const { t, lang } = useLang();

  const [activeTab, setActiveTab] = useState<Tab>("history");
  const [imports, setImports] = useState<KhanImportSummary[]>([]);
  const [loadingImports, setLoadingImports] = useState(true);

  // Upload & preview state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parseState, setParseState] = useState<UploadActionState | null>(null);

  // Student Profile state
  const [selectedStudentSearch, setSelectedStudentSearch] = useState("");
  const [selectedStudentName, setSelectedStudentName] = useState<string>("");
  const [studentProfile, setStudentProfile] = useState<StudentLearningProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Monthly Comparison state
  const [comparisonGrade, setComparisonGrade] = useState("all");
  const [comparisonSubject, setComparisonSubject] = useState("all");
  const [comparisonClass, setComparisonClass] = useState("all");
  const [baselineDate, setBaselineDate] = useState("");
  const [comparisonDate, setComparisonDate] = useState("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [comparisons, setComparisons] = useState<MonthlyComparisonRow[]>([]);
  const [loadingComparisons, setLoadingComparisons] = useState(false);

  // Leaderboard state
  const [leaderboardGrade, setLeaderboardGrade] = useState("all");
  const [leaderboardSubject, setLeaderboardSubject] = useState("all");
  const [leaderboardSort, setLeaderboardSort] = useState<"completed" | "avgScore" | "highScores">("completed");
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Explorer & pagination state
  const [records, setRecords] = useState<KhanLearningRecordItem[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [selectedImportId, setSelectedImportId] = useState<string>("all");
  const [filterStudent, setFilterStudent] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterGrade, setFilterGrade] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
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
      grade: filterGrade === "all" ? undefined : filterGrade,
      subject: filterSubject === "all" ? undefined : filterSubject,
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
  }, [selectedImportId, filterStudent, filterStatus, filterGrade, filterSubject, searchKeyword, page, pageSize, t]);

  const loadStudentProfile = useCallback(async (name: string) => {
    if (!name) return;
    setLoadingProfile(true);
    const res = await getStudentLearningProfile(name);
    if (res.success && res.profile) {
      setStudentProfile(res.profile);
    } else {
      toast.error(res.error || "Failed to load student profile");
    }
    setLoadingProfile(false);
  }, []);

  const loadComparisons = useCallback(async () => {
    setLoadingComparisons(true);
    const res = await getMonthlyProgressComparison({
      grade: comparisonGrade === "all" ? undefined : comparisonGrade,
      subject: comparisonSubject === "all" ? undefined : comparisonSubject,
      className: comparisonClass === "all" ? undefined : comparisonClass,
      baselineDate: baselineDate || undefined,
      comparisonDate: comparisonDate || undefined,
    });

    if (res.success) {
      setComparisons(res.comparisons);
      setAvailableDates(res.availableDates);
      if (!baselineDate && res.baselineDateUsed) setBaselineDate(res.baselineDateUsed);
      if (!comparisonDate && res.comparisonDateUsed) setComparisonDate(res.comparisonDateUsed);
    } else {
      toast.error(res.error || "Failed to load comparisons");
    }
    setLoadingComparisons(false);
  }, [comparisonGrade, comparisonSubject, comparisonClass, baselineDate, comparisonDate]);

  const loadLeaderboard = useCallback(async () => {
    setLoadingLeaderboard(true);
    const res = await getKhanLeaderboard({
      grade: leaderboardGrade === "all" ? undefined : leaderboardGrade,
      subject: leaderboardSubject === "all" ? undefined : leaderboardSubject,
      sortBy: leaderboardSort,
    });

    if (res.success) {
      setLeaderboardEntries(res.entries);
    } else {
      toast.error(res.error || "Failed to load leaderboard");
    }
    setLoadingLeaderboard(false);
  }, [leaderboardGrade, leaderboardSubject, leaderboardSort]);

  // Dynamic filter state discovered from database and standard curricula
  const [dynamicGrades, setDynamicGrades] = useState<string[]>([
    "KG1", "KG2", "KG3", "1", "2", "3", "4", "5", "6", "7", "8"
  ]);
  const [dynamicSubjects, setDynamicSubjects] = useState<string[]>([
    "Books", "Early Learning", "ELA", "English", "Logic", "Math", "Maths", "Reading", "Science", "Social Studies", "Social-Emotional", "Writing"
  ]);
  const [dynamicClasses, setDynamicClasses] = useState<string[]>([]);

  const loadFilterOptions = useCallback(async () => {
    const res = await getKhanDynamicFilterOptions();
    if (res.success) {
      if (res.grades.length > 0) setDynamicGrades(res.grades);
      if (res.subjects.length > 0) setDynamicSubjects(res.subjects);
      if (res.classes.length > 0) setDynamicClasses(res.classes);
    }
  }, []);

  useEffect(() => {
    loadImports();
    loadFilterOptions();
  }, [loadImports, loadFilterOptions]);

  useEffect(() => {
    if (activeTab === "explorer") loadRecords();
    if (activeTab === "comparison") loadComparisons();
    if (activeTab === "leaderboard") loadLeaderboard();
  }, [activeTab, loadRecords, loadComparisons, loadLeaderboard]);

  // Aggregate stats & fully dynamic options
  const totalLearningRecords = useMemo(
    () => imports.reduce((acc, imp) => acc + (imp.records_count || 0), 0),
    [imports]
  );
  const uniqueGrades = useMemo(() => {
    const fromImports = imports.map((i) => i.grade).filter(Boolean);
    return Array.from(new Set([...dynamicGrades, ...fromImports])).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }, [dynamicGrades, imports]);

  const uniqueClasses = useMemo(() => {
    const fromImports = imports.map((i) => i.school_class_name).filter(Boolean);
    return Array.from(new Set([...dynamicClasses, ...fromImports])).sort();
  }, [dynamicClasses, imports]);

  const uniqueSubjects = useMemo(() => {
    const fromImports = imports.map((i) => i.subject).filter(Boolean);
    return Array.from(new Set([...dynamicSubjects, ...fromImports])).sort();
  }, [dynamicSubjects, imports]);

  // ───────────────────────────────────────────────────────────────────────────
  // Upload Handlers
  // ───────────────────────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      setUploadFile(selected);
      setParseState(null);
      setParsing(true);

      const formData = new FormData();
      formData.append("file", selected);

      const res = await parseKhanUpload(formData);
      setParsing(false);

      if (res.success) {
        setParseState(res);
        if (res.batchCount && res.batchCount > 1) {
          toast.success(`Archive unpacked: ${res.batchCount} report files ready for import.`);
        } else {
          toast.success("File parsed and validated successfully.");
        }
      } else {
        toast.error(res.error || "Invalid file");
        setUploadFile(null);
      }
    }
  };

  const handleSaveImport = async () => {
    if (!uploadFile) return;
    setSaving(true);

    const formData = new FormData();
    formData.append("file", uploadFile);

    const res = await saveKhanImport(formData);
    setSaving(false);

    if (res.success) {
      toast.success(res.message || `Successfully imported ${res.records_inserted} records!`);
      setUploadFile(null);
      setParseState(null);
      await Promise.all([loadImports(), loadFilterOptions()]);
      setActiveTab("history");
    } else {
      if (res.status === "duplicate") {
        toast.warning(res.message || "This exact file has already been imported.");
      } else {
        toast.error(res.message || "Failed to save import.");
      }
    }
  };

  // ───────────────────────────────────────────────────────────────────────────
  // Export Handlers
  // ───────────────────────────────────────────────────────────────────────────

  const handleExportCsv = async (scope: { importId?: string; studentName?: string; status?: string }) => {
    setExportingId(scope.importId || "all");
    const res = await getKhanExportData({
      importId: scope.importId,
      studentName: scope.studentName,
      status: scope.status,
      grade: filterGrade === "all" ? undefined : filterGrade,
      subject: filterSubject === "all" ? undefined : filterSubject,
    });
    setExportingId(null);

    if (res.success && res.rows) {
      downloadCsv(res.filename || "khan-data-export.csv", res.rows);
      toast.success(`Exported ${res.rows.length} records to CSV.`);
    } else {
      toast.error(res.error || "Export failed");
    }
  };

  const handleExportJson = async (scope: { importId?: string; studentName?: string }) => {
    setExportingId(scope.importId || "all");
    const res = await getKhanExportData(scope);
    setExportingId(null);

    if (res.success && res.jsonData) {
      downloadJson(`${res.filename || "khan-data"}-engineer-handoff.json`, res.jsonData);
      toast.success("Exported structured JSON package for Engineer Abiy.");
    } else {
      toast.error(res.error || "Export failed");
    }
  };

  const handleDownloadOriginalHtml = async (importId: string) => {
    setDownloadingHtmlId(importId);
    const res = await getSignedHtmlUrl(importId);
    setDownloadingHtmlId(null);

    if (res.success && res.signedUrl) {
      const a = document.createElement("a");
      a.href = res.signedUrl;
      a.download = res.filename || "khan_report.html";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Downloaded original file.");
    } else {
      toast.error(res.error || "Failed to generate download link.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={lang === "en" ? "Khan Academy Kids Analytics" : "የካን አካዳሚ ትምህርት ትንተና"}
        subtitle={
          lang === "en"
            ? "Student-level learning profiles, monthly comparisons, skill mastery, and evidence-based pilot reports."
            : "የተማሪዎች የትምህርት ውጤት፣ ወርሃዊ እድገት እና የተረጋገጠ የሙከራ ሪፖርት።"
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/khan-data/mappings">
              <Button variant="outline" size="sm" className="gap-2 border-royal-200 hover:bg-royal-50 text-royal-700">
                <Link2 className="h-4 w-4 text-royal-600" />
                {lang === "en" ? "Student Mappings" : "የተማሪዎች ግንኙነት"}
              </Button>
            </Link>
            <Button
              variant={activeTab === "upload" ? "primary" : "outline"}
              size="sm"
              onClick={() => setActiveTab("upload")}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              {lang === "en" ? "Upload Report" : "ሪፖርት አስገባ"}
            </Button>
          </div>
        }
      />

      {/* KPI Top Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {lang === "en" ? "Total Imports" : "ጠቅላላ ፋይሎች"}
              </p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">{imports.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">{uniqueClasses.length} classes recorded</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-royal-50 text-royal-700">
              <Database className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {lang === "en" ? "Activity Records" : "የትምህርት ተግባራት"}
              </p>
              <p className="text-2xl font-extrabold text-royal-800 mt-1 font-mono">
                {totalLearningRecords.toLocaleString()}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{uniqueSubjects.join(", ") || "General"}</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {lang === "en" ? "Active Grades" : "ክፍሎች"}
              </p>
              <p className="text-2xl font-extrabold text-slate-900 mt-1">
                {uniqueGrades.length > 0 ? uniqueGrades.join(", ") : "KG1 – KG3"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">Flexible grade support</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <GraduationCap className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-gradient-to-br from-white to-slate-50/50 shadow-sm">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {lang === "en" ? "Pilot Status" : "የሙከራ ሁኔታ"}
              </p>
              <p className="text-lg font-extrabold text-emerald-700 mt-1 flex items-center gap-1.5">
                <ShieldCheck className="h-5 w-5" />
                {lang === "en" ? "Evidence-Based" : "የተረጋገጠ"}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">1-Month Report Ready</p>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
              <Award className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 bg-white px-2 rounded-xl shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap",
            activeTab === "history"
              ? "border-royal-600 text-royal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <Database className="h-4 w-4" />
          {lang === "en" ? "Import History" : "የገቡ ሪፖርቶች"} ({imports.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("students")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap",
            activeTab === "students"
              ? "border-royal-600 text-royal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <Users className="h-4 w-4" />
          {lang === "en" ? "Student Learning Profiles" : "የተማሪዎች ውጤት መገለጫ"}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("comparison")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap",
            activeTab === "comparison"
              ? "border-royal-600 text-royal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <TrendingUp className="h-4 w-4" />
          {lang === "en" ? "Monthly Progress & Comparison" : "ወርሃዊ እድገት ማነፃፀሪያ"}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("leaderboard")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap",
            activeTab === "leaderboard"
              ? "border-royal-600 text-royal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <Trophy className="h-4 w-4" />
          {lang === "en" ? "Leaderboards & Rankings" : "የደረጃ ሰንጠረዥ"}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("explorer")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap",
            activeTab === "explorer"
              ? "border-royal-600 text-royal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <FileSpreadsheet className="h-4 w-4" />
          {lang === "en" ? "Activity Explorer" : "ዝርዝር ተግባራት"}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap",
            activeTab === "upload"
              ? "border-royal-600 text-royal-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          <Upload className="h-4 w-4" />
          {lang === "en" ? "Upload & Ingest" : "አዲስ ሪፖርት አስገባ"}
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: IMPORT HISTORY & RETENTION */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {lang === "en" ? "Ingested Khan Academy Reports" : "የገቡ የካን አካዳሚ ሪፖርቶች"}
              </h3>
              <p className="text-xs text-slate-500">
                {lang === "en"
                  ? "Every import is archived with original file retention, hash verification, and normalized activity extraction."
                  : "እያንዳንዱ ሪፖርት በዋናው ፋይል ተቀምጦ ትክክለኛነቱ የተረጋገጠ ነው።"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportCsv({})}
                className="gap-1.5 text-xs text-slate-700"
              >
                <Download className="h-3.5 w-3.5" />
                {lang === "en" ? "Export All CSV" : "ሁሉንም CSV አውርድ"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExportJson({})}
                className="gap-1.5 text-xs text-royal-700 border-royal-200 bg-royal-50/50"
              >
                <FileCode className="h-3.5 w-3.5" />
                {lang === "en" ? "Engineer Abiy Handoff (JSON)" : "የኢንጂነር አብይ ፓኬጅ (JSON)"}
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50/90 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                  <tr>
                    <th className="px-5 py-3.5">{lang === "en" ? "Report Date" : "ቀን"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Class & Grade" : "ክፍል"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Subject" : "የትምህርት አይነት"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "File Details" : "ፋይል"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Records" : "የተግባራት ብዛት"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Uploaded By" : "ያስገባው"}</th>
                    <th className="px-5 py-3.5 text-right">{lang === "en" ? "Actions" : "እርምጃዎች"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingImports ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                        {t("common.loading")}
                      </td>
                    </tr>
                  ) : imports.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                        <p className="font-semibold">{lang === "en" ? "No imports yet" : "ምንም የገባ ሪፖርት የለም"}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {lang === "en" ? "Upload an HTML or ZIP export from Khan Academy Kids." : "የካን አካዳሚ ፋይል ያስገቡ።"}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    imports.map((imp) => (
                      <tr key={imp.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-5 py-3.5">
                          <span className="font-mono font-bold text-slate-900">{imp.report_date}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div>
                            <p className="font-bold text-slate-900">{imp.school_class_name}</p>
                            <span className="inline-flex rounded-md bg-royal-50 px-2 py-0.5 text-[11px] font-semibold text-royal-700">
                              {imp.grade}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-semibold text-slate-700">{imp.subject}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="max-w-[200px] truncate text-xs text-slate-600" title={imp.original_filename}>
                            <p className="font-mono truncate">{imp.original_filename}</p>
                            <p className="text-[10px] text-slate-400 font-mono">hash: {imp.file_hash.slice(0, 8)}…</p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge tone="green" className="font-mono font-bold">
                            {imp.records_count} records
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600">
                          {imp.uploader_name}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Download Original File"
                              loading={downloadingHtmlId === imp.id}
                              onClick={() => handleDownloadOriginalHtml(imp.id)}
                              className="h-8 px-2 text-xs text-slate-600 hover:text-royal-700"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedImportId(imp.id);
                                setActiveTab("explorer");
                              }}
                              className="h-8 px-2 text-xs"
                            >
                              {lang === "en" ? "View Records" : "ተግባራት"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: STUDENT LEARNING PROFILES */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === "students" && (
        <div className="space-y-5">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="w-full sm:w-1/2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    {lang === "en" ? "Select Student" : "ተማሪ ይምረጡ"}
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder={lang === "en" ? "Search student name or ID…" : "ስም ወይም መለያ ፈልግ…"}
                      value={selectedStudentSearch}
                      onChange={(e) => setSelectedStudentSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && selectedStudentSearch.trim()) {
                          loadStudentProfile(selectedStudentSearch.trim());
                        }
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:border-royal-500 focus:outline-none focus:ring-2 focus:ring-royal-500/20"
                    />
                  </div>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => selectedStudentSearch.trim() && loadStudentProfile(selectedStudentSearch.trim())}
                    disabled={!selectedStudentSearch.trim()}
                    className="gap-2"
                  >
                    <Search className="h-4 w-4" />
                    {lang === "en" ? "Load Profile" : "መገለጫ ክፈት"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {loadingProfile ? (
            <div className="py-20 text-center text-sm text-slate-400">{t("common.loading")}</div>
          ) : studentProfile ? (
            <div className="space-y-6">
              {/* Profile Header Card */}
              <Card className="border-slate-200 shadow-sm bg-gradient-to-r from-royal-900 to-indigo-950 text-white">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-black">{studentProfile.studentName}</h2>
                        {studentProfile.officialStudent ? (
                          <Badge tone="green" className="bg-emerald-500 text-white">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Official Pilot Student
                          </Badge>
                        ) : (
                          <Badge tone="amber" className="bg-amber-500 text-slate-900">
                            Unmapped Khan Name
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-royal-200 mt-1 font-mono">
                        {studentProfile.officialStudent
                          ? `ID: ${studentProfile.officialStudent.student_code} · Grade: ${studentProfile.officialStudent.grade} (${studentProfile.officialStudent.section})`
                          : `Enrolled in: ${studentProfile.classes.join(", ") || "Khan Class"}`}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportCsv({ studentName: studentProfile.studentName })}
                      className="gap-1.5 text-xs bg-white/10 hover:bg-white/20 border-white/20 text-white"
                    >
                      <Download className="h-3.5 w-3.5" />
                      {lang === "en" ? "Export Student CSV" : "የተማሪውን CSV አውርድ"}
                    </Button>
                  </div>

                  {/* Top Stats Strip */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 border-t border-white/10 pt-4">
                    <div>
                      <p className="text-xs text-royal-200">{lang === "en" ? "Activities Completed" : "የተጠናቀቁ ተግባራት"}</p>
                      <p className="text-2xl font-black mt-0.5">{studentProfile.totalActivitiesAttempted}</p>
                    </div>
                    <div>
                      <p className="text-xs text-royal-200">{lang === "en" ? "Viewed Lessons" : "የታዩ ትምህርቶች"}</p>
                      <p className="text-2xl font-black mt-0.5">{studentProfile.totalActivitiesViewed}</p>
                    </div>
                    <div>
                      <p className="text-xs text-royal-200">{lang === "en" ? "Average Score" : "አማካይ ውጤት"}</p>
                      <p className="text-2xl font-black mt-0.5 font-mono">
                        {studentProfile.averageScorePercentage !== null ? `${studentProfile.averageScorePercentage}%` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-royal-200">{lang === "en" ? "Mastery Scores (≥80%)" : "ከፍተኛ ውጤት (≥80%)"}</p>
                      <p className="text-2xl font-black mt-0.5 text-emerald-300">{studentProfile.highScoreCount}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Subject Breakdown & Historical Timeline */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Subject Mastery */}
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-royal-600" />
                      {lang === "en" ? "Subject Performance Breakdown" : "የትምህርት አይነቶች ውጤት"}
                    </h3>
                    <div className="space-y-3">
                      {studentProfile.subjectBreakdown.map((sb) => (
                        <div key={sb.subject} className="rounded-xl border border-slate-100 p-3 bg-slate-50/50">
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-bold text-slate-900">{sb.subject}</span>
                            <span className="font-mono font-bold text-royal-800">
                              {sb.avgScore !== null ? `${sb.avgScore}% Avg` : "Viewed only"}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500 mt-1.5">
                            <span>{sb.attemptedCount} exercises completed</span>
                            <span>•</span>
                            <span>{sb.viewedCount} lessons viewed</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Report Dates / Timeline */}
                <Card className="border-slate-200 shadow-sm">
                  <CardContent className="p-5">
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-royal-600" />
                      {lang === "en" ? "Report Timeline & Snapshots" : "የሪፖርት ጊዜያት"}
                    </h3>
                    <div className="space-y-2.5">
                      {studentProfile.recentImports.map((ri) => (
                        <div key={ri.importId} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition">
                          <div>
                            <p className="text-xs font-bold text-slate-900">{ri.reportDate}</p>
                            <p className="text-[11px] text-slate-500">{ri.subject} · {ri.className}</p>
                          </div>
                          <div className="text-right">
                            <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                              {ri.attempted} completed
                            </span>
                            {ri.avgScore !== null && (
                              <p className="text-[11px] font-mono text-slate-500 mt-0.5">{ri.avgScore}% score</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Skill Mastery Tree */}
              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-royal-600" />
                    {lang === "en" ? "Activity & Skill Log" : "ዝርዝር ተግባራት እና ውጤቶች"} ({studentProfile.detailedSkills.length})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2.5">Level</th>
                          <th className="px-4 py-2.5">Activity / Skill</th>
                          <th className="px-4 py-2.5">Subject</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Score / Progress</th>
                          <th className="px-4 py-2.5">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {studentProfile.detailedSkills.slice(0, 50).map((skill, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50 transition">
                            <td className="px-4 py-2.5 text-xs font-mono text-slate-400">L{skill.categoryLevel}</td>
                            <td className="px-4 py-2.5 font-medium text-slate-900 max-w-[300px] truncate" title={skill.activitySkill}>
                              {skill.activitySkill}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-600">{skill.subject}</td>
                            <td className="px-4 py-2.5">
                              {skill.status === "attempted" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                                  <CheckCircle2 className="h-3 w-3" /> Completed
                                </span>
                              ) : skill.status === "viewed" ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-royal-100 px-2 py-0.5 text-[11px] font-bold text-royal-800">
                                  <Eye className="h-3 w-3" /> Viewed
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Unattempted</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs">
                              {skill.scorePercentage !== null ? (
                                <span className={cn(
                                  "font-bold",
                                  skill.scorePercentage >= 80 ? "text-emerald-700" : skill.scorePercentage >= 60 ? "text-amber-600" : "text-red-600"
                                )}>
                                  {skill.scorePercentage}%
                                </span>
                              ) : skill.progressRatio ? (
                                <span className="text-slate-600 font-semibold">{skill.progressRatio}</span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">{skill.reportDate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-20 text-slate-400">
              <Users className="h-10 w-10 text-slate-300" />
              <p className="text-sm font-semibold">
                {lang === "en" ? "Enter a student name above to view their comprehensive learning profile." : "የተማሪ ስም ጽፈው ይፈልጉ።"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: MONTHLY PROGRESS & BASELINE COMPARISON */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === "comparison" && (
        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {lang === "en" ? "Grade" : "ክፍል"}
                  </label>
                  <select
                    value={comparisonGrade}
                    onChange={(e) => setComparisonGrade(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">All Grades</option>
                    {uniqueGrades.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {lang === "en" ? "Subject" : "የትምህርት አይነት"}
                  </label>
                  <select
                    value={comparisonSubject}
                    onChange={(e) => setComparisonSubject(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">All Subjects</option>
                    {uniqueSubjects.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {lang === "en" ? "Class / Section" : "ክፍል / ቡድን"}
                  </label>
                  <select
                    value={comparisonClass}
                    onChange={(e) => setComparisonClass(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">All Classes</option>
                    {uniqueClasses.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {lang === "en" ? "Baseline Date" : "የመጀመሪያ ቀን"}
                  </label>
                  <select
                    value={baselineDate}
                    onChange={(e) => setBaselineDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {availableDates.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {lang === "en" ? "Comparison Date" : "የማነፃፀሪያ ቀን"}
                  </label>
                  <select
                    value={comparisonDate}
                    onChange={(e) => setComparisonDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    {availableDates.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={loadComparisons}
                    className="w-full gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {lang === "en" ? "Compare" : "አነፃፅር"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Comparison Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50/90 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                  <tr>
                    <th className="px-5 py-3.5">{lang === "en" ? "Student" : "ተማሪ"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Baseline Activities" : "የመጀመሪያ ተግባራት"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Current Activities" : "የአሁን ተግባራት"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Activity Growth" : "የትግበራ እድገት"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Score Change" : "የውጤት ለውጥ"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Newly Mastered Skills" : "አዲስ የተካኑ"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Requires Practice (<70%)" : "ልምምድ የሚሹ"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingComparisons ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                        {t("common.loading")}
                      </td>
                    </tr>
                  ) : comparisons.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                        {lang === "en" ? "No comparison data found for the selected dates." : "ምንም መረጃ አልተገኘም።"}
                      </td>
                    </tr>
                  ) : (
                    comparisons.map((c) => (
                      <tr key={c.khanStudentName} className="hover:bg-slate-50/50 transition">
                        <td className="px-5 py-3.5">
                          <div>
                            <p className="font-bold text-slate-900">
                              {c.officialStudentName || c.khanStudentName}
                            </p>
                            <span className="text-xs font-mono text-slate-400">
                              {c.studentCode ? `ID: ${c.studentCode}` : "Khan Name: " + c.khanStudentName}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-600">
                          {c.hasBaseline ? c.baselineAttempted : <span className="text-slate-400 italic">No baseline</span>}
                        </td>
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-900">
                          {c.comparisonAttempted}
                        </td>
                        <td className="px-5 py-3.5">
                          {c.hasBaseline ? (
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold font-mono",
                              c.attemptedGrowth >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                            )}>
                              {c.attemptedGrowth >= 0 ? `+${c.attemptedGrowth}` : c.attemptedGrowth}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono">
                          {c.scoreGrowth !== null ? (
                            <span className={cn(
                              "font-bold",
                              c.scoreGrowth >= 0 ? "text-emerald-600" : "text-amber-600"
                            )}>
                              {c.scoreGrowth >= 0 ? `+${c.scoreGrowth}%` : `${c.scoreGrowth}%`}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex rounded-md bg-royal-50 px-2 py-0.5 text-xs font-bold text-royal-700">
                            {c.newlyCompletedSkillsCount} new skills
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          {c.skillsNeedingPracticeCount > 0 ? (
                            <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                              {c.skillsNeedingPracticeCount} skills &lt;70%
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-600 font-semibold">All mastered</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: LEADERBOARDS & RANKINGS */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === "leaderboard" && (
        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {lang === "en" ? "Filter Grade" : "ክፍል"}
                  </label>
                  <select
                    value={leaderboardGrade}
                    onChange={(e) => setLeaderboardGrade(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">All Grades</option>
                    {uniqueGrades.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {lang === "en" ? "Filter Subject" : "የትምህርት አይነት"}
                  </label>
                  <select
                    value={leaderboardSubject}
                    onChange={(e) => setLeaderboardSubject(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">All Subjects</option>
                    {uniqueSubjects.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {lang === "en" ? "Ranking Metric" : "የደረጃ መስፈርት"}
                  </label>
                  <select
                    value={leaderboardSort}
                    onChange={(e) => setLeaderboardSort(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="completed">Total Completed Activities</option>
                    <option value="avgScore">Average Score Percentage</option>
                    <option value="highScores">Mastery Count (Score ≥80%)</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50/90 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                  <tr>
                    <th className="px-5 py-3.5">{lang === "en" ? "Rank" : "ደረጃ"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Student" : "ተማሪ"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Grade" : "ክፍል"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Completed Activities" : "የተጠናቀቁ"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Lessons Viewed" : "የታዩ"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Average Score" : "አማካይ"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Mastery (≥80%)" : "ከፍተኛ (≥80%)"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingLeaderboard ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                        {t("common.loading")}
                      </td>
                    </tr>
                  ) : leaderboardEntries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-400">
                        {lang === "en" ? "No leaderboard records found." : "ምንም መረጃ አልተገኘም።"}
                      </td>
                    </tr>
                  ) : (
                    leaderboardEntries.map((e) => (
                      <tr key={e.khanStudentName} className="hover:bg-slate-50/50 transition">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {e.rank === 1 ? (
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-400 text-slate-900 font-extrabold text-xs shadow-sm">
                                🥇
                              </span>
                            ) : e.rank === 2 ? (
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-300 text-slate-900 font-extrabold text-xs shadow-sm">
                                🥈
                              </span>
                            ) : e.rank === 3 ? (
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-600 text-white font-extrabold text-xs shadow-sm">
                                🥉
                              </span>
                            ) : (
                              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold text-xs font-mono">
                                #{e.rank}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div>
                            <p className="font-bold text-slate-900">{e.officialStudentName || e.khanStudentName}</p>
                            <span className="text-xs text-slate-400 font-mono">
                              {e.studentCode ? `ID: ${e.studentCode}` : "Khan Name: " + e.khanStudentName}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {e.grade} {e.section ? `· ${e.section}` : ""}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-mono font-extrabold text-slate-900">
                          {e.totalActivitiesCompleted}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-slate-500">
                          {e.totalViewed}
                        </td>
                        <td className="px-5 py-3.5 font-mono font-bold">
                          {e.averageScore !== null ? `${e.averageScore}%` : "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                            {e.highScoresCount}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 5: ACTIVITY EXPLORER */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === "explorer" && (
        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 sm:p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {lang === "en" ? "Filter Import" : "ሪፖርት"}
                  </label>
                  <select
                    value={selectedImportId}
                    onChange={(e) => {
                      setSelectedImportId(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">All Imports ({imports.length})</option>
                    {imports.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.school_class_name} · {i.subject} ({i.report_date})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {lang === "en" ? "Grade" : "ክፍል"}
                  </label>
                  <select
                    value={filterGrade}
                    onChange={(e) => {
                      setFilterGrade(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">All Grades</option>
                    {uniqueGrades.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {lang === "en" ? "Subject" : "የትምህርት አይነት"}
                  </label>
                  <select
                    value={filterSubject}
                    onChange={(e) => {
                      setFilterSubject(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">All Subjects</option>
                    {uniqueSubjects.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {lang === "en" ? "Status" : "ሁኔታ"}
                  </label>
                  <select
                    value={filterStatus}
                    onChange={(e) => {
                      setFilterStatus(e.target.value);
                      setPage(1);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  >
                    <option value="all">All Statuses</option>
                    <option value="attempted">Attempted / Scored</option>
                    <option value="viewed">Viewed</option>
                    <option value="unattempted">Unattempted</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    {lang === "en" ? "Search Keyword" : "ቁልፍ ቃል"}
                  </label>
                  <input
                    type="text"
                    placeholder="Search activity, skill, student…"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadRecords()}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={loadRecords} className="flex-1">
                    <Search className="h-4 w-4 mr-1.5" />
                    {lang === "en" ? "Search" : "ፈልግ"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExportCsv({ importId: selectedImportId })}
                    className="gap-1.5 text-xs px-2.5"
                    title={lang === "en" ? "Export Filtered CSV" : "CSV አውርድ"}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Records Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50/90 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200/80">
                  <tr>
                    <th className="px-5 py-3.5">{lang === "en" ? "Student" : "ተማሪ"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Activity / Skill" : "ተግባር"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Subject & Class" : "የትምህርት አይነት"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Status" : "ሁኔታ"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Score / Ratio" : "ውጤት"}</th>
                    <th className="px-5 py-3.5">{lang === "en" ? "Date" : "ቀን"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingRecords ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">
                        {t("common.loading")}
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-400">
                        {lang === "en" ? "No records match this filter." : "ምንም መረጃ አልተገኘም።"}
                      </td>
                    </tr>
                  ) : (
                    records.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition">
                        <td className="px-5 py-3.5">
                          <p className="font-bold text-slate-900">{r.official_student_name || r.khan_student_name}</p>
                          <span className="text-xs text-slate-400 font-mono">
                            {r.official_student_code ? `ID: ${r.official_student_code}` : "Khan Name: " + r.khan_student_name}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="max-w-[280px] truncate" title={r.activity_skill}>
                            <p className="font-medium text-slate-900 truncate">{r.activity_skill}</p>
                            <p className="text-[11px] text-slate-400">Level {r.category_level}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-600">
                          <p className="font-semibold">{r.subject}</p>
                          <p className="text-slate-400">{r.school_class_name}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          {r.status === "attempted" ? (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                              Attempted
                            </span>
                          ) : r.status === "viewed" ? (
                            <span className="inline-flex rounded-full bg-royal-100 px-2.5 py-0.5 text-xs font-bold text-royal-800">
                              Viewed
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Unattempted</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-sm">
                          {r.score_percentage !== null ? (
                            <span className="font-bold text-emerald-700">{r.score_percentage}%</span>
                          ) : r.progress_current !== null && r.progress_total !== null ? (
                            <span className="text-slate-600 font-semibold">{r.progress_current}/{r.progress_total}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-400 font-mono">{r.report_date}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600">
                <span>
                  Showing page {page} of {totalPages} ({totalCount.toLocaleString()} total items)
                </span>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-2 text-xs"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 px-2 text-xs"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────── */}
      {/* TAB 6: UPLOAD & INGESTION */}
      {/* ───────────────────────────────────────────────────────────────────── */}
      {activeTab === "upload" && (
        <div className="max-w-3xl mx-auto space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-6">
              <div className="text-center space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-royal-50 text-royal-700">
                  <Upload className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900">
                  {lang === "en" ? "Upload Khan Academy Kids Report" : "የካን አካዳሚ ሪፖርት አስገባ"}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {lang === "en"
                    ? "Upload individual HTML exports, CSV activity tables, or a ZIP archive containing multiple class reports."
                    : "የተመረጠውን የካን አካዳሚ HTML፣ CSV ወይም ZIP ፋይል ያስገቡ።"}
                </p>
              </div>

              <div className="mt-6">
                <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-8 hover:bg-royal-50/30 hover:border-royal-400 cursor-pointer transition">
                  <FileCode className="h-8 w-8 text-royal-600 mb-2" />
                  <span className="text-sm font-bold text-slate-700">
                    {uploadFile ? uploadFile.name : lang === "en" ? "Select ZIP, HTML, or CSV file" : "ፋይል ይምረጡ"}
                  </span>
                  <span className="text-xs text-slate-400 mt-1">Up to 25MB supported</span>
                  <input
                    type="file"
                    accept=".html,.htm,.zip,.csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              {parsing && (
                <div className="mt-4 p-4 text-center text-xs text-royal-700 bg-royal-50 rounded-xl">
                  {lang === "en" ? "Parsing & validating report structure…" : "ፋይሉ በመመርመር ላይ ነው…"}
                </div>
              )}

              {/* Parse Preview */}
              {parseState && parseState.success && (
                <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      {parseState.batchCount && parseState.batchCount > 1
                        ? `Multi-File Archive: ${parseState.batchCount} Reports Validated`
                        : "Report Validated Successfully"}
                    </div>
                  </div>

                  {parseState.result && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                        <span className="text-slate-400 block">Class:</span>
                        <span className="font-bold text-slate-900">{parseState.result.metadata.className}</span>
                      </div>
                      <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                        <span className="text-slate-400 block">Grade / Subject:</span>
                        <span className="font-bold text-slate-900">{parseState.result.metadata.grade} · {parseState.result.metadata.subject}</span>
                      </div>
                      <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                        <span className="text-slate-400 block">Report Date:</span>
                        <span className="font-bold text-slate-900">{parseState.result.metadata.reportDate}</span>
                      </div>
                      <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                        <span className="text-slate-400 block">Identified Students:</span>
                        <span className="font-bold text-slate-900">{parseState.result.students.length} students</span>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => { setUploadFile(null); setParseState(null); }}>
                      {lang === "en" ? "Cancel" : "ይቅር"}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      loading={saving}
                      onClick={handleSaveImport}
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {lang === "en" ? "Confirm & Ingest Records" : "አስገባ"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
