"use server";

import { parseKhanHtml, ParseResult } from "@/lib/khan-parser";
import { createClient } from "@/lib/supabase/server";
import JSZip from "jszip";

async function extractHtmlFromZip(zipBuffer: ArrayBuffer): Promise<Uint8Array> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(zipBuffer);
  } catch (e) {
    throw new Error("Invalid or corrupted ZIP archive.");
  }

  const fileKeys = Object.keys(zip.files);
  if (fileKeys.length !== 1) {
    throw new Error("ZIP must contain exactly one file.");
  }

  const entry = zip.files[fileKeys[0]];
  if (entry.dir) {
    throw new Error("ZIP cannot contain directories.");
  }

  if (entry.name.includes("..") || entry.name.startsWith("/") || entry.name.startsWith("\\") || entry.name.includes(":\\")) {
    throw new Error("Path traversal detected.");
  }

  if (!entry.name.toLowerCase().endsWith(".html")) {
    throw new Error("Inner file must have a .html extension.");
  }

  const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
  
  // Check declared size if available (to preemptively abort without allocating memory)
  const declaredSize = (entry as any)._data?.uncompressedSize;
  if (declaredSize !== undefined && declaredSize > MAX_SIZE) {
    throw new Error("Archive declares uncompressed size exceeding 20MB limit.");
  }

  // Stream extraction to strictly enforce size limits during decompression
  if (typeof entry.nodeStream === "function") {
    return await new Promise<Uint8Array>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalLength = 0;
      const stream = entry.nodeStream();
      
      stream.on("data", (chunk: Buffer) => {
        totalLength += chunk.length;
        if (totalLength > MAX_SIZE) {
          if (typeof (stream as any).destroy === "function") {
            (stream as any).destroy();
          }
          reject(new Error("Actual uncompressed size exceeded 20MB limit."));
        } else {
          chunks.push(chunk);
        }
      });
      
      stream.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
      stream.on("error", (err: Error) => reject(err));
    });
  } else {
    // Fallback for non-Node.js environments
    const uint8 = await entry.async("uint8array");
    if (uint8.byteLength > MAX_SIZE) {
      throw new Error("Actual uncompressed size exceeded 20MB limit.");
    }
    return uint8;
  }
}

export type UploadActionState = {
  success: boolean;
  result?: ParseResult;
  error?: string;
};

export async function parseKhanUpload(formData: FormData): Promise<UploadActionState> {
  try {
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return { success: false, error: "No file provided" };
    }

    const type = file.type;
    const isZip = type === "application/zip" || type === "application/x-zip-compressed" || file.name.toLowerCase().endsWith(".zip");
    const isHtml = type === "text/html" || file.name.toLowerCase().endsWith(".html");
    
    if (!isZip && !isHtml) {
      return { success: false, error: "Invalid file type. Only HTML and ZIP files are allowed." };
    }

    // 5 MB limit
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: "File exceeds 5MB size limit." };
    }

    const arrayBuffer = await file.arrayBuffer();
    let finalBuffer: Uint8Array;

    if (isZip) {
      finalBuffer = await extractHtmlFromZip(arrayBuffer);
    } else {
      finalBuffer = new Uint8Array(arrayBuffer);
    }

    const htmlString = new TextDecoder().decode(finalBuffer);
    const result = parseKhanHtml(htmlString);

    return {
      success: true,
      result
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to parse the Khan export."
    };
  }
}

export type SaveImportResponse = {
  success: boolean;
  status: "success" | "duplicate" | "validation_error" | "unauthorized" | "storage_error" | "unexpected_error";
  message?: string;
  import_id?: string;
  records_inserted?: number;
};

