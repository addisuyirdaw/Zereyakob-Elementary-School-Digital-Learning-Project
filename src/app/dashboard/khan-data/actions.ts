"use server";

import { parseKhanExport, parseKhanHtml, type ParseResult } from "@/lib/khan-parser";
import { createClient } from "@/lib/supabase/server";
import JSZip from "jszip";

// ─────────────────────────────────────────────────────────────────────────────
// ZIP Extraction Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface ExtractedFile {
  filename: string;
  buffer: Uint8Array;
}

async function extractFilesFromZip(zipBuffer: ArrayBuffer): Promise<ExtractedFile[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch {
    throw new Error("Invalid or corrupted ZIP archive.");
  }

  const results: ExtractedFile[] = [];
  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

  for (const [relativePath, entry] of Object.entries(zip.files)) {
    // Skip directories and metadata/hidden files
    if (entry.dir) continue;
    const baseName = relativePath.split(/[\\/]/).pop() || "";
    if (baseName.startsWith(".") || relativePath.includes("__MACOSX")) continue;

    // Security check: avoid directory traversal
    if (relativePath.includes("..") || relativePath.startsWith("/") || relativePath.startsWith("\\")) {
      continue;
    }

    const lower = baseName.toLowerCase();
    if (!lower.endsWith(".html") && !lower.endsWith(".htm") && !lower.endsWith(".csv")) {
      continue;
    }

    const uint8 = await entry.async("uint8array");
    if (uint8.byteLength > MAX_FILE_SIZE) {
      throw new Error(`File ${baseName} in ZIP exceeds 25MB limit.`);
    }

    results.push({
      filename: baseName,
      buffer: uint8,
    });
  }

  if (results.length === 0) {
    throw new Error("No supported HTML or CSV report files found inside the ZIP archive.");
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload & Parse Preview Action
// ─────────────────────────────────────────────────────────────────────────────

export type UploadActionState = {
  success: boolean;
  result?: ParseResult;
  batchCount?: number;
  files?: Array<{ filename: string; result: ParseResult }>;
  error?: string;
};

export async function parseKhanUpload(formData: FormData): Promise<UploadActionState> {
  try {
    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, error: "No file provided" };
    }

    const nameLower = file.name.toLowerCase();
    const isZip = nameLower.endsWith(".zip");
    const isHtml = nameLower.endsWith(".html") || nameLower.endsWith(".htm");
    const isCsv = nameLower.endsWith(".csv");

    if (!isZip && !isHtml && !isCsv) {
      return { success: false, error: "Invalid file type. Only ZIP, HTML, or CSV files are supported." };
    }

    if (file.size > 25 * 1024 * 1024) {
      return { success: false, error: "File exceeds 25MB size limit." };
    }

    const arrayBuffer = await file.arrayBuffer();

    if (isZip) {
      const extracted = await extractFilesFromZip(arrayBuffer);
      const parsedFiles: Array<{ filename: string; result: ParseResult }> = [];

      for (const item of extracted) {
        const text = new TextDecoder().decode(item.buffer);
        const res = parseKhanExport(text, item.filename);
        parsedFiles.push({ filename: item.filename, result: res });
      }

      return {
        success: true,
        batchCount: parsedFiles.length,
        files: parsedFiles,
        result: parsedFiles[0]?.result,
      };
    }

    const text = new TextDecoder().decode(new Uint8Array(arrayBuffer));
    const result = parseKhanExport(text, file.name);

    return {
      success: true,
      result,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to parse the Khan Academy export.",
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Save Import Action (Handles Single HTML/CSV or Multi-File ZIP)
// ─────────────────────────────────────────────────────────────────────────────

export type FileImportResult = {
  filename: string;
  success: boolean;
  status: "success" | "duplicate" | "validation_error" | "storage_error" | "unexpected_error";
  importId?: string;
  recordsInserted?: number;
  message?: string;
};

export type SaveImportResponse = {
  success: boolean;
  status: "success" | "duplicate" | "validation_error" | "unauthorized" | "storage_error" | "partial_success" | "unexpected_error";
  message?: string;
  import_id?: string;
  records_inserted?: number;
  total_files?: number;
  successful_files?: number;
  file_results?: FileImportResult[];
};

export async function saveKhanImport(formData: FormData): Promise<SaveImportResponse> {
  try {
    const file = formData.get("file") as File | null;
    if (!file) {
      return { success: false, status: "validation_error", message: "No file provided" };
    }

    const nameLower = file.name.toLowerCase();
    const isZip = nameLower.endsWith(".zip");
    const isHtml = nameLower.endsWith(".html") || nameLower.endsWith(".htm");
    const isCsv = nameLower.endsWith(".csv");

    if (!isZip && !isHtml && !isCsv) {
      return { success: false, status: "validation_error", message: "Only ZIP, HTML, and CSV files are allowed." };
    }

    if (file.size > 25 * 1024 * 1024) {
      return { success: false, status: "validation_error", message: "File exceeds 25MB limit." };
    }

    const supabase = await createClient();
    if (!supabase) {
      return { success: false, status: "unexpected_error", message: "Database configuration error" };
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, status: "unauthorized", message: "You must be signed in to upload records." };
    }

    const arrayBuffer = await file.arrayBuffer();
    let filesToProcess: ExtractedFile[] = [];

    if (isZip) {
      try {
        filesToProcess = await extractFilesFromZip(arrayBuffer);
      } catch (err: any) {
        return { success: false, status: "validation_error", message: err.message || "Corrupt ZIP file." };
      }
    } else {
      filesToProcess = [{
        filename: file.name,
        buffer: new Uint8Array(arrayBuffer),
      }];
    }

    const fileResults: FileImportResult[] = [];
    let totalRecordsInserted = 0;
    let successfulFiles = 0;
    let lastImportId: string | undefined;

    for (const item of filesToProcess) {
      try {
        // Hash computation for idempotency
        const hashBuffer = await crypto.subtle.digest("SHA-256", item.buffer as unknown as BufferSource);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const file_hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

        // Parse content
        const text = new TextDecoder().decode(item.buffer);
        const parsed = parseKhanExport(text, item.filename);

        // Upload original raw file to secure Supabase storage
        const fileUuid = crypto.randomUUID();
        const ext = item.filename.toLowerCase().endsWith(".csv") ? "csv" : "html";
        const storagePath = `${user.id}/${fileUuid}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("khan_exports")
          .upload(storagePath, item.buffer, {
            contentType: ext === "csv" ? "text/csv" : "text/html",
            upsert: false,
          });

        if (uploadError) {
          fileResults.push({
            filename: item.filename,
            success: false,
            status: "storage_error",
            message: "Failed to upload file to storage.",
          });
          continue;
        }

        // Database insertion via RPC
        const payload = {
          file_hash,
          storage_path: storagePath,
          original_filename: item.filename,
          report_date: parsed.metadata.reportDate,
          grade: parsed.metadata.grade,
          subject: parsed.metadata.subject,
          school_class_name: parsed.metadata.className,
          records: parsed.records,
        };

        const { data: rpcData, error: rpcError } = await supabase.rpc("fn_insert_khan_batch", { payload });

        if (rpcError) {
          await supabase.storage.from("khan_exports").remove([storagePath]); // cleanup orphaned storage object

          if (rpcError.message?.includes("DUPLICATE_FILE")) {
            fileResults.push({
              filename: item.filename,
              success: false,
              status: "duplicate",
              message: "Exact report has already been imported.",
            });
          } else {
            fileResults.push({
              filename: item.filename,
              success: false,
              status: "validation_error",
              message: rpcError.message || "Validation failed during import.",
            });
          }
          continue;
        }

        successfulFiles++;
        const inserted = rpcData?.records_inserted || parsed.records.length;
        totalRecordsInserted += inserted;
        lastImportId = rpcData?.import_id;

        fileResults.push({
          filename: item.filename,
          success: true,
          status: "success",
          importId: rpcData?.import_id,
          recordsInserted: inserted,
          message: `Successfully imported ${inserted} learning records.`,
        });
      } catch (err: any) {
        fileResults.push({
          filename: item.filename,
          success: false,
          status: "unexpected_error",
          message: err.message || "Failed to process file.",
        });
      }
    }

    if (successfulFiles === filesToProcess.length && filesToProcess.length === 1) {
      return {
        success: true,
        status: "success",
        import_id: lastImportId,
        records_inserted: totalRecordsInserted,
        total_files: 1,
        successful_files: 1,
        file_results: fileResults,
      };
    }

    if (successfulFiles > 0) {
      return {
        success: true,
        status: successfulFiles === filesToProcess.length ? "success" : "partial_success",
        message: `Imported ${successfulFiles} of ${filesToProcess.length} files (${totalRecordsInserted} records total).`,
        import_id: lastImportId,
        records_inserted: totalRecordsInserted,
        total_files: filesToProcess.length,
        successful_files: successfulFiles,
        file_results: fileResults,
      };
    }

    const firstFailure = fileResults[0];
    return {
      success: false,
      status: firstFailure?.status || "validation_error",
      message: firstFailure?.message || "No files could be imported.",
      total_files: filesToProcess.length,
      successful_files: 0,
      file_results: fileResults,
    };
  } catch (err: any) {
    return { success: false, status: "unexpected_error", message: err.message || "Server error occurred." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Import History & Explorer Actions
// ─────────────────────────────────────────────────────────────────────────────

export type KhanImportSummary = {
  id: string;
  uploaded_by: string | null;
  original_filename: string;
  file_hash: string;
  storage_path: string;
  report_date: string;
  grade: string;
  subject: string;
  school_class_name: string;
  created_at: string;
  records_count: number;
  uploader_name?: string;
};

export async function getKhanImports(): Promise<{
  success: boolean;
  imports: KhanImportSummary[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    if (!supabase) return { success: false, imports: [], error: "Database not configured." };

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) return { success: false, imports: [], error: "Unauthorized" };

    const { data, error } = await supabase
      .from("khan_imports")
      .select(`
        id,
        uploaded_by,
        original_filename,
        file_hash,
        storage_path,
        report_date,
        grade,
        subject,
        school_class_name,
        created_at,
        khan_learning_records(count)
      `)
      .order("created_at", { ascending: false });

    if (error) return { success: false, imports: [], error: error.message };

    const uploaderIds = Array.from(new Set((data || []).map((i: any) => i.uploaded_by).filter(Boolean)));
    const profileMap = new Map<string, string>();
    if (uploaderIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", uploaderIds);
      if (profiles) {
        profiles.forEach((p: any) => {
          const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email;
          profileMap.set(p.id, name);
        });
      }
    }

    const summaries: KhanImportSummary[] = (data || []).map((row: any) => {
      const countArr = row.khan_learning_records || [];
      const recordCount = Array.isArray(countArr) && countArr.length > 0
        ? countArr[0].count
        : (typeof countArr === "object" && countArr?.count !== undefined ? countArr.count : 0);

      return {
        id: row.id,
        uploaded_by: row.uploaded_by,
        original_filename: row.original_filename,
        file_hash: row.file_hash,
        storage_path: row.storage_path,
        report_date: row.report_date,
        grade: row.grade,
        subject: row.subject,
        school_class_name: row.school_class_name,
        created_at: row.created_at,
        records_count: recordCount ?? 0,
        uploader_name: row.uploaded_by ? profileMap.get(row.uploaded_by) || "Staff Member" : "System",
      };
    });

    return { success: true, imports: summaries };
  } catch (err: any) {
    return { success: false, imports: [], error: err.message || "Failed to load imports." };
  }
}

export async function getKhanDynamicFilterOptions(): Promise<{
  success: boolean;
  grades: string[];
  subjects: string[];
  classes: string[];
}> {
  try {
    const supabase = await createClient();
    if (!supabase) return { success: false, grades: [], subjects: [], classes: [] };

    const [impRes, stuRes] = await Promise.all([
      supabase.from("khan_imports").select("grade, subject, school_class_name"),
      supabase.from("students").select("grade, section"),
    ]);

    const defaultGrades = ["KG1", "KG2", "KG3", "1", "2", "3", "4", "5", "6", "7", "8"];
    const impGrades = (impRes.data || []).map((i: any) => i.grade);
    const stuGrades = (stuRes.data || []).map((s: any) => s.grade);
    const grades = Array.from(new Set([...defaultGrades, ...impGrades, ...stuGrades].filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true })
    );

    const defaultSubjects = [
      "Books",
      "Early Learning",
      "ELA",
      "English",
      "Logic",
      "Math",
      "Maths",
      "Reading",
      "Science",
      "Social Studies",
      "Social-Emotional",
      "Writing",
    ];
    const impSubjects = (impRes.data || []).map((i: any) => i.subject);
    const subjects = Array.from(new Set([...defaultSubjects, ...impSubjects].filter(Boolean))).sort();

    const impClasses = (impRes.data || []).map((i: any) => i.school_class_name);
    const stuClasses = (stuRes.data || []).map((s: any) =>
      s.grade && s.section ? `${s.grade} - ${s.section}` : s.grade || s.section
    );
    const classes = Array.from(new Set([...impClasses, ...stuClasses].filter(Boolean))).sort();

    return { success: true, grades, subjects, classes };
  } catch {
    return { success: false, grades: [], subjects: [], classes: [] };
  }
}

export type KhanLearningRecordItem = {
  id: string;
  import_id: string;
  khan_student_name: string;
  category_level: string;
  activity_skill: string;
  progress_current: number | null;
  progress_total: number | null;
  score_percentage: number | null;
  status: "viewed" | "attempted" | "unattempted";
  created_at: string;
  mapped_student_id?: string | null;
  official_student_name?: string | null;
  official_student_code?: string | null;
  report_date?: string;
  grade?: string;
  subject?: string;
  school_class_name?: string;
};

export type GetRecordsParams = {
  importId?: string;
  studentName?: string;
  status?: string;
  search?: string;
  grade?: string;
  subject?: string;
  page?: number;
  pageSize?: number;
};

export async function getKhanLearningRecords(params: GetRecordsParams): Promise<{
  success: boolean;
  records: KhanLearningRecordItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return { success: false, records: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0, error: "Database not configured." };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, records: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0, error: "Unauthorized" };
    }

    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(10, params.pageSize || 25));
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("khan_learning_records")
      .select(`
        id,
        import_id,
        khan_student_name,
        category_level,
        activity_skill,
        progress_current,
        progress_total,
        score_percentage,
        status,
        created_at,
        khan_imports!inner (
          report_date,
          grade,
          subject,
          school_class_name
        )
      `, { count: "exact" });

    if (params.importId && params.importId !== "all") {
      query = query.eq("import_id", params.importId);
    }
    if (params.studentName) {
      query = query.ilike("khan_student_name", `%${params.studentName.trim()}%`);
    }
    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }
    if (params.grade && params.grade !== "all") {
      query = query.eq("khan_imports.grade", params.grade);
    }
    if (params.subject && params.subject !== "all") {
      query = query.eq("khan_imports.subject", params.subject);
    }
    if (params.search) {
      const s = params.search.trim();
      query = query.or(`activity_skill.ilike.%${s}%,category_level.ilike.%${s}%,khan_student_name.ilike.%${s}%`);
    }

    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;
    if (error) {
      return { success: false, records: [], totalCount: 0, page, pageSize, totalPages: 0, error: error.message };
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    // Mappings lookup
    const uniqueStudentNames = Array.from(new Set((data || []).map((r: any) => r.khan_student_name)));
    const mappingMap = new Map<string, { student_id: string; official_name?: string; student_code?: string }>();

    if (uniqueStudentNames.length > 0) {
      const { data: mappings } = await supabase
        .from("khan_student_mappings")
        .select(`
          khan_student_name,
          school_class_name,
          student_id,
          students (
            first_name,
            last_name,
            student_code
          )
        `)
        .in("khan_student_name", uniqueStudentNames);

      if (mappings) {
        mappings.forEach((m: any) => {
          const key = `${m.khan_student_name}__${m.school_class_name}`;
          const stu = m.students as any;
          const officialName = stu ? `${stu.first_name} ${stu.last_name}` : undefined;
          mappingMap.set(key, {
            student_id: m.student_id,
            official_name: officialName,
            student_code: stu?.student_code,
          });
        });
      }
    }

    const records: KhanLearningRecordItem[] = (data || []).map((r: any) => {
      const imp = r.khan_imports as any;
      const mapKey = `${r.khan_student_name}__${imp?.school_class_name || ""}`;
      const mapping = mappingMap.get(mapKey);

      return {
        id: r.id,
        import_id: r.import_id,
        khan_student_name: r.khan_student_name,
        category_level: r.category_level,
        activity_skill: r.activity_skill,
        progress_current: r.progress_current,
        progress_total: r.progress_total,
        score_percentage: r.score_percentage,
        status: r.status,
        created_at: r.created_at,
        report_date: imp?.report_date,
        grade: imp?.grade,
        subject: imp?.subject,
        school_class_name: imp?.school_class_name,
        mapped_student_id: mapping?.student_id || null,
        official_student_name: mapping?.official_name || null,
        official_student_code: mapping?.student_code || null,
      };
    });

    return {
      success: true,
      records,
      totalCount,
      page,
      pageSize,
      totalPages,
    };
  } catch (err: any) {
    return { success: false, records: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0, error: err.message || "Failed to fetch records." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 3: Student Learning Profile Action
// ─────────────────────────────────────────────────────────────────────────────

export type StudentLearningProfile = {
  studentName: string;
  officialStudent?: {
    id: string;
    student_code: string;
    first_name: string;
    last_name: string;
    grade: string;
    section: string;
  } | null;
  classes: string[];
  totalActivitiesAttempted: number;
  totalActivitiesViewed: number;
  totalActivitiesUnattempted: number;
  averageScorePercentage: number | null;
  highScoreCount: number; // score >= 80%
  subjectBreakdown: Array<{
    subject: string;
    attemptedCount: number;
    viewedCount: number;
    avgScore: number | null;
    completionRatio?: string;
  }>;
  recentImports: Array<{
    importId: string;
    reportDate: string;
    subject: string;
    className: string;
    attempted: number;
    viewed: number;
    avgScore: number | null;
  }>;
  detailedSkills: Array<{
    categoryLevel: string;
    activitySkill: string;
    status: string;
    scorePercentage: number | null;
    progressRatio: string | null;
    reportDate: string;
    subject: string;
  }>;
};

export async function getStudentLearningProfile(studentIdentifier: string): Promise<{
  success: boolean;
  profile?: StudentLearningProfile;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    if (!supabase) return { success: false, error: "Database not configured." };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    // 1. Resolve student (check if studentIdentifier is a UUID or name)
    let khanNames: string[] = [studentIdentifier];
    let officialStudent: any = null;

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(studentIdentifier);
    if (isUuid) {
      const { data: stu } = await supabase
        .from("students")
        .select("id, student_code, first_name, last_name, grade, section")
        .eq("id", studentIdentifier)
        .maybeSingle();

      if (stu) {
        officialStudent = stu;
        const { data: mappings } = await supabase
          .from("khan_student_mappings")
          .select("khan_student_name")
          .eq("student_id", stu.id);

        if (mappings && mappings.length > 0) {
          khanNames = mappings.map((m) => m.khan_student_name);
        } else {
          khanNames = [`${stu.first_name} ${stu.last_name}`, stu.first_name];
        }
      }
    } else {
      // Find mapping by name
      const { data: mappings } = await supabase
        .from("khan_student_mappings")
        .select(`
          khan_student_name,
          student_id,
          students (
            id, student_code, first_name, last_name, grade, section
          )
        `)
        .eq("khan_student_name", studentIdentifier);

      if (mappings && mappings.length > 0 && mappings[0].students) {
        officialStudent = mappings[0].students;
      }
    }

    // 2. Fetch learning records for resolved Khan names
    const { data: rawRecords, error: recError } = await supabase
      .from("khan_learning_records")
      .select(`
        id,
        import_id,
        khan_student_name,
        category_level,
        activity_skill,
        progress_current,
        progress_total,
        score_percentage,
        status,
        created_at,
        khan_imports (
          id,
          report_date,
          grade,
          subject,
          school_class_name
        )
      `)
      .in("khan_student_name", khanNames)
      .limit(5000);

    if (recError) return { success: false, error: recError.message };

    const records = rawRecords || [];
    if (records.length === 0) {
      return {
        success: true,
        profile: {
          studentName: officialStudent ? `${officialStudent.first_name} ${officialStudent.last_name}` : studentIdentifier,
          officialStudent,
          classes: [],
          totalActivitiesAttempted: 0,
          totalActivitiesViewed: 0,
          totalActivitiesUnattempted: 0,
          averageScorePercentage: null,
          highScoreCount: 0,
          subjectBreakdown: [],
          recentImports: [],
          detailedSkills: [],
        },
      };
    }

    // Aggregations
    const attempted = records.filter((r) => r.status === "attempted");
    const viewed = records.filter((r) => r.status === "viewed");
    const unattempted = records.filter((r) => r.status === "unattempted");
    const scores = records.map((r) => r.score_percentage).filter((s): s is number => s !== null && s !== undefined);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const highScoreCount = scores.filter((s) => s >= 80).length;

    const classesSet = new Set<string>();
    const subjectsMap = new Map<string, { attempted: number; viewed: number; scores: number[] }>();
    const importsMap = new Map<string, { reportDate: string; subject: string; className: string; attempted: number; viewed: number; scores: number[] }>();

    for (const r of records) {
      const imp = r.khan_imports as any;
      if (imp?.school_class_name) classesSet.add(imp.school_class_name);

      const subj = imp?.subject || "General";
      const sEntry = subjectsMap.get(subj) || { attempted: 0, viewed: 0, scores: [] as number[] };
      if (r.status === "attempted") sEntry.attempted++;
      if (r.status === "viewed") sEntry.viewed++;
      if (r.score_percentage !== null && r.score_percentage !== undefined) sEntry.scores.push(r.score_percentage);
      subjectsMap.set(subj, sEntry);

      if (imp?.id) {
        const iEntry = importsMap.get(imp.id) || {
          reportDate: imp.report_date,
          subject: imp.subject,
          className: imp.school_class_name,
          attempted: 0,
          viewed: 0,
          scores: [] as number[],
        };
        if (r.status === "attempted") iEntry.attempted++;
        if (r.status === "viewed") iEntry.viewed++;
        if (r.score_percentage !== null && r.score_percentage !== undefined) iEntry.scores.push(r.score_percentage);
        importsMap.set(imp.id, iEntry);
      }
    }

    const subjectBreakdown = Array.from(subjectsMap.entries()).map(([subject, val]) => ({
      subject,
      attemptedCount: val.attempted,
      viewedCount: val.viewed,
      avgScore: val.scores.length > 0 ? Math.round(val.scores.reduce((a, b) => a + b, 0) / val.scores.length) : null,
    }));

    const recentImports = Array.from(importsMap.entries()).map(([importId, val]) => ({
      importId,
      reportDate: val.reportDate,
      subject: val.subject,
      className: val.className,
      attempted: val.attempted,
      viewed: val.viewed,
      avgScore: val.scores.length > 0 ? Math.round(val.scores.reduce((a, b) => a + b, 0) / val.scores.length) : null,
    })).sort((a, b) => b.reportDate.localeCompare(a.reportDate));

    const detailedSkills = records.map((r) => {
      const imp = r.khan_imports as any;
      const progressRatio = r.progress_current !== null && r.progress_total !== null
        ? `${r.progress_current}/${r.progress_total}`
        : null;

      return {
        categoryLevel: r.category_level,
        activitySkill: r.activity_skill,
        status: r.status,
        scorePercentage: r.score_percentage,
        progressRatio,
        reportDate: imp?.report_date || "",
        subject: imp?.subject || "",
      };
    });

    return {
      success: true,
      profile: {
        studentName: officialStudent ? `${officialStudent.first_name} ${officialStudent.last_name}` : khanNames[0],
        officialStudent,
        classes: Array.from(classesSet),
        totalActivitiesAttempted: attempted.length,
        totalActivitiesViewed: viewed.length,
        totalActivitiesUnattempted: unattempted.length,
        averageScorePercentage: avgScore,
        highScoreCount,
        subjectBreakdown,
        recentImports,
        detailedSkills,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load student profile." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4: Monthly Progress & Baseline Comparison Action
// ─────────────────────────────────────────────────────────────────────────────

export type MonthlyComparisonRow = {
  khanStudentName: string;
  officialStudentName?: string;
  studentCode?: string;
  grade: string;
  subject: string;
  baselineDate: string;
  comparisonDate: string;
  baselineAttempted: number;
  comparisonAttempted: number;
  attemptedGrowth: number;
  baselineAvgScore: number | null;
  comparisonAvgScore: number | null;
  scoreGrowth: number | null;
  newlyCompletedSkillsCount: number;
  skillsNeedingPracticeCount: number; // Attempted with score < 70%
  hasBaseline: boolean;
};

export async function getMonthlyProgressComparison(params: {
  grade?: string;
  subject?: string;
  className?: string;
  baselineDate?: string;
  comparisonDate?: string;
}): Promise<{
  success: boolean;
  comparisons: MonthlyComparisonRow[];
  baselineDateUsed?: string;
  comparisonDateUsed?: string;
  availableDates: string[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    if (!supabase) return { success: false, comparisons: [], availableDates: [], error: "Database not configured." };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, comparisons: [], availableDates: [], error: "Unauthorized" };

    // Fetch all distinct report dates for this scope
    let impQuery = supabase
      .from("khan_imports")
      .select("id, report_date, grade, subject, school_class_name")
      .order("report_date", { ascending: true });

    if (params.grade && params.grade !== "all") impQuery = impQuery.eq("grade", params.grade);
    if (params.subject && params.subject !== "all") impQuery = impQuery.eq("subject", params.subject);
    if (params.className && params.className !== "all") impQuery = impQuery.eq("school_class_name", params.className);

    const { data: importsList, error: impError } = await impQuery;
    if (impError) return { success: false, comparisons: [], availableDates: [], error: impError.message };

    const allImports = importsList || [];
    const availableDates = Array.from(new Set(allImports.map((i) => i.report_date))).sort();

    if (availableDates.length === 0) {
      return { success: true, comparisons: [], availableDates: [] };
    }

    const baselineDate = params.baselineDate || availableDates[0];
    const comparisonDate = params.comparisonDate || availableDates[availableDates.length - 1];

    const baselineImports = allImports.filter((i) => i.report_date === baselineDate);
    const comparisonImports = allImports.filter((i) => i.report_date === comparisonDate);

    const baselineImportIds = baselineImports.map((i) => i.id);
    const comparisonImportIds = comparisonImports.map((i) => i.id);

    // Fetch records for baseline and comparison imports
    const [baselineRes, comparisonRes, mappingsRes] = await Promise.all([
      baselineImportIds.length > 0
        ? supabase.from("khan_learning_records").select("import_id, khan_student_name, activity_skill, status, score_percentage").in("import_id", baselineImportIds)
        : { data: [] },
      comparisonImportIds.length > 0
        ? supabase.from("khan_learning_records").select("import_id, khan_student_name, activity_skill, status, score_percentage").in("import_id", comparisonImportIds)
        : { data: [] },
      supabase.from("khan_student_mappings").select(`
        khan_student_name,
        school_class_name,
        student_id,
        students ( first_name, last_name, student_code, grade, section )
      `),
    ]);

    const baseRecords = (baselineRes.data || []) as any[];
    const compRecords = (comparisonRes.data || []) as any[];
    const mappings = (mappingsRes.data || []) as any[];

    const mappingMap = new Map<string, any>();
    mappings.forEach((m) => {
      const stu = m.students;
      mappingMap.set(m.khan_student_name, {
        officialName: stu ? `${stu.first_name} ${stu.last_name}` : undefined,
        studentCode: stu?.student_code,
      });
    });

    // Group by student
    const studentNames = Array.from(new Set([...baseRecords.map((r) => r.khan_student_name), ...compRecords.map((r) => r.khan_student_name)])).sort();

    const comparisons: MonthlyComparisonRow[] = studentNames.map((name) => {
      const bStudentRecs = baseRecords.filter((r) => r.khan_student_name === name);
      const cStudentRecs = compRecords.filter((r) => r.khan_student_name === name);

      const hasBaseline = bStudentRecs.length > 0 && baselineDate !== comparisonDate;

      const bAttempted = bStudentRecs.filter((r) => r.status === "attempted").length;
      const cAttempted = cStudentRecs.filter((r) => r.status === "attempted").length;
      const attemptedGrowth = cAttempted - bAttempted;

      const bScores = bStudentRecs.map((r) => r.score_percentage).filter((s): s is number => s !== null && s !== undefined);
      const cScores = cStudentRecs.map((r) => r.score_percentage).filter((s): s is number => s !== null && s !== undefined);

      const bAvg = bScores.length > 0 ? Math.round(bScores.reduce((a, b) => a + b, 0) / bScores.length) : null;
      const cAvg = cScores.length > 0 ? Math.round(cScores.reduce((a, b) => a + b, 0) / cScores.length) : null;
      const scoreGrowth = bAvg !== null && cAvg !== null ? cAvg - bAvg : null;

      // Newly completed skills
      const bAttemptedSkills = new Set(bStudentRecs.filter((r) => r.status === "attempted").map((r) => r.activity_skill));
      const newlyCompletedSkillsCount = cStudentRecs.filter((r) => r.status === "attempted" && !bAttemptedSkills.has(r.activity_skill)).length;

      // Skills needing practice (attempted but score < 70%)
      const skillsNeedingPracticeCount = cStudentRecs.filter((r) => r.status === "attempted" && r.score_percentage !== null && r.score_percentage < 70).length;

      const mapping = mappingMap.get(name);
      const firstComp = comparisonImports[0] || baselineImports[0];

      return {
        khanStudentName: name,
        officialStudentName: mapping?.officialName,
        studentCode: mapping?.studentCode,
        grade: firstComp?.grade || params.grade || "KG",
        subject: firstComp?.subject || params.subject || "General",
        baselineDate,
        comparisonDate,
        baselineAttempted: bAttempted,
        comparisonAttempted: cAttempted,
        attemptedGrowth,
        baselineAvgScore: bAvg,
        comparisonAvgScore: cAvg,
        scoreGrowth,
        newlyCompletedSkillsCount,
        skillsNeedingPracticeCount,
        hasBaseline,
      };
    });

    return {
      success: true,
      comparisons,
      baselineDateUsed: baselineDate,
      comparisonDateUsed: comparisonDate,
      availableDates,
    };
  } catch (err: any) {
    return { success: false, comparisons: [], availableDates: [], error: err.message || "Failed to load monthly comparisons." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5: Rankings & Leaderboards Action
// ─────────────────────────────────────────────────────────────────────────────

export type LeaderboardEntry = {
  rank: number;
  khanStudentName: string;
  officialStudentName?: string;
  studentCode?: string;
  isMapped: boolean;
  grade: string;
  section?: string;
  totalActivitiesCompleted: number; // Attempted activities
  totalViewed: number;
  averageScore: number | null;
  highScoresCount: number; // >= 80%
  growthActivities?: number;
  lastActiveDate: string;
};

export async function getKhanLeaderboard(params: {
  grade?: string;
  subject?: string;
  sortBy?: "completed" | "avgScore" | "highScores";
}): Promise<{
  success: boolean;
  entries: LeaderboardEntry[];
  error?: string;
}> {
  try {
    const supabase = await createClient();
    if (!supabase) return { success: false, entries: [], error: "Database not configured." };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, entries: [], error: "Unauthorized" };

    let impQuery = supabase
      .from("khan_imports")
      .select("id, report_date, grade, subject, school_class_name");

    if (params.grade && params.grade !== "all") impQuery = impQuery.eq("grade", params.grade);
    if (params.subject && params.subject !== "all") impQuery = impQuery.eq("subject", params.subject);

    const { data: importsData, error: impErr } = await impQuery;
    if (impErr) return { success: false, entries: [], error: impErr.message };

    const importIds = (importsData || []).map((i) => i.id);
    if (importIds.length === 0) {
      return { success: true, entries: [] };
    }

    const [recordsRes, mappingsRes] = await Promise.all([
      supabase
        .from("khan_learning_records")
        .select("import_id, khan_student_name, status, score_percentage, created_at")
        .in("import_id", importIds)
        .limit(10000),
      supabase
        .from("khan_student_mappings")
        .select(`
          khan_student_name,
          student_id,
          students ( first_name, last_name, student_code, grade, section )
        `),
    ]);

    const records = (recordsRes.data || []) as any[];
    const mappings = (mappingsRes.data || []) as any[];

    const mappingMap = new Map<string, any>();
    mappings.forEach((m) => {
      const stu = m.students;
      mappingMap.set(m.khan_student_name, {
        isMapped: !!m.student_id,
        officialName: stu ? `${stu.first_name} ${stu.last_name}` : undefined,
        studentCode: stu?.student_code,
        grade: stu?.grade,
        section: stu?.section,
      });
    });

    const importsMap = new Map<string, any>();
    (importsData || []).forEach((i) => importsMap.set(i.id, i));

    // Aggregate by student name
    const studentMap = new Map<string, {
      completed: number;
      viewed: number;
      scores: number[];
      highScores: number;
      lastDate: string;
      grade: string;
    }>();

    for (const r of records) {
      const entry = studentMap.get(r.khan_student_name) || {
        completed: 0,
        viewed: 0,
        scores: [],
        highScores: 0,
        lastDate: "",
        grade: "",
      };

      if (r.status === "attempted") {
        entry.completed++;
      } else if (r.status === "viewed") {
        entry.viewed++;
      }

      if (r.score_percentage !== null && r.score_percentage !== undefined) {
        entry.scores.push(r.score_percentage);
        if (r.score_percentage >= 80) {
          entry.highScores++;
        }
      }

      const imp = importsMap.get(r.import_id);
      if (imp?.report_date && imp.report_date > entry.lastDate) {
        entry.lastDate = imp.report_date;
        entry.grade = imp.grade;
      }

      studentMap.set(r.khan_student_name, entry);
    }

    const sortBy = params.sortBy || "completed";

    const entries: LeaderboardEntry[] = Array.from(studentMap.entries()).map(([name, data]) => {
      const mapping = mappingMap.get(name);
      const avg = data.scores.length > 0 ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length) : null;

      return {
        rank: 0, // Assigned after sorting
        khanStudentName: name,
        officialStudentName: mapping?.officialName,
        studentCode: mapping?.studentCode,
        isMapped: mapping?.isMapped ?? false,
        grade: mapping?.grade || data.grade || params.grade || "KG",
        section: mapping?.section,
        totalActivitiesCompleted: data.completed,
        totalViewed: data.viewed,
        averageScore: avg,
        highScoresCount: data.highScores,
        lastActiveDate: data.lastDate,
      };
    });

    // Sort entries according to selected metric
    entries.sort((a, b) => {
      if (sortBy === "avgScore") {
        const scoreA = a.averageScore ?? -1;
        const scoreB = b.averageScore ?? -1;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return b.totalActivitiesCompleted - a.totalActivitiesCompleted;
      }
      if (sortBy === "highScores") {
        if (b.highScoresCount !== a.highScoresCount) return b.highScoresCount - a.highScoresCount;
        return b.totalActivitiesCompleted - a.totalActivitiesCompleted;
      }
      // Default: completed activities
      if (b.totalActivitiesCompleted !== a.totalActivitiesCompleted) {
        return b.totalActivitiesCompleted - a.totalActivitiesCompleted;
      }
      return (b.averageScore ?? 0) - (a.averageScore ?? 0);
    });

    // Assign sequential ranks handling ties
    let currentRank = 1;
    for (let i = 0; i < entries.length; i++) {
      if (i > 0) {
        const prev = entries[i - 1];
        const curr = entries[i];
        const isTie =
          sortBy === "avgScore"
            ? curr.averageScore === prev.averageScore && curr.totalActivitiesCompleted === prev.totalActivitiesCompleted
            : curr.totalActivitiesCompleted === prev.totalActivitiesCompleted && curr.averageScore === prev.averageScore;

        if (!isTie) {
          currentRank = i + 1;
        }
      }
      entries[i].rank = currentRank;
    }

    return { success: true, entries };
  } catch (err: any) {
    return { success: false, entries: [], error: err.message || "Failed to load leaderboard." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports & Engineer Abiy Handoff Action
// ─────────────────────────────────────────────────────────────────────────────

export type KhanExportRow = {
  "Import ID": string;
  "Original File": string;
  "Report Date": string;
  "School Class": string;
  "Grade": string;
  "Subject": string;
  "Khan Student Name": string;
  "Official Student Name": string;
  "Student ID Code": string;
  "Category / Level": string;
  "Activity / Skill": string;
  "Status": string;
  "Score %": string | number;
  "Progress Current": string | number;
  "Progress Total": string | number;
  "Progress Ratio": string;
  "Imported At": string;
};

export async function getKhanExportData(params: {
  importId?: string;
  studentName?: string;
  status?: string;
  grade?: string;
  subject?: string;
}): Promise<{
  success: boolean;
  rows?: KhanExportRow[];
  jsonData?: unknown;
  filename?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    if (!supabase) return { success: false, error: "Database not configured." };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    let query = supabase
      .from("khan_learning_records")
      .select(`
        id,
        import_id,
        khan_student_name,
        category_level,
        activity_skill,
        progress_current,
        progress_total,
        score_percentage,
        status,
        created_at,
        khan_imports!inner (
          id,
          original_filename,
          report_date,
          grade,
          subject,
          school_class_name
        )
      `)
      .limit(10000);

    if (params.importId && params.importId !== "all") query = query.eq("import_id", params.importId);
    if (params.studentName) query = query.ilike("khan_student_name", `%${params.studentName.trim()}%`);
    if (params.status && params.status !== "all") query = query.eq("status", params.status);
    if (params.grade && params.grade !== "all") query = query.eq("khan_imports.grade", params.grade);
    if (params.subject && params.subject !== "all") query = query.eq("khan_imports.subject", params.subject);

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    const records = data || [];
    if (records.length === 0) {
      return { success: false, error: "No records found matching the specified filters." };
    }

    const { data: mappings } = await supabase
      .from("khan_student_mappings")
      .select(`
        khan_student_name,
        school_class_name,
        student_id,
        students ( first_name, last_name, student_code )
      `);

    const mappingMap = new Map<string, { official_name?: string; student_code?: string }>();
    if (mappings) {
      mappings.forEach((m: any) => {
        const key = `${m.khan_student_name}__${m.school_class_name}`;
        const stu = m.students as any;
        mappingMap.set(key, {
          official_name: stu ? `${stu.first_name} ${stu.last_name}` : "",
          student_code: stu?.student_code || "",
        });
      });
    }

    const rows: KhanExportRow[] = records.map((r: any) => {
      const imp = r.khan_imports as any;
      const mapKey = `${r.khan_student_name}__${imp?.school_class_name || ""}`;
      const mapping = mappingMap.get(mapKey);

      const progressRatio = r.progress_current !== null && r.progress_total !== null
        ? `${r.progress_current}/${r.progress_total}`
        : "";

      return {
        "Import ID": r.import_id,
        "Original File": imp?.original_filename || "",
        "Report Date": imp?.report_date || "",
        "School Class": imp?.school_class_name || "",
        "Grade": imp?.grade || "",
        "Subject": imp?.subject || "",
        "Khan Student Name": r.khan_student_name,
        "Official Student Name": mapping?.official_name || "",
        "Student ID Code": mapping?.student_code || "",
        "Category / Level": r.category_level,
        "Activity / Skill": r.activity_skill,
        "Status": r.status,
        "Score %": r.score_percentage !== null ? r.score_percentage : "",
        "Progress Current": r.progress_current !== null ? r.progress_current : "",
        "Progress Total": r.progress_total !== null ? r.progress_total : "",
        "Progress Ratio": progressRatio,
        "Imported At": r.created_at,
      };
    });

    const jsonData = {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        totalRecords: rows.length,
        filterApplied: params,
      },
      records: records.map((r: any) => {
        const imp = r.khan_imports as any;
        const mapKey = `${r.khan_student_name}__${imp?.school_class_name || ""}`;
        const mapping = mappingMap.get(mapKey);
        return {
          id: r.id,
          importId: r.import_id,
          reportDate: imp?.report_date,
          grade: imp?.grade,
          subject: imp?.subject,
          schoolClassName: imp?.school_class_name,
          originalFilename: imp?.original_filename,
          student: {
            khanName: r.khan_student_name,
            officialName: mapping?.official_name || null,
            studentCode: mapping?.student_code || null,
          },
          activity: {
            categoryLevel: r.category_level,
            skill: r.activity_skill,
            status: r.status,
            scorePercentage: r.score_percentage,
            progressCurrent: r.progress_current,
            progressTotal: r.progress_total,
          },
          createdAt: r.created_at,
        };
      }),
    };

    const firstImp = (records[0] as any)?.khan_imports;
    const baseName = params.importId && params.importId !== "all"
      ? `khan-export-${firstImp?.school_class_name || "class"}-${firstImp?.subject || "subject"}-${firstImp?.report_date || "date"}`
      : `khan-learning-records-${new Date().toISOString().slice(0, 10)}`;

    return {
      success: true,
      rows,
      jsonData,
      filename: baseName.replace(/[^a-zA-Z0-9-_]/g, "_"),
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to generate export." };
  }
}

export async function getSignedHtmlUrl(importId: string): Promise<{
  success: boolean;
  signedUrl?: string;
  filename?: string;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    if (!supabase) return { success: false, error: "Database not configured." };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: imp, error: impErr } = await supabase
      .from("khan_imports")
      .select("storage_path, original_filename")
      .eq("id", importId)
      .maybeSingle();

    if (impErr || !imp) return { success: false, error: "Import not found." };

    const { data: signed, error: signErr } = await supabase.storage
      .from("khan_exports")
      .createSignedUrl(imp.storage_path, 60, {
        download: imp.original_filename,
      });

    if (signErr || !signed?.signedUrl) {
      return { success: false, error: signErr?.message || "Failed to create signed URL." };
    }

    return {
      success: true,
      signedUrl: signed.signedUrl,
      filename: imp.original_filename,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to get download URL." };
  }
}

export type KhanImportDetailResponse = {
  success: boolean;
  import?: KhanImportSummary;
  stats?: {
    totalRecords: number;
    studentCount: number;
    students: string[];
    skillCount: number;
    attemptedCount: number;
    viewedCount: number;
    unattemptedCount: number;
    avgScore: number | null;
    scoredRecordsCount: number;
  };
  error?: string;
};

export async function getKhanImportById(importId: string): Promise<KhanImportDetailResponse> {
  try {
    const supabase = await createClient();
    if (!supabase) return { success: false, error: "Database not configured." };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };

    const { data: imp, error: impErr } = await supabase
      .from("khan_imports")
      .select("*")
      .eq("id", importId)
      .maybeSingle();

    if (impErr || !imp) {
      return { success: false, error: impErr?.message || "Import not found." };
    }

    const { data: records, error: recErr } = await supabase
      .from("khan_learning_records")
      .select("khan_student_name, status, score_percentage, activity_skill")
      .eq("import_id", importId)
      .limit(10000);

    if (recErr) {
      return { success: false, error: recErr.message };
    }

    const recs = records || [];
    const uniqueStudents = Array.from(new Set(recs.map((r) => r.khan_student_name))).sort();
    const uniqueSkills = Array.from(new Set(recs.map((r) => r.activity_skill))).sort();
    const attempted = recs.filter((r) => r.status === "attempted").length;
    const viewed = recs.filter((r) => r.status === "viewed").length;
    const unattempted = recs.filter((r) => r.status === "unattempted").length;
    const scores = recs.map((r) => r.score_percentage).filter((s): s is number => s !== null && s !== undefined);
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    return {
      success: true,
      import: {
        id: imp.id,
        uploaded_by: imp.uploaded_by,
        original_filename: imp.original_filename,
        file_hash: imp.file_hash,
        storage_path: imp.storage_path,
        report_date: imp.report_date,
        grade: imp.grade,
        subject: imp.subject,
        school_class_name: imp.school_class_name,
        created_at: imp.created_at,
        records_count: recs.length,
      },
      stats: {
        totalRecords: recs.length,
        studentCount: uniqueStudents.length,
        students: uniqueStudents,
        skillCount: uniqueSkills.length,
        attemptedCount: attempted,
        viewedCount: viewed,
        unattemptedCount: unattempted,
        avgScore,
        scoredRecordsCount: scores.length,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch import details." };
  }
}
