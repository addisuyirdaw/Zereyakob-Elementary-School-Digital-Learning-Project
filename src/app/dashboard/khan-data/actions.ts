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
      // If it's a ZIP, we still use the uploaded ZIP filename as original_filename for records 
      // (or we could use the inner file name, but let's keep the uploaded file name)
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