export async function saveKhanImport(formData: FormData): Promise<SaveImportResponse> {
  try {
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return { success: false, status: "validation_error", message: "No file provided" };
    }

    const type = file.type;
    const isZip = type === "application/zip" || type === "application/x-zip-compressed" || file.name.toLowerCase().endsWith(".zip");
    const isHtml = type === "text/html" || file.name.toLowerCase().endsWith(".html");
    
    if (!isZip && !isHtml) {
      return { success: false, status: "validation_error", message: "Invalid file type. Only HTML and ZIP files are allowed." };
    }

    // 5 MB limit server-side enforcement
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, status: "validation_error", message: "File exceeds 5MB size limit." };
    }

    const supabase = await createClient();
    if (!supabase) {
      return { success: false, status: "unexpected_error", message: "Database configuration error" };
    }

    // Authenticate user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, status: "unauthorized", message: "You must be logged in to upload." };
    }

    // Read original file bytes
    const arrayBuffer = await file.arrayBuffer();
    
    let finalBuffer: Uint8Array;
    try {
      if (isZip) {
        finalBuffer = await extractHtmlFromZip(arrayBuffer);
      } else {
        finalBuffer = new Uint8Array(arrayBuffer);
      }
    } catch (err: any) {
      return { success: false, status: "validation_error", message: err.message || "Archive validation failed." };
    }

    // Calculate SHA-256 hash on the underlying HTML bytes
    const hashBuffer = await crypto.subtle.digest("SHA-256", finalBuffer as unknown as BufferSource);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const file_hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    // Parse HTML string without executing embedded JS
    const htmlString = new TextDecoder().decode(finalBuffer);
    let result: ParseResult;
    try {
      result = parseKhanHtml(htmlString);
    } catch (err: any) {
      return { success: false, status: "validation_error", message: "Failed to parse the Khan HTML export." };
    }

    // Upload the EXACT extracted HTML to Private Storage (discard the ZIP)
    const fileUuid = crypto.randomUUID();
    const storagePath = `${user.id}/${fileUuid}.html`;
    
    const { error: uploadError } = await supabase.storage
      .from("khan_exports")
      .upload(storagePath, finalBuffer, {
        contentType: "text/html",
        upsert: false
      });

    if (uploadError) {
      return { success: false, status: "storage_error", message: "Failed to upload file to secure storage." };
    }

    // Build strictly validated RPC payload
    const payload = {
      file_hash,
      storage_path: storagePath,
      original_filename: file.name,
      report_date: result.metadata.reportDate,
      grade: result.metadata.grade,
      subject: result.metadata.subject,
      school_class_name: result.metadata.className,
      records: result.records
    };

    // Execute Postgres RPC Transaction
    const { data: rpcData, error: rpcError } = await supabase.rpc("fn_insert_khan_batch", {
      payload
    });

    if (rpcError) {
      // 1. Duplicate Handling
      if (rpcError.message && rpcError.message.includes("DUPLICATE_FILE")) {
        await supabase.storage.from("khan_exports").remove([storagePath]); // Best effort cleanup
        return { success: false, status: "duplicate", message: "This exact report has already been imported." };
      }
      
      // 2. Definitive Database Error (Validation / Constraints)
      const isAmbiguousNetworkError = !rpcError.code || 
        ['500', '502', '503', '504', '408'].includes(rpcError.code) || 
        rpcError.code.includes('TIMEOUT') || 
        rpcError.code.includes('FETCH');
      
      if (!isAmbiguousNetworkError) {
        await supabase.storage.from("khan_exports").remove([storagePath]); // Best effort cleanup
        return { 
          success: false, 
          status: "validation_error", 
          message: "Import validation failed. Please check the Khan Academy export and try again." 
        };
      }

      // 3. Ambiguous Error (Network failure/timeout)
      return { 
        success: false, 
        status: "unexpected_error", 
        message: "Database connection failed or timed out. Import status is unknown." 
      };
    }

    // Success!
    return {
      success: true,
      status: "success",
      import_id: rpcData?.import_id,
      records_inserted: rpcData?.records_inserted
    };

  } catch (err: any) {
    return { success: false, status: "unexpected_error", message: "An unexpected server error occurred." };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 1: Historical Data Retrieval, Exploration & Export Actions
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
    if (!supabase) {
      return { success: false, imports: [], error: "Database not configured." };
    }

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return { success: false, imports: [], error: "Unauthorized" };
    }

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

    if (error) {
      return { success: false, imports: [], error: error.message };
    }

    // Fetch uploader profiles if any
    const uploaderIds = Array.from(new Set((data || []).map((i: any) => i.uploaded_by).filter(Boolean)));
    let profileMap = new Map<string, string>();
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

export type GetRecordsResponse = {
  success: boolean;
  records: KhanLearningRecordItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  error?: string;
};

export type GetRecordsParams = {
  importId?: string;
  studentName?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getKhanLearningRecords(params: GetRecordsParams): Promise<GetRecordsResponse> {
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
        khan_imports (
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
    if (params.search) {
      const s = params.search.trim();
      query = query.or(`activity_skill.ilike.%${s}%,category_level.ilike.%${s}%,khan_student_name.ilike.%${s}%`);
    }

    query = query
      .order("khan_student_name", { ascending: true })
      .order("category_level", { ascending: true })
      .range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      return { success: false, records: [], totalCount: 0, page, pageSize, totalPages: 0, error: error.message };
    }

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    // Fetch mappings for these records to attach official student info
    const uniqueStudentNames = Array.from(new Set((data || []).map((r: any) => r.khan_student_name)));
    let mappingMap = new Map<string, { student_id: string; official_name?: string; student_code?: string }>();

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
            student_code: stu?.student_code
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
        official_student_code: mapping?.student_code || null
      };
    });

    return {
      success: true,
      records,
      totalCount,
      page,
      pageSize,
      totalPages
    };
  } catch (err: any) {
    return { success: false, records: [], totalCount: 0, page: 1, pageSize: 25, totalPages: 0, error: err.message || "Failed to fetch records." };
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
    const uniqueStudents = Array.from(new Set(recs.map(r => r.khan_student_name))).sort();
    const uniqueSkills = Array.from(new Set(recs.map(r => r.activity_skill))).sort();
    const attempted = recs.filter(r => r.status === "attempted").length;
    const viewed = recs.filter(r => r.status === "viewed").length;
    const unattempted = recs.filter(r => r.status === "unattempted").length;
    const scores = recs.map(r => r.score_percentage).filter((s): s is number => s !== null && s !== undefined);
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
        scoredRecordsCount: scores.length
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to fetch import details." };
  }
}

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
        khan_imports (
          id,
          original_filename,
          report_date,
          grade,
          subject,
          school_class_name
        )
      `)
      .limit(10000);

    if (params.importId && params.importId !== "all") {
      query = query.eq("import_id", params.importId);
    }
    if (params.studentName) {
      query = query.ilike("khan_student_name", `%${params.studentName.trim()}%`);
    }
    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };

    const records = data || [];
    if (records.length === 0) {
      return { success: false, error: "No records found matching the specified criteria." };
    }

    // Get all mappings for enrichment
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
      `);

    const mappingMap = new Map<string, { official_name?: string; student_code?: string }>();
    if (mappings) {
      mappings.forEach((m: any) => {
        const key = `${m.khan_student_name}__${m.school_class_name}`;
        const stu = m.students as any;
        mappingMap.set(key, {
          official_name: stu ? `${stu.first_name} ${stu.last_name}` : "",
          student_code: stu?.student_code || ""
        });
      });
    }

    // Build structured rows for CSV
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
        "Imported At": r.created_at
      };
    });

    // Build hierarchical JSON export format for Engineer Abiy
    const jsonData = {
      exportMetadata: {
        exportedAt: new Date().toISOString(),
        totalRecords: rows.length,
        filterApplied: params
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
            studentCode: mapping?.student_code || null
          },
          activity: {
            categoryLevel: r.category_level,
            skill: r.activity_skill,
            status: r.status,
            scorePercentage: r.score_percentage,
            progressCurrent: r.progress_current,
            progressTotal: r.progress_total
          },
          createdAt: r.created_at
        };
      })
    };

    const firstImp = (records[0] as any)?.khan_imports;
    const baseName = params.importId && params.importId !== "all"
      ? `khan-export-${firstImp?.school_class_name || "class"}-${firstImp?.subject || "subject"}-${firstImp?.report_date || "date"}`
      : `khan-learning-records-${new Date().toISOString().slice(0, 10)}`;

    return {
      success: true,
      rows,
      jsonData,
      filename: baseName.replace(/[^a-zA-Z0-9-_]/g, "_")
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to generate export data." };
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

    if (impErr || !imp) {
      return { success: false, error: "Import or storage path not found." };
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from("khan_exports")
      .createSignedUrl(imp.storage_path, 60, {
        download: imp.original_filename
      });

    if (signErr || !signed?.signedUrl) {
      return { success: false, error: signErr?.message || "Failed to generate download URL." };
    }

    return {
      success: true,
      signedUrl: signed.signedUrl,
      filename: imp.original_filename
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to get download URL." };
  }
}
